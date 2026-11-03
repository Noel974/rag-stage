CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Données RAG
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  drive_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  mime_type     TEXT,
  version       TEXT,          -- md5Checksum ou modifiedTime si absent
  web_view_link TEXT,
  updated_at    TIMESTAMPTZ,   -- modifiedTime côté Drive
  indexed_at    TIMESTAMPTZ DEFAULT now(),
  status        TEXT DEFAULT 'indexed',  -- indexed | error | skipped
  error         TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
  id           BIGSERIAL PRIMARY KEY,
  drive_id     TEXT NOT NULL REFERENCES documents(drive_id) ON DELETE CASCADE,
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}'::jsonb,
  embedding    vector(768),    -- multilingual-e5-base
  content_hash TEXT NOT NULL   -- SHA-256 du contenu : détecte les chunks inchangés
);

CREATE UNIQUE INDEX IF NOT EXISTS chunks_doc_hash_idx ON chunks (drive_id, content_hash);
CREATE INDEX IF NOT EXISTS chunks_drive_idx ON chunks (drive_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Suivi d'usage (alimenté par l'API) : questions, erreurs, sources utilisées
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rag_queries (
  id                 BIGSERIAL PRIMARY KEY,
  question           TEXT NOT NULL,
  response_time_ms   INTEGER NOT NULL,   -- durée totale
  search_time_ms     INTEGER,            -- recherche pgvector
  generation_time_ms INTEGER,            -- appel Mistral
  answer_length      INTEGER,
  sources_count      INTEGER,
  status             TEXT NOT NULL,      -- ok | rate_limited | error
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_errors (
  id            BIGSERIAL PRIMARY KEY,
  query_id      BIGINT REFERENCES rag_queries(id) ON DELETE SET NULL,
  question      TEXT,
  error_message TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Pas de clé étrangère vers documents : l'historique doit survivre
-- à la suppression d'un fichier dans Drive.
CREATE TABLE IF NOT EXISTS rag_query_sources (
  id            BIGSERIAL PRIMARY KEY,
  query_id      BIGINT NOT NULL REFERENCES rag_queries(id) ON DELETE CASCADE,
  drive_id      TEXT NOT NULL,
  document_name TEXT,
  rank          INTEGER,
  score         NUMERIC(5, 4)
);

CREATE INDEX IF NOT EXISTS rag_queries_created_idx ON rag_queries (created_at);
CREATE INDEX IF NOT EXISTS rag_errors_created_idx ON rag_errors (created_at);
CREATE INDEX IF NOT EXISTS rag_query_sources_query_idx ON rag_query_sources (query_id);
CREATE INDEX IF NOT EXISTS rag_query_sources_drive_idx ON rag_query_sources (drive_id);

-- ---------------------------------------------------------------------------
-- Suivi de l'ingestion (alimenté par le flow Kestra)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL,
  duration_s      NUMERIC(10, 2),
  files_total     INTEGER,
  files_new       INTEGER,
  files_updated   INTEGER,
  files_deleted   INTEGER,
  files_error     INTEGER,
  files_unchanged INTEGER,
  chunks_added    INTEGER,
  chunks_removed  INTEGER,
  chunks_kept     INTEGER,
  status          TEXT NOT NULL       -- ok | error
);

CREATE INDEX IF NOT EXISTS ingestion_runs_started_idx ON ingestion_runs (started_at);

-- Tables de suivi de l'évaluation du RAG (alimentées par evaluate_rag.py)

CREATE TABLE IF NOT EXISTS eval_runs (
  id                BIGSERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  label             TEXT,
  mode              TEXT,                      -- full | no_ragas | retrieval_only
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,   -- modèles, top_k, corpus, commit git...
  n_questions       INTEGER,
  n_answerable      INTEGER,
  hit_rate          NUMERIC(5, 4),             -- bon document retrouvé
  mrr               NUMERIC(5, 4),
  abstention_rate   NUMERIC(5, 4),             -- questions sans réponse correctement refusées
  faithfulness      NUMERIC(5, 4),
  answer_relevancy  NUMERIC(5, 4),
  context_precision NUMERIC(5, 4),
  context_recall    NUMERIC(5, 4),
  avg_latency_ms    INTEGER,
  errors            INTEGER,
  duration_s        NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS eval_results (
  id                BIGSERIAL PRIMARY KEY,
  run_id            BIGINT NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  question_id       TEXT,
  question          TEXT NOT NULL,
  reference         TEXT,
  answerable        BOOLEAN DEFAULT TRUE,
  answer            TEXT,
  contexts          JSONB,
  retrieved         JSONB,
  expected_docs     JSONB,
  hit               BOOLEAN,
  rr                NUMERIC(5, 4),
  abstained         BOOLEAN,
  faithfulness      NUMERIC(5, 4),
  answer_relevancy  NUMERIC(5, 4),
  context_precision NUMERIC(5, 4),
  context_recall    NUMERIC(5, 4),
  latency_ms        INTEGER,
  error             TEXT
);

CREATE INDEX IF NOT EXISTS eval_runs_started_idx ON eval_runs (started_at);
CREATE INDEX IF NOT EXISTS eval_results_run_idx ON eval_results (run_id);

CREATE TABLE IF NOT EXISTS system_metrics (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cpu_percent      NUMERIC(5, 2),
  memory_percent   NUMERIC(5, 2),

  pgvector_size_mb  NUMERIC(10, 2),

  documents_count   INTEGER,
  chunks_count      INTEGER
); 
CREATE INDEX IF NOT EXISTS system_metrics_created_idx
ON system_metrics (created_at);