-- Bootstrap schema for the Branch InsForge integration.
-- Apply once against the InsForge Postgres (Dashboard → SQL Editor, or psql).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS branch_pr_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number   INT       NOT NULL,
  repo        TEXT      NOT NULL,
  title       TEXT      NOT NULL,
  summary     TEXT      NOT NULL,
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW gives correct nearest-neighbour results at any row count. IVFFlat with
-- lists=100 silently returns empty for tiny tables (<1k rows) under default
-- probes=1, so we use HNSW instead.
DROP INDEX IF EXISTS branch_pr_history_embedding_idx;
CREATE INDEX IF NOT EXISTS branch_pr_history_embedding_idx
  ON branch_pr_history USING hnsw (embedding vector_cosine_ops);

-- Cosine-similarity search exposed via PostgREST RPC. The query_embedding
-- argument is TEXT rather than VECTOR so PostgREST (which marshals JSON args
-- to their declared PG types) can pass the pgvector input literal through
-- without a custom cast. The function casts to ::vector inside.
DROP FUNCTION IF EXISTS branch_match_pr_history(vector, int);
DROP FUNCTION IF EXISTS branch_match_pr_history(text, int);
CREATE FUNCTION branch_match_pr_history(
  query_embedding TEXT,
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  pr_number INT,
  repo      TEXT,
  title     TEXT,
  summary   TEXT,
  score     REAL
) LANGUAGE SQL STABLE AS $$
  SELECT
    h.pr_number,
    h.repo,
    h.title,
    h.summary,
    (1 - (h.embedding <=> query_embedding::vector))::real AS score
  FROM branch_pr_history h
  WHERE h.embedding IS NOT NULL
  ORDER BY h.embedding <=> query_embedding::vector
  LIMIT match_count;
$$;
