#!/usr/bin/env python3
"""Évaluation du RAG, synchronisée avec app.py.

Le script importe les fonctions de l'API (search, build_messages, call_mistral, clean_content) :
toute modification de la recherche, du prompt ou du modèle de génération dans app.py est donc
prise en compte automatiquement. Seul l'enchaînement recherche -> prompt -> génération est
reproduit ici (voir run_question) : il doit rester identique à celui de /api/ask.

Trois modes :
  python evaluate_rag.py --retrieval-only   recherche seule (Hit rate, MRR), aucun appel LLM
  python evaluate_rag.py --no-ragas         + génération des réponses, sans les métriques RAGAS
  python evaluate_rag.py                    évaluation complète (RAGAS)

Variables d'environnement : celles d'app.py (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
MISTRAL_API_KEY, MISTRAL_MODEL, TOP_K) et, en option, JUDGE_MODEL (modèle du juge RAGAS).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import time
import unicodedata
import warnings
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore", category=DeprecationWarning)

try:  # facultatif : lit un fichier .env s'il existe
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

EMBEDDING_MODEL = "intfloat/multilingual-e5-base"
# Réponse renvoyée par /api/ask quand aucun extrait n'est trouvé
NO_HITS_ANSWER = "La base ne contient aucun document indexé pour le moment."
# Heuristique : une réponse qui contient l'un de ces marqueurs est considérée comme une abstention
ABSTENTION_MARKERS = (
    "ne figure pas", "ne figurent pas", "pas d'information", "aucune information",
    "je ne sais pas", "ne trouve pas", "ne peux pas repondre", "aucun extrait",
    "pas mentionne", "n'est pas precise", "n'est pas indique", "pas dans les extraits",
    "aucun document", "pas assez d'information",
)
METRICS = ("faithfulness", "answer_relevancy", "context_precision", "context_recall")
HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Import de l'API
# ---------------------------------------------------------------------------

def import_app():
    """Importe app.py depuis le projet API, en local ou dans le conteneur Docker."""
    if not os.environ.get("DB_PASSWORD"):
        sys.exit(
            "DB_PASSWORD est manquant. En local, définir DB_HOST=localhost et DB_PORT=5433 "
            "(base publiée par Docker Compose), ainsi que MISTRAL_API_KEY."
        )

    candidates = (
        HERE / "app.py",
        HERE / "api" / "app.py",
        Path("/app/app.py"),  # montage Docker éventuel, prioritaire sur la copie buildée
        HERE.parent / "api" / "app.py",
        Path("/app/api/app.py"),
    )
    app_path = next((candidate.resolve() for candidate in candidates if candidate.is_file()), None)
    if app_path is None:
        locations = ", ".join(str(p) for p in candidates)
        sys.exit(f"app.py introuvable. Emplacements vérifiés : {locations}")

    app_dir = str(app_path.parent)
    if app_dir in sys.path:
        sys.path.remove(app_dir)
    sys.path.insert(0, app_dir)

    # Évite de réutiliser un module app provenant d'un autre emplacement.
    sys.modules.pop("app", None)
    import app as rag_app  # noqa: WPS433

    required = (
        "search", "build_messages", "call_mistral", "clean_content", "location",
        "db", "model", "MISTRAL_MODEL", "DEFAULT_TOP_K", "RateLimited",
    )
    missing = [name for name in required if not hasattr(rag_app, name)]
    if missing:
        sys.exit(f"app.py ne fournit plus : {', '.join(missing)}. Adapter evaluate_rag.py.")
    return rag_app


# ---------------------------------------------------------------------------
# Jeu de test
# ---------------------------------------------------------------------------

def norm(text):
    text = unicodedata.normalize("NFKD", (text or "").replace("\u2019", "'"))
    text = text.encode("ascii", "ignore").decode().lower().strip()
    return " ".join(text.split())


def load_dataset(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"JSON invalide dans {path} (ligne {exc.lineno}, colonne {exc.colno}) : {exc.msg}")
    except OSError as exc:
        sys.exit(f"Impossible de lire le dataset {path} : {exc}")

    if not isinstance(data, list) or not data:
        sys.exit(f"{path} doit contenir une liste non vide de questions.")

    items = []
    seen_ids = set()
    for i, raw in enumerate(data, 1):
        if not isinstance(raw, dict):
            sys.exit(f"L'élément {i} de {path} doit être un objet JSON.")
        question = str(raw.get("question") or "").strip()
        if not question:
            sys.exit(f"Question vide à l'indice {i} de {path}.")

        item_id = str(raw.get("id") or f"q{i:02d}").strip()
        if item_id in seen_ids:
            sys.exit(f"ID de question dupliqué dans {path} : {item_id}")
        seen_ids.add(item_id)

        expected_docs = raw.get("expected_docs") or []
        if isinstance(expected_docs, str):
            expected_docs = [expected_docs]
        if not isinstance(expected_docs, list):
            sys.exit(f"expected_docs doit être une liste (question {item_id}).")

        drive_ids = raw.get("drive_ids") or None
        if isinstance(drive_ids, str):
            drive_ids = [drive_ids]
        if drive_ids is not None and not isinstance(drive_ids, list):
            sys.exit(f"drive_ids doit être une liste ou null (question {item_id}).")
        answerable = raw.get("answerable", True)
        if not isinstance(answerable, bool):
            sys.exit(f"answerable doit être true ou false (question {item_id}).")

        items.append({
            "id": item_id,
            "question": question,
            "reference": str(raw.get("reference") or "").strip(),
            "expected_docs": [str(value) for value in expected_docs],
            "answerable": answerable,
            "drive_ids": [str(value) for value in drive_ids] if drive_ids is not None else None,
        })
    return items



def doc_matches(hit, expected):
    names = {norm(e) for e in expected}
    hit_name = norm(hit.get("name"))
    if hit_name in names or str(hit.get("drive_id", "")).lower() in {e.lower() for e in expected}:
        return True
    return any(e and e in hit_name for e in names)


def is_abstention(answer):
    text = norm(answer)
    return any(marker in text for marker in ABSTENTION_MARKERS)


# ---------------------------------------------------------------------------
# Exécution du RAG (même enchaînement que /api/ask)
# ---------------------------------------------------------------------------

def ms(start):
    return int((time.perf_counter() - start) * 1000)


def run_question(rag_app, item, k, retrieval_only):
    import requests

    res = {
        "id": item["id"], "question": item["question"], "reference": item["reference"],
        "answerable": item["answerable"], "expected_docs": item["expected_docs"],
        "answer": None, "contexts": [], "retrieved": [], "hit": None, "rr": None,
        "abstained": None, "latency_ms": None, "search_ms": None, "generation_ms": None,
        "error": None,
"ragas": {
    "faithfulness": None,
    "answer_relevancy": None,
    "context_precision": None,
    "context_recall": None,
},
    }
    started = time.perf_counter()

    try:
        t = time.perf_counter()
        hits = rag_app.search(item["question"], k, item["drive_ids"])
        res["search_ms"] = ms(t)
    except Exception as exc:  # noqa: BLE001 : on enregistre l'erreur et on continue
        res["error"] = f"recherche : {exc}"
        res["latency_ms"] = ms(started)
        return res

    res["retrieved"] = [
        {
            "name": h.get("name"),
            "drive_id": h.get("drive_id"),
            "score": h.get("score"),
            "location": rag_app.location(h.get("metadata") or {}),
        }
        for h in hits
    ]
    # Les extraits évalués sont ceux que le modèle voit réellement dans le prompt.
    res["contexts"] = [
        rag_app.clean_content(h.get("content") or "") for h in hits
    ]

    if item["answerable"] and item["expected_docs"]:
        rank = next((i for i, h in enumerate(hits, 1) if doc_matches(h, item["expected_docs"])), None)
        res["hit"] = rank is not None
        res["rr"] = 1.0 / rank if rank else 0.0

    if retrieval_only:
        res["latency_ms"] = ms(started)
        return res

    if not hits:
        res["answer"] = NO_HITS_ANSWER
    else:
        t = time.perf_counter()
        try:
            res["answer"] = rag_app.call_mistral(rag_app.build_messages(item["question"], hits))
        except rag_app.RateLimited:
            res["error"] = "génération : limite de débit Mistral (429)"
        except requests.RequestException as exc:
            res["error"] = f"génération : {exc}"
        except Exception as exc:  # noqa: BLE001
            res["error"] = f"génération : {type(exc).__name__}: {exc}"
        res["generation_ms"] = ms(t)

    if res["answer"] is not None and not item["answerable"]:
        res["abstained"] = is_abstention(res["answer"])
    res["latency_ms"] = ms(started)
    return res


# ---------------------------------------------------------------------------
# RAGAS
# ---------------------------------------------------------------------------

def map_ragas_column(name):
    name = str(name).lower()
    for key, target in (
        ("faithfulness", "faithfulness"),
        ("answer_relevancy", "answer_relevancy"),
        ("relevancy", "answer_relevancy"),
        ("context_precision", "context_precision"),
        ("precision", "context_precision"),
        ("context_recall", "context_recall"),
        ("recall", "context_recall"),
    ):
        if key in name:
            return target
    return None


def run_ragas(rag_app, results, judge_model, workers, timeout, retries):
    """Calcule les métriques RAGAS sur les questions avec réponse et référence."""
    from langchain_core.embeddings import Embeddings
    from langchain_mistralai import ChatMistralAI
    from ragas import EvaluationDataset, SingleTurnSample, evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import (Faithfulness, LLMContextPrecisionWithReference,
                               LLMContextRecall, ResponseRelevancy)
    from ragas.run_config import RunConfig

    class AppEmbeddings(Embeddings):
        """Utilise le modèle d'embedding déjà chargé par app.py (aucun téléchargement)."""

        def _encode(self, texts, prefix):
            prepared = [prefix + str(text) for text in texts]
            vecs = rag_app.model.encode(
                prepared,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return vecs.tolist()

        def embed_documents(self, texts):
            # E5 attend le préfixe passage: pour les textes de documents.
            return self._encode(texts, "passage: ")

        def embed_query(self, text):
            # E5 attend le préfixe query: pour les questions.
            return self._encode([text], "query: ")[0]

    todo = []
    for r in results:
        if not r["answerable"] or r["error"] or not r["answer"] or not r["reference"]:
            continue
        if not r["contexts"]:  # rien retrouvé : précision et rappel nuls, le reste est indéfini
            r["ragas"] = {"context_precision": 0.0, "context_recall": 0.0}
            continue
        todo.append(r)
    if not todo:
        print("RAGAS : aucune question évaluable (réponse, référence et extraits requis).")
        return

    print(f"RAGAS : {len(todo)} question(s), juge = {judge_model}, environ {len(todo) * 10} appels au juge.")
    samples = [
        SingleTurnSample(user_input=r["question"], retrieved_contexts=r["contexts"],
                         response=r["answer"], reference=r["reference"])
        for r in todo
    ]
    chat = ChatMistralAI(model=judge_model, mistral_api_key=os.environ["MISTRAL_API_KEY"],
                         temperature=0, max_retries=retries)
    r
    result = evaluate(
        dataset=EvaluationDataset(samples=samples),
        metrics=[
            Faithfulness(),
            ResponseRelevancy(),
            LLMContextPrecisionWithReference(),
            LLMContextRecall()
        ],
        llm=LangchainLLMWrapper(chat),
        embeddings=LangchainEmbeddingsWrapper(AppEmbeddings()),
        run_config=RunConfig(
            max_workers=workers,
            timeout=timeout,
            max_retries=retries,
            max_wait=60
        ),
        raise_exceptions=False,
        show_progress=True,
    )

    # Conversion des résultats RAGAS
    df = result.to_pandas()

    # DEBUG
    print("\n========== DEBUG RAGAS ==========")
    print("Colonnes disponibles :", df.columns.tolist())
    print("\nRésultats complets :")
    print(df.to_string())
    print("\nTypes des colonnes :")
    print(df.dtypes)
    print("=================================\n")

    # Mapping des colonnes
    columns = {
        c: map_ragas_column(c)
        for c in df.columns
        if map_ragas_column(c)
    }

    for pos, r in enumerate(todo):
        for col, target in columns.items():
            value = df.iloc[pos][col]
            try:
                value = float(value)
            except (TypeError, ValueError):
                value = None

            r["ragas"][target] = (
                None if value is None or not math.isfinite(value)
                else round(value, 4)
            )

# ---------------------------------------------------------------------------
# Agrégats, rapport, base de données
# ---------------------------------------------------------------------------

def mean(values):
    vals = []
    for value in values:
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(number):
            vals.append(number)
    return round(sum(vals) / len(vals), 4) if vals else None


def aggregate(results):
    answerable = [r for r in results if r["answerable"]]
    unanswerable = [r for r in results if not r["answerable"] and r["abstained"] is not None]
    lat = [r["latency_ms"] for r in results if r["latency_ms"] is not None]
    agg = {
        "n_questions": len(results),
        "n_answerable": len(answerable),
        "hit_rate": mean([1.0 if r["hit"] else 0.0 for r in answerable if r["hit"] is not None]),
        "mrr": mean([r["rr"] for r in answerable if r["rr"] is not None]),
        "abstention_rate": mean([1.0 if r["abstained"] else 0.0 for r in unanswerable]),
        "avg_latency_ms": int(sum(lat) / len(lat)) if lat else None,
        "errors": sum(1 for r in results if r["error"]),
    }
    for metric in METRICS:
        agg[metric] = mean([r["ragas"].get(metric) for r in results])
    return agg


def git_commit():
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True,
                             cwd=HERE, timeout=5)
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def corpus_state(rag_app):
    try:
        with rag_app.db() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents WHERE status = 'indexed'")
            docs = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM chunks")
            chunks = cur.fetchone()[0]
            cur.execute("SELECT max(indexed_at) FROM documents")
            last = cur.fetchone()[0]
        return {"documents": docs, "chunks": chunks, "last_indexed_at": last.isoformat() if last else None}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def save_to_db(rag_app, started_at, duration_s, label, mode, config, agg, results):
    from psycopg2.extras import Json, execute_values

    with rag_app.db() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO eval_runs
                   (started_at, label, mode, config, n_questions, n_answerable, hit_rate, mrr,
                    abstention_rate, faithfulness, answer_relevancy, context_precision,
                    context_recall, avg_latency_ms, errors, duration_s)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (started_at, label, mode, Json(config), agg["n_questions"], agg["n_answerable"],
             agg["hit_rate"], agg["mrr"], agg["abstention_rate"], agg["faithfulness"],
             agg["answer_relevancy"], agg["context_precision"], agg["context_recall"],
             agg["avg_latency_ms"], agg["errors"], round(duration_s, 2)),
        )
        run_id = cur.fetchone()[0]
        rows = [
            (run_id, r["id"], r["question"], r["reference"] or None, r["answerable"], r["answer"],
             Json(r["contexts"]), Json(r["retrieved"]), Json(r["expected_docs"]), r["hit"], r["rr"],
             r["abstained"], r["ragas"].get("faithfulness"), r["ragas"].get("answer_relevancy"),
             r["ragas"].get("context_precision"), r["ragas"].get("context_recall"),
             r["latency_ms"], r["error"])
            for r in results
        ]
        execute_values(
            cur,
            """INSERT INTO eval_results
                   (run_id, question_id, question, reference, answerable, answer, contexts, retrieved,
                    expected_docs, hit, rr, abstained, faithfulness, answer_relevancy,
                    context_precision, context_recall, latency_ms, error)
               VALUES %s""",
            rows,
        )
    return run_id


