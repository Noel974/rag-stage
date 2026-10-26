CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    driver_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT, 
    version TEXT,
    web_view link TEXT, 
    updated_at TIMESTAMPTS,
    indexed_at TIMESTAMPTS DEFAULT now(), 
    status TEXT DEFAULT  'indexed', 
    error TEXT,
    );

CREATE TABLE IF NOT EXISXTS chunks (
    id   BIGSERIAL PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES documents(driver_id) ON DELETE CASCADE,
    chunk_index INIT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}' ::jsonb, 
    embedding VECTOR(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_drive_idx ON chunks (drive_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks_embedding_idx 
    ON chunks USING hnsw (embedding vector _cosine_ops); 