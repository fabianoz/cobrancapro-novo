/*
# Campos da instância de WhatsApp de Atendimento

1. Novas colunas em `settings`
- `evolution_instance_atendimento`: nome da instância de Evolution API dedicada ao chat de atendimento (padrão "bot-atendimento").
- `evolution_atendimento_status`: status atual da conexão do WhatsApp de atendimento (open, close, connecting).
- `evolution_atendimento_numero`: número de telefone conectado à instância de atendimento.
- `chat_roteamento_modo`: modo de roteamento de atendimento — "single" (um número para todos os setores) ou "multi" (um número por setor).
- `chat_mensagem_triagem`: mensagem de triagem exibida quando um cliente contacta o WhatsApp de atendimento.
- `chat_instancia_suporte`: nome da instância vinculada ao setor Suporte (modo multi).
- `chat_instancia_financeiro`: nome da instância vinculada ao setor Financeiro (modo multi).
- `chat_instancia_vendas`: nome da instância vinculada ao setor Vendas (modo multi).

2. Segurança
- Sem novas tabelas. As colunas usam o mesmo RLS já existente em `settings`.

3. Notas
- A instância de cobrança (`evolution_instance_name`, padrão "bot-ia") permanece inalterada.
- Estas colunas apenas adicionam a configuração do segundo WhatsApp, sem remover dados.
*/

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS evolution_instance_atendimento text NOT NULL DEFAULT 'bot-atendimento',
  ADD COLUMN IF NOT EXISTS evolution_atendimento_status text NOT NULL DEFAULT 'close',
  ADD COLUMN IF NOT EXISTS evolution_atendimento_numero text,
  ADD COLUMN IF NOT EXISTS chat_roteamento_modo text NOT NULL DEFAULT 'single' CHECK (chat_roteamento_modo IN ('single', 'multi')),
  ADD COLUMN IF NOT EXISTS chat_mensagem_triagem text NOT NULL DEFAULT 'Digite 1-Financeiro 2-Suporte 3-Vendas',
  ADD COLUMN IF NOT EXISTS chat_instancia_suporte text,
  ADD COLUMN IF NOT EXISTS chat_instancia_financeiro text,
  ADD COLUMN IF NOT EXISTS chat_instancia_vendas text;