def fmt(value, pct=True):
    if value is None:
        return "n/a"
    return f"{value * 100:5.1f} %" if pct else f"{value}"


def print_summary(agg, results, mode):
    print("\n" + "=" * 60)
    print(f"Résultats ({mode}) : {agg['n_questions']} questions, {agg['n_answerable']} avec réponse attendue")
    print("=" * 60)
    lines = [
        ("Hit rate (bon document retrouvé)", fmt(agg["hit_rate"])),
        ("MRR (rang du bon document)", fmt(agg["mrr"], pct=False)),
        ("Abstention (questions sans réponse)", fmt(agg["abstention_rate"])),
        ("Fidélité (faithfulness)", fmt(agg["faithfulness"])),
        ("Pertinence de la réponse", fmt(agg["answer_relevancy"])),
        ("Précision du contexte", fmt(agg["context_precision"])),
        ("Rappel du contexte", fmt(agg["context_recall"])),
        ("Latence moyenne", f"{agg['avg_latency_ms']} ms" if agg["avg_latency_ms"] is not None else "n/a"),
        ("Erreurs", str(agg["errors"])),
    ]
    for label, value in lines:
        print(f"{label:<40}{value:>12}")
    weak = [r for r in results if r["answerable"] and (r["hit"] is False or r["error"])]
    if weak:
        print("\nQuestions à examiner (document attendu non retrouvé, ou erreur) :")
        for r in weak[:10]:
            print(f"  - [{r['id']}] {r['question'][:80]}" + (f"  ({r['error']})" if r["error"] else ""))


# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Évaluation du RAG (retrieval + RAGAS)")
    default_dataset = os.environ.get("RAGAS_DATASET_PATH") or str(HERE / "dataset.json")
    p.add_argument("--dataset", default=default_dataset, help="jeu de test JSON")
    p.add_argument("--label", default="run", help="nom de l'exécution (ex. baseline, chunks-1000)")
    p.add_argument("--note", default="", help="description du changement testé")
    p.add_argument("--top-k", type=int, default=None, help="nombre d'extraits (défaut : TOP_K d'app.py)")
    p.add_argument("--limit", type=int, default=None, help="n'évaluer que les N premières questions")
    p.add_argument("--retrieval-only", action="store_true", help="recherche seule, aucun appel LLM")
    p.add_argument("--no-ragas", action="store_true", help="génère les réponses sans métriques RAGAS")
    p.add_argument("--no-db", action="store_true", help="ne pas écrire dans eval_runs / eval_results")
    p.add_argument("--judge-model", default=os.environ.get("JUDGE_MODEL"), help="modèle juge RAGAS")
    p.add_argument("--sleep", type=float, default=2.0, help="pause (s) entre deux questions")
    p.add_argument("--workers", type=int, default=1, help="appels simultanés du juge RAGAS")
    p.add_argument("--timeout", type=int, default=180, help="délai maximal par appel du juge (s)")
    p.add_argument("--retries", type=int, default=6, help="tentatives en cas d'erreur 429")
    default_report_dir = (
        os.environ.get("RAGAS_RESULTS_DIR")
        or os.environ.get("RAGAS_RESULS_DIR")  # compatibilité avec l'ancien nom dans compose
        or str(HERE / "results")
    )
    p.add_argument("--report-dir", default=default_report_dir,
                   help="Dossier de sauvegarde des résultats JSON")
    args = p.parse_args()

    if args.top_k is not None and args.top_k < 1:
        p.error("--top-k doit être supérieur ou égal à 1")
    if args.limit is not None and args.limit < 1:
        p.error("--limit doit être supérieur ou égal à 1")
    if args.sleep < 0:
        p.error("--sleep ne peut pas être négatif")
    if args.workers < 1:
        p.error("--workers doit être supérieur ou égal à 1")
    if args.timeout < 1:
        p.error("--timeout doit être supérieur ou égal à 1")
    if args.retries < 0:
        p.error("--retries ne peut pas être négatif")
    if args.retrieval_only and args.no_ragas:
        p.error("--retrieval-only et --no-ragas ne peuvent pas être utilisés ensemble")
    return args



