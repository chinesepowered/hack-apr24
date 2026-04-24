-- Bootstrap schema for the Branch InsForge integration.
-- Apply once against the InsForge Postgres (Dashboard → SQL Editor, or psql).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS branch_pr_history (
  id          BIGSERIAL PRIMARY KEY,
  pr_number   INT       NOT NULL,
  repo        TEXT      NOT NULL,
  title       TEXT      NOT NULL,
  summary     TEXT      NOT NULL,
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_pr_history_embedding_idx
  ON branch_pr_history USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Cosine-similarity search exposed via PostgREST RPC.
CREATE OR REPLACE FUNCTION branch_match_pr_history(
  query_embedding VECTOR(1536),
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
    (1 - (h.embedding <=> query_embedding))::real AS score
  FROM branch_pr_history h
  WHERE h.embedding IS NOT NULL
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
$$;
