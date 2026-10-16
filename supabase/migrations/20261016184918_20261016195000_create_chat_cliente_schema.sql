/*
# Criar estrutura do Chat Cliente

1. Novas tabelas
- `chat_conversas`: conversas recebidas pelo suporte, com cliente, telefone, equipe, responsável, status e origem.
- `chat_mensagens`: mensagens de texto e mídia vinculadas a cada conversa, com remetente, atendente, leitura e estado de entrega.

2. Índices
- Índices para telefone, status, responsável e ordenação por atualização.

3. Segurança
- RLS habilitado nas duas tabelas.
- O módulo é uma caixa de atendimento compartilhada: usuários autenticados da equipe podem consultar e operar as conversas.
- Acesso anônimo não é permitido.

4. Compatibilidade
- A estrutura é nova e não remove nem altera dados das tabelas antigas de Atendimento.
- Os valores de status, equipe, tipo e origem são validados por CHECK constraints.
*/

CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  nome text NOT NULL DEFAULT 'Cliente do WhatsApp',
  foto text,
  telefone text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'encerrado')),
  equipe text NOT NULL DEFAULT 'atendimento' CHECK (equipe IN ('atendimento', 'financeiro', 'administrativo', 'franquia')),
  responsavel_id uuid REFERENCES public.usuarios_sistema(id) ON DELETE SET NULL,
  ultima_mensagem text,
  ultimo_visto timestamptz,
  origem text NOT NULL DEFAULT 'whatsapp_suporte' CHECK (origem IN ('whatsapp_suporte', 'interno', 'externo')),
  transferida boolean NOT NULL DEFAULT false,
  nao_lidas integer NOT NULL DEFAULT 0 CHECK (nao_lidas >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  texto text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio', 'arquivo')),
  remetente text NOT NULL CHECK (remetente IN ('cliente', 'atendente')),
  atendente_id uuid REFERENCES public.usuarios_sistema(id) ON DELETE SET NULL,
  data_hora timestamptz NOT NULL DEFAULT now(),
  lida boolean NOT NULL DEFAULT false,
  estado_entrega text NOT NULL DEFAULT 'enviada' CHECK (estado_entrega IN ('enviando', 'enviada', 'entregue', 'lida', 'erro'))
);

ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_chat_conversas" ON public.chat_conversas;
CREATE POLICY "authenticated_read_chat_conversas" ON public.chat_conversas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_chat_conversas" ON public.chat_conversas;
CREATE POLICY "authenticated_insert_chat_conversas" ON public.chat_conversas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_chat_conversas" ON public.chat_conversas;
CREATE POLICY "authenticated_update_chat_conversas" ON public.chat_conversas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_chat_conversas" ON public.chat_conversas;
CREATE POLICY "authenticated_delete_chat_conversas" ON public.chat_conversas FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_read_chat_mensagens" ON public.chat_mensagens;
CREATE POLICY "authenticated_read_chat_mensagens" ON public.chat_mensagens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_chat_mensagens" ON public.chat_mensagens;
CREATE POLICY "authenticated_insert_chat_mensagens" ON public.chat_mensagens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_chat_mensagens" ON public.chat_mensagens;
CREATE POLICY "authenticated_update_chat_mensagens" ON public.chat_mensagens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_chat_mensagens" ON public.chat_mensagens;
CREATE POLICY "authenticated_delete_chat_mensagens" ON public.chat_mensagens FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_conversas_status_updated ON public.chat_conversas(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_telefone ON public.chat_conversas(telefone);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_responsavel ON public.chat_conversas(responsavel_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_data ON public.chat_mensagens(conversa_id, data_hora);
