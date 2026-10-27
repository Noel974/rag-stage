CREATE EXTENSION IF NOT EXISTS vector;
 
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
  id          BIGSERIAL PRIMARY KEY,
  drive_id    TEXT NOT NULL REFERENCES documents(drive_id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  embedding   vector(768),     -- multilingual-e5-base
  content_hash TEXT NOT NULL   -- SHA-256 du contenu : détecte les chunks inchangés
);
 
CREATE UNIQUE INDEX IF NOT EXISTS chunks_doc_hash_idx ON chunks (drive_id, content_hash);
CREATE INDEX IF NOT EXISTS chunks_drive_idx ON chunks (drive_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);