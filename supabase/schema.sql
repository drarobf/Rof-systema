-- ══════════════════════════════════════════════════════════════
-- Sistema ROF™ — Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- Tabela principal de dados (key-value JSONB)
-- Armazena: pacientes, agenda, estoque, procedimentos
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rof_store (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir linhas base para cada coleção (evita erro na primeira leitura)
INSERT INTO rof_store (key, data) VALUES
  ('rof_pts',   '[]'::jsonb),
  ('rof_apts',  '[]'::jsonb),
  ('rof_stk',   '[]'::jsonb),
  ('rof_procs', '[]'::jsonb),
  ('rof_caixa', '[]'::jsonb),
  ('rof_leads', '[]'::jsonb),
  ('rof_pt_photos', '{}'::jsonb),
  ('rof_whats_templates', '[]'::jsonb),
  ('rof_orientacoes', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Tabela de arquivos (fotos, Rx, documentos)
-- Os arquivos em si ficam no Supabase Storage (bucket "rof-files")
-- Esta tabela guarda os metadados e URLs
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rof_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   INTEGER NOT NULL,
  file_type    TEXT NOT NULL CHECK (file_type IN ('foto', 'xray', 'doc')),
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  name         TEXT,
  cat          TEXT,
  titulo       TEXT,
  date_ref     TEXT,
  obs          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rof_files_patient ON rof_files (patient_id);
CREATE INDEX IF NOT EXISTS idx_rof_files_type    ON rof_files (file_type);

-- Cadastro online preenchido pelo paciente.
CREATE TABLE IF NOT EXISTS rof_intake (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dr_label     TEXT,
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rof_intake_status ON rof_intake (status);
CREATE INDEX IF NOT EXISTS idx_rof_intake_created ON rof_intake (created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- Row Level Security para o app estatico no GitHub Pages.
-- ATENCAO: GitHub Pages nao roda backend, entao as policies abaixo liberam
-- a chave anon usada pelo frontend. Para dados clinicos sensiveis, migrar
-- para Supabase Auth/Edge Functions ou outro backend antes de producao ampla.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE rof_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE rof_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE rof_intake ENABLE ROW LEVEL SECURITY;

-- Permitir tudo para anon no modelo estatico atual.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rof_store' AND policyname = 'allow_anon'
  ) THEN
    CREATE POLICY allow_anon ON rof_store FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rof_files' AND policyname = 'allow_anon'
  ) THEN
    CREATE POLICY allow_anon ON rof_files FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rof_intake' AND policyname = 'allow_anon'
  ) THEN
    CREATE POLICY allow_anon ON rof_intake FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- Storage bucket (execute manualmente no painel Supabase Storage)
-- ──────────────────────────────────────────────────────────────
-- 1. Vá em Storage > New bucket
-- 2. Nome: rof-files
-- 3. Public bucket: SIM (para servir URLs de fotos diretamente)
-- 4. Allowed MIME types: image/*, application/pdf
-- 5. Max file size: 10 MB

-- ──────────────────────────────────────────────────────────────
-- Função de atualização do timestamp (trigger)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rof_store_updated ON rof_store;
CREATE TRIGGER trg_rof_store_updated
  BEFORE UPDATE ON rof_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_rof_intake_updated ON rof_intake;
CREATE TRIGGER trg_rof_intake_updated
  BEFORE UPDATE ON rof_intake
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
