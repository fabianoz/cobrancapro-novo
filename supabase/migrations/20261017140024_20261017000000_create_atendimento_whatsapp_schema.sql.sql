/*
# Atendimento WhatsApp - Schema

1. New Tables
- `atendimentos`: registros de atendimento via WhatsApp
  - id (uuid, pk), telefone (text), nome_contato (text), cliente_id (uuid fk nullable to customers),
  - status (text: aberto/em_atendimento/encerrado), origem (text), ultima_mensagem (text),
  - tem_mensagem_nova (bool), atendente_id (uuid fk nullable to usuarios_sistema),
  - created_at, updated_at
- `mensagens_atendimento`: mensagens trocadas em cada atendimento
  - id (uuid, pk), atendimento_id (uuid fk), mensagem (text), tipo (text: cliente/atendente),
  - telefone (text), nome_contato (text), atendente_id (uuid fk nullable),
  - raw_payload (jsonb), created_at
- `whatsapp_logs`: log de mensagens enviadas/recebidas via WhatsApp
  - id (uuid, pk), cliente_id (uuid fk nullable), atendimento_id (uuid fk nullable),
  - telefone (text), mensagem (text), tipo (text), status (text),
  - provider_response (jsonb), created_at

2. Security
- RLS enabled on all tables.
- Authenticated users can CRUD (app has sign-in screen).
- Anon role also allowed since webhooks write from server-side with service role key.

3. Indexes
- atendimentos: status, telefone, tem_mensagem_nova
- mensagens_atendimento: atendimento_id, created_at
- whatsapp_logs: atendimento_id, telefone
*/

CREATE TABLE IF NOT EXISTS public.atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  nome_contato text NOT NULL DEFAULT '',
  cliente_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'encerrado')),
  origem text NOT NULL DEFAULT 'whatsapp',
  ultima_mensagem text,
  tem_mensagem_nova boolean NOT NULL DEFAULT false,
  atendente_id uuid REFERENCES public.usuarios_sistema(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_atendimentos" ON public.atendimentos;
CREATE POLICY "select_atendimentos" ON public.atendimentos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_atendimentos" ON public.atendimentos;
CREATE POLICY "insert_atendimentos" ON public.atendimentos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_atendimentos" ON public.atendimentos;
CREATE POLICY "update_atendimentos" ON public.atendimentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_atendimentos" ON public.atendimentos;
CREATE POLICY "delete_atendimentos" ON public.atendimentos FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.mensagens_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  mensagem text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente', 'atendente')),
  telefone text,
  nome_contato text,
  atendente_id uuid REFERENCES public.usuarios_sistema(id) ON DELETE SET NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_atendimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_mensagens_atendimento" ON public.mensagens_atendimento;
CREATE POLICY "select_mensagens_atendimento" ON public.mensagens_atendimento FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_mensagens_atendimento" ON public.mensagens_atendimento;
CREATE POLICY "insert_mensagens_atendimento" ON public.mensagens_atendimento FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_mensagens_atendimento" ON public.mensagens_atendimento;
CREATE POLICY "update_mensagens_atendimento" ON public.mensagens_atendimento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_mensagens_atendimento" ON public.mensagens_atendimento;
CREATE POLICY "delete_mensagens_atendimento" ON public.mensagens_atendimento FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  atendimento_id uuid,
  telefone text,
  mensagem text,
  tipo text NOT NULL DEFAULT 'recebido',
  status text NOT NULL DEFAULT 'recebido',
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "select_whatsapp_logs" ON public.whatsapp_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "insert_whatsapp_logs" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "update_whatsapp_logs" ON public.whatsapp_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "delete_whatsapp_logs" ON public.whatsapp_logs FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON public.atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_telefone ON public.atendimentos(telefone);
CREATE INDEX IF NOT EXISTS idx_atendimentos_nova ON public.atendimentos(tem_mensagem_nova);
CREATE INDEX IF NOT EXISTS idx_mensagens_at_atendimento ON public.mensagens_atendimento(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_at_created ON public.mensagens_atendimento(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_atendimento ON public.whatsapp_logs(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_telefone ON public.whatsapp_logs(telefone);