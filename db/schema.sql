-- Skema basis data JP-Insight (PostgreSQL Lokal / Standard)
-- Disesuaikan untuk PostgreSQL Lokal dengan pgvector

-- =====================================================
-- Ekstensi
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- Tabel (Diurutkan sesuai relasi Foreign Key)
-- =====================================================

-- 1. users
CREATE TABLE IF NOT EXISTS public.users (
  id text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'unit_user'::text NOT NULL,
  unit text,
  created_at text NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email)
);

-- 2. documents
CREATE TABLE IF NOT EXISTS public.documents (
  id text NOT NULL,
  filename text NOT NULL,
  stored_path text NOT NULL,
  extracted_text text NOT NULL,
  extraction_method text DEFAULT 'local'::text NOT NULL,
  page_count integer NOT NULL,
  uploaded_at text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  authors text DEFAULT '[]'::text NOT NULL,
  abstract text DEFAULT ''::text NOT NULL,
  doi text DEFAULT ''::text NOT NULL,
  published_year integer,
  volume text DEFAULT ''::text NOT NULL,
  issue_number text DEFAULT ''::text NOT NULL,
  topics text DEFAULT '[]'::text NOT NULL,
  source text DEFAULT 'manual_upload'::text NOT NULL,
  ojs_article_id text,
  synced_at text,
  CONSTRAINT documents_pkey PRIMARY KEY (id)
);

-- 3. chunks
CREATE TABLE IF NOT EXISTS public.chunks (
  id text NOT NULL,
  document_id text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  char_count integer NOT NULL,
  created_at text NOT NULL,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, content)) STORED,
  CONSTRAINT chunks_pkey PRIMARY KEY (id),
  CONSTRAINT chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 4. embeddings
CREATE TABLE IF NOT EXISTS public.embeddings (
  id text NOT NULL,
  chunk_id text NOT NULL,
  document_id text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL,
  vector vector(384) NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT embeddings_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
  CONSTRAINT embeddings_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 5. claims
CREATE TABLE IF NOT EXISTS public.claims (
  id text NOT NULL,
  document_id text NOT NULL,
  chunk_id text NOT NULL,
  jenis text NOT NULL,
  teks text NOT NULL,
  kutipan text NOT NULL,
  topik text DEFAULT ''::text NOT NULL,
  metode text,
  lokasi text,
  variabel text,
  nilai text,
  satuan text,
  arah text,
  created_at text NOT NULL,
  CONSTRAINT claims_pkey PRIMARY KEY (id),
  CONSTRAINT claims_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
  CONSTRAINT claims_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 6. regulation_mentions
CREATE TABLE IF NOT EXISTS public.regulation_mentions (
  id text NOT NULL,
  chunk_id text NOT NULL,
  document_id text NOT NULL,
  jenis text NOT NULL,
  nomor_normal text NOT NULL,
  nomor_lengkap text NOT NULL,
  tahun integer,
  teks_asli text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT regulation_mentions_pkey PRIMARY KEY (id),
  CONSTRAINT regulation_mentions_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
  CONSTRAINT regulation_mentions_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 7. regulation_links
CREATE TABLE IF NOT EXISTS public.regulation_links (
  nomor_lengkap text NOT NULL,
  url text NOT NULL,
  judul_resmi text DEFAULT ''::text NOT NULL,
  curated_by text,
  curated_at text NOT NULL,
  CONSTRAINT regulation_links_pkey PRIMARY KEY (nomor_lengkap)
);

-- 8. chat_history
CREATE TABLE IF NOT EXISTS public.chat_history (
  id text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sources text NOT NULL,
  created_at text NOT NULL,
  mode text DEFAULT 'chat'::text NOT NULL,
  evidence_strength text,
  points text,
  user_id text,
  CONSTRAINT chat_history_pkey PRIMARY KEY (id)
);

-- 9. skills
CREATE TABLE IF NOT EXISTS public.skills (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  instructions text NOT NULL,
  enabled integer DEFAULT 1 NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT skills_pkey PRIMARY KEY (id)
);

-- 10. sync_runs
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id text NOT NULL,
  started_at text NOT NULL,
  finished_at text,
  new_documents_found integer DEFAULT 0 NOT NULL,
  total_documents integer DEFAULT 0 NOT NULL,
  processed_count integer DEFAULT 0 NOT NULL,
  current_title text,
  status text DEFAULT 'running'::text NOT NULL,
  error_message text,
  detail text,
  CONSTRAINT sync_runs_pkey PRIMARY KEY (id)
);

-- 11. audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id text NOT NULL,
  user_id text NOT NULL,
  action text NOT NULL,
  target_id text,
  detail text,
  created_at text NOT NULL,
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- Indeks
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv ON public.chunks USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON public.chunks USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_claims_document_id ON public.claims USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_claims_jenis ON public.claims USING btree (jenis);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_ojs_article_id ON public.documents USING btree (ojs_article_id) WHERE (ojs_article_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON public.embeddings USING btree (chunk_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON public.embeddings USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON public.embeddings USING hnsw (vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_regmentions_chunk_id ON public.regulation_mentions USING btree (chunk_id);
CREATE INDEX IF NOT EXISTS idx_regmentions_document_id ON public.regulation_mentions USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_regmentions_nomor_normal ON public.regulation_mentions USING btree (nomor_normal);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON public.sync_runs USING btree (started_at);
