/*
# Sistema de Atendimento - Schema

1. New Tables
- `at_setores`: Setores de atendimento (Financeiro, Suporte, Vendas)
  - id (uuid, pk), nome (text), ativo (bool, default true), ordem (int, default 0), created_at
- `at_atendentes`: Atendentes do sistema
  - id (uuid, pk), nome (text), email (text), foto (text, nullable), status (text: online/offline), created_at
- `at_atendimentos`: Registro de cada atendimento
  - id (uuid, pk), numero_cliente (text), nome_cliente (text), setor_id (uuid fk), atendente_id (uuid fk nullable), status (text: aguardando/em_atendimento/finalizado), ultima_mensagem (text), created_at, updated_at
- `at_mensagens`: Mensagens trocadas em cada atendimento
  - id (uuid, pk), atendimento_id (uuid fk), direcao (text: entrada/saida), mensagem (text), atendente_id (uuid fk nullable), created_at

2. Seed Data
- 3 setores: Financeiro, Suporte, Vendas (todos ativos)
- 1 atendente padrao: Fabiano

3. Security
- RLS enabled on all tables
- Single-tenant (no auth) — TO anon, authenticated with USING(true) / WITH CHECK(true)
*/

CREATE TABLE IF NOT EXISTS at_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE at_setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "at_setores_select" ON at_setores;
CREATE POLICY "at_setores_select" ON at_setores FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "at_setores_insert" ON at_setores;
CREATE POLICY "at_setores_insert" ON at_setores FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "at_setores_update" ON at_setores;
CREATE POLICY "at_setores_update" ON at_setores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "at_setores_delete" ON at_setores;
CREATE POLICY "at_setores_delete" ON at_setores FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS at_atendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  foto text,
  status text NOT NULL DEFAULT 'offline',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE at_atendentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "at_atendentes_select" ON at_atendentes;
CREATE POLICY "at_atendentes_select" ON at_atendentes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "at_atendentes_insert" ON at_atendentes;
CREATE POLICY "at_atendentes_insert" ON at_atendentes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "at_atendentes_update" ON at_atendentes;
CREATE POLICY "at_atendentes_update" ON at_atendentes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "at_atendentes_delete" ON at_atendentes;
CREATE POLICY "at_atendentes_delete" ON at_atendentes FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS at_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cliente text NOT NULL,
  nome_cliente text NOT NULL DEFAULT '',
  setor_id uuid REFERENCES at_setores(id) ON DELETE SET NULL,
  atendente_id uuid REFERENCES at_atendentes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aguardando',
  ultima_mensagem text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE at_atendimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "at_atendimentos_select" ON at_atendimentos;
CREATE POLICY "at_atendimentos_select" ON at_atendimentos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "at_atendimentos_insert" ON at_atendimentos;
CREATE POLICY "at_atendimentos_insert" ON at_atendimentos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "at_atendimentos_update" ON at_atendimentos;
CREATE POLICY "at_atendimentos_update" ON at_atendimentos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "at_atendimentos_delete" ON at_atendimentos;
CREATE POLICY "at_atendimentos_delete" ON at_atendimentos FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS at_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES at_atendimentos(id) ON DELETE CASCADE,
  direcao text NOT NULL DEFAULT 'entrada',
  mensagem text NOT NULL,
  atendente_id uuid REFERENCES at_atendentes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE at_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "at_mensagens_select" ON at_mensagens;
CREATE POLICY "at_mensagens_select" ON at_mensagens FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "at_mensagens_insert" ON at_mensagens;
CREATE POLICY "at_mensagens_insert" ON at_mensagens FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "at_mensagens_delete" ON at_mensagens;
CREATE POLICY "at_mensagens_delete" ON at_mensagens FOR DELETE TO anon, authenticated USING (true);

-- Seed: setores
INSERT INTO at_setores (nome, ativo, ordem)
SELECT 'Suporte', true, 1
WHERE NOT EXISTS (SELECT 1 FROM at_setores WHERE nome = 'Suporte');

INSERT INTO at_setores (nome, ativo, ordem)
SELECT 'Financeiro', true, 2
WHERE NOT EXISTS (SELECT 1 FROM at_setores WHERE nome = 'Financeiro');

INSERT INTO at_setores (nome, ativo, ordem)
SELECT 'Vendas', true, 3
WHERE NOT EXISTS (SELECT 1 FROM at_setores WHERE nome = 'Vendas');

-- Seed: atendente padrao
INSERT INTO at_atendentes (nome, email, status)
SELECT 'Fabiano', 'fabiano@cobrancapro.com.br', 'online'
WHERE NOT EXISTS (SELECT 1 FROM at_atendentes WHERE nome = 'Fabiano');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_at_atendimentos_status ON at_atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_at_atendimentos_numero ON at_atendimentos(numero_cliente);
CREATE INDEX IF NOT EXISTS idx_at_mensagens_atendimento ON at_mensagens(atendimento_id);
