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
    """Importe app.py (charge le modèle d'embedding et ouvre le pool de connexions)."""
    if not os.environ.get("DB_PASSWORD"):
        sys.exit(
            "DB_PASSWORD est manquant. En local, définir aussi DB_HOST=localhost et DB_PORT=5433 "
            "(base publiée par Docker Compose), ainsi que MISTRAL_API_KEY."
        )
    for base in (HERE, HERE / "api", HERE.parent / "api"):
        if (base / "app.py").exists():
            sys.path.insert(0, str(base))
            break
    else:
        sys.exit("app.py introuvable : placer evaluate_rag.py à côté d'app.py, ou dans un dossier voisin de api/.")
    import app as rag_app  # noqa: WPS433 : même code que l'API

    required = ("search", "build_messages", "call_mistral", "clean_content", "location",
                "db", "model", "MISTRAL_MODEL", "DEFAULT_TOP_K", "RateLimited")
    missing = [n for n in required if not hasattr(rag_app, n)]
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
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        sys.exit(f"{path} doit contenir une liste non vide de questions.")
    items = []
    for i, raw in enumerate(data, 1):
        question = (raw.get("question") or "").strip()
        if not question:
            sys.exit(f"Question vide à l'indice {i} de {path}.")
        items.append({
            "id": str(raw.get("id") or f"q{i:02d}"),
            "question": question,
            "reference": (raw.get("reference") or "").strip(),
            "expected_docs": list(raw.get("expected_docs") or []),
            "answerable": bool(raw.get("answerable", True)),
            "drive_ids": raw.get("drive_ids") or None,
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
        "error": None, "ragas": {},
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
        {"name": h["name"], "drive_id": h["drive_id"], "score": h["score"],
         "location": rag_app.location(h["metadata"])}
        for h in hits
    ]
    # Les extraits évalués sont ceux que le modèle voit réellement dans le prompt
    res["contexts"] = [rag_app.clean_content(h["content"]) for h in hits]

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
        res["generation_ms"] = ms(t)

    if res["answer"] is not None and not item["answerable"]:
        res["abstained"] = is_abstention(res["answer"])
    res["latency_ms"] = ms(started)
    return res


# ---------------------------------------------------------------------------
# RAGAS
# ---------------------------------------------------------------------------

def map_ragas_column(name):
    for key, target in (("faithfulness", "faithfulness"), ("relevancy", "answer_relevancy"),
                        ("precision", "context_precision"), ("recall", "context_recall")):
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

        def _encode(self, texts):
            vecs = rag_app.model.encode(["query: " + t for t in texts], normalize_embeddings=True,
                                        show_progress_bar=False)
            return vecs.tolist()

        def embed_documents(self, texts):
            return self._encode(texts)

        def embed_query(self, text):
            return self._encode([text])[0]

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
    result = evaluate(
        dataset=EvaluationDataset(samples=samples),
        metrics=[Faithfulness(), ResponseRelevancy(), LLMContextPrecisionWithReference(),
                 LLMContextRecall()],
        llm=LangchainLLMWrapper(chat),
        embeddings=LangchainEmbeddingsWrapper(AppEmbeddings()),
        run_config=RunConfig(max_workers=workers, timeout=timeout, max_retries=retries, max_wait=60),
        raise_exceptions=False,
        show_progress=True,
    )
    df = result.to_pandas()
    columns = {c: map_ragas_column(c) for c in df.columns if map_ragas_column(c)}
    for pos, r in enumerate(todo):
        for col, target in columns.items():
            value = df.iloc[pos][col]
            try:
                value = float(value)
            except (TypeError, ValueError):
                value = None
            r["ragas"][target] = None if value is None or math.isnan(value) else round(value, 4)


# ---------------------------------------------------------------------------
# Agrégats, rapport, base de données
# ---------------------------------------------------------------------------

def mean(values):
    vals = [v for v in values if v is not None and not (isinstance(v, float) and math.isnan(v))]
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
    p.add_argument("--dataset", default=str(HERE / "dataset.json"), help="jeu de test JSON")
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
    p.add_argument("--report-dir", default=str(HERE / "reports"))
    return p.parse_args()


def main():
    args = parse_args()
    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        sys.exit(f"Jeu de test introuvable : {dataset_path} (voir dataset.example.json)")
    items = load_dataset(dataset_path)
    if args.limit:
        items = items[: args.limit]

    mode = "retrieval_only" if args.retrieval_only else ("no_ragas" if args.no_ragas else "full")
    rag_app = import_app()
    k = args.top_k or rag_app.DEFAULT_TOP_K
    judge = args.judge_model or rag_app.MISTRAL_MODEL
    if mode == "full" and judge == rag_app.MISTRAL_MODEL:
        print("Attention : le juge est le même modèle que celui qui génère les réponses "
              "(auto-évaluation, biaisée). Définir --judge-model ou JUDGE_MODEL.")

    started_at = datetime.now(timezone.utc)
    t_run = time.perf_counter()
    results = []
    for i, item in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {item['question'][:80]}")
        results.append(run_question(rag_app, item, k, args.retrieval_only))
        if not args.retrieval_only and i < len(items):
            time.sleep(args.sleep)

    if mode == "full":
        run_ragas(rag_app, results, judge, args.workers, args.timeout, args.retries)

    duration = time.perf_counter() - t_run
    agg = aggregate(results)
    config = {
        "generation_model": rag_app.MISTRAL_MODEL, "judge_model": judge if mode == "full" else None,
        "top_k": k, "embedding_model": EMBEDDING_MODEL, "mode": mode, "note": args.note,
        "dataset_set": dataset_path.name,
        "dataset_set_sha": hashlib.sha1(dataset_path.read_bytes()).hexdigest()[:10],
        "git_commit": git_commit(), "corpus": corpus_state(rag_app),
        "chunk_chars": os.environ.get("CHUNK_CHARS"), "rows_per_chunk": os.environ.get("ROWS_PER_CHUNK"),
    }
    print_summary(agg, results, mode)

    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = started_at.strftime("%Y%m%d_%H%M%S")
    report = report_dir / f"run_{stamp}_{args.label}.json"
    report.write_text(json.dumps({"label": args.label, "started_at": started_at.isoformat(),
                                  "config": config, "aggregate": agg, "results": results},
                                 ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"\nRapport : {report}")

    if not args.no_db:
        try:
            run_id = save_to_db(rag_app, started_at, duration, args.label, mode, config, agg, results)
            print(f"Enregistré en base : eval_runs.id = {run_id}")
        except Exception as exc:  # noqa: BLE001
            print(f"Écriture en base impossible ({exc}). Les tables eval_* existent-elles ? "
                  "Exécuter sql/eval.sql. Le rapport JSON a été conservé.")
            return 2
    return 0 if agg["errors"] < agg["n_questions"] else 1


if __name__ == "__main__":
    sys.exit(main())