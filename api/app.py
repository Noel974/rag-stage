import os
import time
import logging
from contextlib import contextmanager

import psycopg2
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from psycopg2.pool import ThreadedConnectionPool
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rag-api")

app = Flask(__name__)
CORS(app, origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(","))

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
MISTRAL_MODEL = os.environ.get("MISTRAL_MODEL", "mistral-small-latest")
DEFAULT_TOP_K = int(os.environ.get("TOP_K", "5"))

# Même modèle et mêmes réglages que le flow Kestra d'ingestion
model = SentenceTransformer("intfloat/multilingual-e5-base")
model.max_seq_length = 512

pool = ThreadedConnectionPool(
    1, 5,
    host=os.environ.get("DB_HOST", "rag_pgvector"),
    port=os.environ.get("DB_PORT", "5432"),
    dbname=os.environ.get("DB_NAME", "rag"),
    user=os.environ.get("DB_USER", "rag"),
    password=os.environ["DB_PASSWORD"],
)


@contextmanager
def db():
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


class RateLimited(Exception):
    pass


def location(meta):
    if not meta:
        return None
    if meta.get("page"):
        return f"page {meta['page']}"
    if meta.get("sheet") and meta.get("row_start"):
        return f"feuille {meta['sheet']}, lignes {meta['row_start']}-{meta['row_end']}"
    if meta.get("sheet"):
        return f"feuille {meta['sheet']}"
    return None



def search(question, k, drive_ids=None):
    """Recherche sémantique avec identifiant des documents sources."""
    vec = model.encode(
        ["query: " + question],
        normalize_embeddings=True
    )[0]
    emb = "[" + ",".join(f"{x:.6f}" for x in vec.tolist()) + "]"

    with db() as conn, conn.cursor() as cur:
        cur.execute("SET LOCAL hnsw.ef_search = 100")

        sql = """
            SELECT c.drive_id, c.content, c.metadata,
                   d.name, d.web_view_link,
                   1 - (c.embedding <=> %s::vector) AS score
            FROM chunks c
            JOIN documents d USING (drive_id)
            WHERE d.status = 'indexed'
        """
        params = [emb]

        if drive_ids:
            cur.execute("SAVEPOINT iter_scan")
            try:
                cur.execute(
                    "SET LOCAL hnsw.iterative_scan = strict_order"
                )
            except psycopg2.Error:
                cur.execute("ROLLBACK TO SAVEPOINT iter_scan")

            sql += " AND c.drive_id = ANY(%s)"
            params.append(list(drive_ids))

        sql += " ORDER BY c.embedding <=> %s::vector LIMIT %s"
        params.extend([emb, k])

        cur.execute(sql, params)
        rows = cur.fetchall()

    return [
        {
            "drive_id": r[0],
            "content": r[1],
            "metadata": r[2] or {},
            "name": r[3],
            "link": r[4],
            "score": round(float(r[5]), 4),
        }
        for r in rows
    ]



SYSTEM_PROMPT = (
    "Tu es un assistant qui répond en français à partir d'extraits de documents. "
    "Chaque extrait est numéroté [1], [2]... et suivi du nom de son document source. "
    "Le texte situé sous la ligne « source » est le contenu réel du document : "
    "même une seule phrase ou un seul mot est un contenu valide, utilise-le. "
    "Réponds uniquement avec les informations présentes dans les extraits. "
    "Si la réponse n'y figure vraiment pas, dis-le clairement au lieu d'inventer. "
    "Cite les extraits utilisés avec leur numéro entre crochets, par exemple [1]. "
    "Pour les données chiffrées de tableaux, précise que tu ne vois que des extraits "
    "et que le résultat peut être partiel."
)


def clean_content(text):
    # La première ligne « Fichier: ... » sert à l'indexation ; le nom du fichier
    # est déjà fourni dans la ligne « source », donc on la retire du prompt.
    lines = text.split("\n", 1)
    if lines[0].startswith("Fichier:") and len(lines) > 1:
        return lines[1].strip()
    return text