def main():
    args = parse_args()
    dataset_path = Path(args.dataset).expanduser().resolve()
    # Compatibilité avec le montage Docker ./evaluation/dataset.json -> /app/dataset.json.
    if not dataset_path.is_file() and Path("/app/dataset.json").is_file():
        dataset_path = Path("/app/dataset.json")
    if not dataset_path.is_file():
        sys.exit(f"Jeu de test introuvable : {dataset_path} (voir dataset.example.json)")

    items = load_dataset(dataset_path)
    if args.limit is not None:
        items = items[:args.limit]
    if not items:
        sys.exit("Aucune question à évaluer après application de --limit.")

    mode = "retrieval_only" if args.retrieval_only else ("no_ragas" if args.no_ragas else "full")
    rag_app = import_app()
    k = args.top_k if args.top_k is not None else rag_app.DEFAULT_TOP_K
    judge = args.judge_model or rag_app.MISTRAL_MODEL

    if mode == "full" and judge == rag_app.MISTRAL_MODEL:
        print(
            "Attention : le juge est le même modèle que celui qui génère les réponses "
            "(auto-évaluation potentiellement biaisée). Définir --judge-model ou JUDGE_MODEL."
        )

    started_at = datetime.now(timezone.utc)
    t_run = time.perf_counter()
    results = []
    for i, item in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {item['question'][:80]}")
        results.append(run_question(rag_app, item, k, args.retrieval_only))
        if not args.retrieval_only and i < len(items) and args.sleep:
            time.sleep(args.sleep)

    ragas_error = None
    if mode == "full":
        try:
            run_ragas(rag_app, results, judge, args.workers, args.timeout, args.retries)
        except Exception as exc:  # noqa: BLE001 : conserver les résultats même si RAGAS échoue
            ragas_error = f"{type(exc).__name__}: {exc}"
            print(f"\nERREUR RAGAS : {ragas_error}")
            print("Les réponses et résultats de recherche seront tout de même sauvegardés.")

    duration = time.perf_counter() - t_run
    agg = aggregate(results)
    config = {
        "generation_model": rag_app.MISTRAL_MODEL,
        "judge_model": judge if mode == "full" else None,
        "top_k": k,
        "embedding_model": EMBEDDING_MODEL,
        "mode": mode,
        "note": args.note,
        "dataset_set": dataset_path.name,
        "dataset_set_sha": hashlib.sha1(dataset_path.read_bytes()).hexdigest()[:10],
        "git_commit": git_commit(),
        "corpus": corpus_state(rag_app),
        "chunk_chars": os.environ.get("CHUNK_CHARS"),
        "rows_per_chunk": os.environ.get("ROWS_PER_CHUNK"),
        "ragas_error": ragas_error,
    }
    print_summary(agg, results, mode)

    report_path = None
    report_dir = args.report_dir
    # Le compose monte le volume de résultats sur /app/results.
    if str(report_dir).rstrip("/") == "/app/evaluation/results" and Path("/app/results").is_dir():
        report_dir = "/app/results"
    try:
        report_path = save_report(report_dir, started_at, args.label, config, agg, results)
    except Exception:
        # save_report affiche déjà le détail; on poursuit pour tenter l'écriture SQL.
        pass

    if not args.no_db:
        try:
            run_id = save_to_db(rag_app, started_at, duration, args.label, mode, config, agg, results)
            print(f"Enregistré en base : eval_runs.id = {run_id}")
        except Exception as exc:  # noqa: BLE001
            print(
                f"Écriture en base impossible ({type(exc).__name__}: {exc}). "
                "Vérifier les tables eval_runs/eval_results et la connexion PostgreSQL."
            )
            if report_path:
                print(f"Le rapport JSON a été conservé : {report_path}")
            return 2

    if agg["errors"] >= agg["n_questions"]:
        return 1
    if ragas_error:
        return 3
    return 0


