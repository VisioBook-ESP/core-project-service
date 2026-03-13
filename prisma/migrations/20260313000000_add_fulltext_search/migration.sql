-- Add tsvector generated columns for full-text search
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;

ALTER TABLE "ProjectContent" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS "idx_project_search" ON "Project" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "idx_content_search" ON "ProjectContent" USING GIN ("search_vector");
