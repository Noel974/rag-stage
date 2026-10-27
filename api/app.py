import os
import time
import logging
from contextlib import contextmanager

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


def search(question, k):
    vec = model.encode(["query: " + question], normalize_embeddings=True)[0]
    emb = "[" + ",".join(f"{x:.6f}" for x in vec.tolist()) + "]"
    with db() as conn, conn.cursor() as cur:
        cur.execute("SET LOCAL hnsw.ef_search = 100")
        cur.execute(
            """SELECT c.content, c.metadata, d.name, d.web_view_link,
                      1 - (c.embedding <=> %s::vector) AS score
               FROM chunks c JOIN documents d USING (drive_id)
               WHERE d.status = 'indexed'
               ORDER BY c.embedding <=> %s::vector
               LIMIT %s""",
            (emb, emb, k),
        )
        rows = cur.fetchall()
    return [
        {"content": r[0], "metadata": r[1] or {}, "name": r[2], "link": r[3], "score": round(float(r[4]), 4)}
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


@app.post("/api/ask")
def ask():
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "La question est vide."}), 400
    if len(question) > 1000:
        return jsonify({"error": "Question trop longue (1000 caractères maximum)."}), 400
    k = max(1, min(int(data.get("top_k", DEFAULT_TOP_K)), 10))

    hits = search(question, k)
    if not hits:
        return jsonify({"answer": "La base ne contient aucun document indexé pour le moment.", "sources": []})

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

    try:
        answer = call_mistral(build_messages(question, hits))
    except RateLimited:
        return jsonify({
            "error": "Le service de génération est saturé, réessaie dans quelques instants.",
            "sources": sources,
        }), 503
    except requests.RequestException as e:
        log.error("Erreur Mistral : %s", e)
        return jsonify({"error": "Erreur lors de l'appel au modèle de génération.", "sources": sources}), 502

    return jsonify({"answer": answer, "sources": sources})


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