def save_report(report_dir, started_at, label, config, agg, results):
    """Sauvegarde le rapport JSON et vérifie son existence."""

    try:
        # Résolution du chemin absolu
        report_dir = Path(report_dir).expanduser().resolve()

        # Création du dossier
        report_dir.mkdir(parents=True, exist_ok=True)

        # Vérification des permissions
        if not report_dir.is_dir():
            raise NotADirectoryError(
                f"Le chemin {report_dir} n'est pas un dossier."
            )

        # Nom unique du fichier
        stamp = started_at.strftime("%Y%m%d_%H%M%S_%f")
        safe_label = "".join(
            c if c.isalnum() or c in "-_" else "_"
            for c in label
        )

        report = report_dir / f"run_{stamp}_{safe_label}.json"

        # Construction du rapport
        payload = {
            "label": label,
            "started_at": started_at.isoformat(),
            "config": config,
            "aggregate": agg,
            "results": results,
        }

        # Écriture dans un fichier temporaire puis remplacement
        temp_report = report.with_suffix(".json.tmp")

        temp_report.write_text(
            json.dumps(
                payload,
                ensure_ascii=False,
                indent=2,
                default=str,
            ),
            encoding="utf-8",
        )

        temp_report.replace(report)

        # Vérification réelle
        if not report.exists() or report.stat().st_size == 0:
            raise IOError("Le rapport JSON n'a pas été correctement créé.")

        print("\n" + "=" * 60)
        print("SAUVEGARDE DU RAPPORT RÉUSSIE")
        print("=" * 60)
        print(f"Dossier : {report_dir}")
        print(f"Fichier : {report.name}")
        print(f"Taille  : {report.stat().st_size} octets")
        print(f"Chemin  : {report}")

        return report

    except Exception as exc:
        print("\nERREUR DE SAUVEGARDE DU RAPPORT")
        print(f"Type : {type(exc).__name__}")
        print(f"Détail : {exc}")
        raise



if __name__ == "__main__":
    sys.exit(main())