def build_messages(question, hits):
    blocks = []
    for i, h in enumerate(hits, 1):
        loc = location(h["metadata"])
        src = h["name"] + (f", {loc}" if loc else "")
        blocks.append(f"[{i}] (source : {src})\nContenu de l'extrait :\n{clean_content(h['content'])}")
    context = "\n\n".join(blocks)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Extraits :\n\n{context}\n\nQuestion : {question}"},
    ]


def call_mistral(messages):
    for attempt in range(4):
        r = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
            json={"model": MISTRAL_MODEL, "messages": messages, "temperature": 0.2},
            timeout=60,
        )
        if r.status_code == 429:
            wait = float(r.headers.get("Retry-After", 2 ** attempt))
            log.warning("Mistral 429, nouvelle tentative dans %.0fs", wait)
            time.sleep(min(wait, 10))
            continue
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    raise RateLimited()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


def save_query_log(
    question,
    response_time_ms,
    search_time_ms,
    generation_time_ms,
    answer_length,
    sources_count,
    status,
    hits=None,
    error_message=None,
):
    """Enregistre une requête RAG, ses sources et ses éventuelles erreurs."""
    try:
        with db() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rag_queries (
                    question,
                    response_time_ms,
                    search_time_ms,
                    generation_time_ms,
                    answer_length,
                    sources_count,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    question,
                    response_time_ms,
                    search_time_ms,
                    generation_time_ms,
                    answer_length,
                    sources_count,
                    status,
                ),
            )
            query_id = cur.fetchone()[0]

            # Historique des documents utilisés
            for rank, hit in enumerate(hits or [], start=1):
                cur.execute(
                    """
                    INSERT INTO rag_query_sources (
                        query_id,
                        drive_id,
                        document_name,
                        rank,
                        score
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        query_id,
                        hit["drive_id"],
                        hit["name"],
                        rank,
                        hit["score"],
                    ),
                )

            # Historique des erreurs
            if error_message:
                cur.execute(
                    """
                    INSERT INTO rag_errors (
                        query_id,
                        question,
                        error_message
                    )
                    VALUES (%s, %s, %s)
                    """,
                    (query_id, question, error_message[:4000]),
                )

    except Exception:
        # Une panne de journalisation ne doit pas empêcher le chatbot
        # de renvoyer sa réponse.
        log.exception("Impossible d'enregistrer la requête RAG")


@app.post("/api/ask")
def ask():
    started = time.perf_counter()

    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()

    if not question:
        return jsonify({"error": "La question est vide."}), 400

    if len(question) > 1000:
        return jsonify({
            "error": "Question trop longue (1000 caractères maximum)."
        }), 400

    try:
        k = max(1, min(int(data.get("top_k", DEFAULT_TOP_K)), 10))
    except (TypeError, ValueError):
        k = DEFAULT_TOP_K

    drive_ids = data.get("drive_ids")

    if drive_ids is not None:
        if (
            not isinstance(drive_ids, list)
            or len(drive_ids) > 50
            or not all(
                isinstance(d, str) and 0 < len(d) <= 200
                for d in drive_ids
            )
        ):
            return jsonify({
                "error": "drive_ids doit être une liste de 50 identifiants maximum."
            }), 400

        drive_ids = drive_ids or None

    hits = []
    search_ms = None
    generation_ms = None

    # 1. Recherche sémantique
    search_started = time.perf_counter()

    try:
        hits = search(question, k, drive_ids)
    except Exception:
        search_ms = int(
            (time.perf_counter() - search_started) * 1000
        )
        response_ms = int(
            (time.perf_counter() - started) * 1000
        )

        log.exception("Erreur lors de la recherche RAG")

        save_query_log(
            question=question,
            response_time_ms=response_ms,
            search_time_ms=search_ms,
            generation_time_ms=None,
            answer_length=None,
            sources_count=0,
            status="error",
            error_message="Erreur lors de la recherche documentaire.",
        )

        return jsonify({
            "error": "Erreur lors de la recherche documentaire.",
            "sources": [],
        }), 500

    search_ms = int(
        (time.perf_counter() - search_started) * 1000
    )

    # 2. Aucun extrait trouvé
    if not hits:
        answer = (
            "Aucun extrait trouvé dans les documents sélectionnés."
            if drive_ids
            else "La base ne contient aucun document indexé pour le moment."
        )

        response_ms = int(
            (time.perf_counter() - started) * 1000
        )

        save_query_log(
            question=question,
            response_time_ms=response_ms,
            search_time_ms=search_ms,
            generation_time_ms=0,
            answer_length=len(answer),
            sources_count=0,
            status="ok",
        )

        return jsonify({
            "answer": answer,
            "sources": [],
        })

    # 3. Préparation des sources pour le frontend
    sources = [
        {
            "n": i,
            "name": h["name"],
            "link": h["link"],
            "location": location(h["metadata"]),
            "score": h["score"],
            "excerpt": h["content"][:300],
        }
        for i, h in enumerate(hits, 1)
    ]

    # 4. Génération Mistral
    generation_started = time.perf_counter()

    try:
        answer = call_mistral(build_messages(question, hits))

    except RateLimited:
        generation_ms = int(
            (time.perf_counter() - generation_started) * 1000
        )
        response_ms = int(
            (time.perf_counter() - started) * 1000
        )

        message = (
            "Le service de génération est saturé, "
            "réessaie dans quelques instants."
        )

        save_query_log(
            question=question,
            response_time_ms=response_ms,
            search_time_ms=search_ms,
            generation_time_ms=generation_ms,
            answer_length=None,
            sources_count=len(hits),
            status="rate_limited",
            hits=hits,
            error_message=message,
        )

        return jsonify({
            "error": message,
            "sources": sources,
        }), 503

    except requests.RequestException:
        generation_ms = int(
            (time.perf_counter() - generation_started) * 1000
        )
        response_ms = int(
            (time.perf_counter() - started) * 1000
        )

        log.exception("Erreur Mistral")

        message = "Erreur lors de l'appel au modèle de génération."

        save_query_log(
            question=question,
            response_time_ms=response_ms,
            search_time_ms=search_ms,
            generation_time_ms=generation_ms,
            answer_length=None,
            sources_count=len(hits),
            status="error",
            hits=hits,
            error_message=message,
        )

        return jsonify({
            "error": message,
            "sources": sources,
        }), 502

    generation_ms = int(
        (time.perf_counter() - generation_started) * 1000
    )
    response_ms = int(
        (time.perf_counter() - started) * 1000
    )

    # 5. Enregistrement d'une réponse réussie
    save_query_log(
        question=question,
        response_time_ms=response_ms,
        search_time_ms=search_ms,
        generation_time_ms=generation_ms,
        answer_length=len(answer),
        sources_count=len(hits),
        status="ok",
        hits=hits,
    )

    return jsonify({
        "answer": answer,
        "sources": sources,
    })


@app.get("/api/status")
def status():
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT status, count(*) FROM documents GROUP BY status")
        by_status = {r[0]: r[1] for r in cur.fetchall()}
        cur.execute("SELECT count(*) FROM chunks")
        n_chunks = cur.fetchone()[0]
        cur.execute("SELECT max(indexed_at) FROM documents")
        last = cur.fetchone()[0]
        cur.execute("SELECT name, error FROM documents WHERE status = 'error' ORDER BY indexed_at DESC LIMIT 20")
        errors = [{"name": r[0], "error": r[1]} for r in cur.fetchall()]
    return jsonify({
        "documents": by_status,
        "chunks": n_chunks,
        "last_indexed_at": last.isoformat() if last else None,
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Consultation des documents indexés
# ---------------------------------------------------------------------------

DOC_COLUMNS = "d.drive_id, d.name, d.mime_type, d.web_view_link, d.status, d.error, d.updated_at, d.indexed_at"

SORTS = {
    "indexed_at": "d.indexed_at DESC NULLS LAST",
    "updated_at": "d.updated_at DESC NULLS LAST",
    "name": "d.name ASC",
}


def iso(dt):
    return dt.isoformat() if dt else None


def int_param(name, default, lo, hi):
    try:
        value = int(request.args.get(name, default))
    except ValueError:
        value = default
    return max(lo, min(value, hi))


def doc_row(r):
    return {
        "drive_id": r[0],
        "name": r[1],
        "mime_type": r[2],
        "link": r[3],
        "status": r[4],
        "error": r[5],
        "updated_at": iso(r[6]),
        "indexed_at": iso(r[7]),
        "chunks": r[8],
    }


@app.get("/api/documents")
def list_documents():
    """Liste paginée des documents. Paramètres : status, q (recherche dans le nom),
    sort (indexed_at | updated_at | name), limit (1-200), offset."""
    status_filter = (request.args.get("status") or "").strip()
    q = (request.args.get("q") or "").strip()
    limit = int_param("limit", 50, 1, 200)
    offset = int_param("offset", 0, 0, 10 ** 9)
    order = SORTS.get(request.args.get("sort"), SORTS["indexed_at"])

    where, params = [], []
    if status_filter:
        where.append("d.status = %s")
        params.append(status_filter)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append("d.name ILIKE %s")
        params.append(f"%{escaped}%")
    clause = ("WHERE " + " AND ".join(where)) if where else ""

    with db() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM documents d {clause}", params)
        total = cur.fetchone()[0]
        cur.execute(
            f"""SELECT {DOC_COLUMNS}, count(c.id)
                FROM documents d LEFT JOIN chunks c ON c.drive_id = d.drive_id
                {clause}
                GROUP BY d.drive_id
                ORDER BY {order}
                LIMIT %s OFFSET %s""",
            params + [limit, offset],
        )
        rows = cur.fetchall()

    return jsonify({
        "total": total,
        "limit": limit,
        "offset": offset,
        "documents": [doc_row(r) for r in rows],
    })


@app.get("/api/documents/<drive_id>")
def get_document(drive_id):
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            f"""SELECT {DOC_COLUMNS},
                       (SELECT count(*) FROM chunks c WHERE c.drive_id = d.drive_id)
                FROM documents d WHERE d.drive_id = %s""",
            (drive_id,),
        )
        row = cur.fetchone()
    if not row:
        return jsonify({"error": "Document introuvable."}), 404
    return jsonify(doc_row(row))


@app.get("/api/documents/<drive_id>/chunks")
def get_document_chunks(drive_id):
    """Extraits indexés d'un document (sans les vecteurs). Paramètres : limit (1-200), offset."""
    limit = int_param("limit", 50, 1, 200)
    offset = int_param("offset", 0, 0, 10 ** 9)
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT name FROM documents WHERE drive_id = %s", (drive_id,))
        doc = cur.fetchone()
        if not doc:
            return jsonify({"error": "Document introuvable."}), 404
        cur.execute("SELECT count(*) FROM chunks WHERE drive_id = %s", (drive_id,))
        total = cur.fetchone()[0]
        cur.execute(
            """SELECT chunk_index, content, metadata FROM chunks
               WHERE drive_id = %s ORDER BY chunk_index LIMIT %s OFFSET %s""",
            (drive_id, limit, offset),
        )
        rows = cur.fetchall()
    return jsonify({
        "drive_id": drive_id,
        "name": doc[0],
        "total": total,
        "limit": limit,
        "offset": offset,
        "chunks": [
            {"index": r[0], "content": r[1], "location": location(r[2] or {}), "metadata": r[2] or {}}
            for r in rows
        ],
    })