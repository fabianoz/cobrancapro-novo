/*
# Multiempresa — Parte 1: Estrutura de empresas e colunas

## Objetivo
Transformar o sistema de single-tenant para multiempresa (revenda), onde cada empresa
tem seus proprios clientes, cobrancas, planos, assinaturas, configuracoes e usuarios.

## Mudancas
1. Cria tabela empresas (revendas/empresas clientes)
2. Cria tabela empresa_settings (configuracoes por empresa)
3. Adiciona coluna empresa_id em usuarios_sistema e todas as tabelas de dados
4. Cria empresa-raiz "Matriz" e faz backfill de todos os dados existentes
5. Promove admin@cobrancapro.com para super_admin (gerencia todas as empresas)
6. Copia configuracoes atuais (settings id=1) para empresa_settings da raiz
7. Adiciona RLS e indices
*/

-- 1. empresas
CREATE TABLE IF NOT EXISTS empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  razao_social text,
  cnpj text UNIQUE,
  email text,
  whatsapp text,
  plano text NOT NULL DEFAULT 'PRO',
  status text NOT NULL DEFAULT 'ATIVO',
  logo_url text,
  subdomain text UNIQUE,
  max_users integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. empresa_id em usuarios_sistema
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios_sistema' AND column_name='empresa_id') THEN
    ALTER TABLE public.usuarios_sistema ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. empresa_settings
CREATE TABLE IF NOT EXISTS empresa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  billing_provider text NOT NULL DEFAULT 'EFI',
  evolution_api_url text,
  evolution_api_key text,
  evolution_instance_name text,
  email_template text NOT NULL DEFAULT '',
  reminder_rules text NOT NULL DEFAULT 'D-1,D-0,D+1,D+5',
  issuer_name text,
  issuer_trade_name text,
  issuer_cnpj text,
  issuer_ie text,
  issuer_im text,
  issuer_address text,
  issuer_city text,
  issuer_state text,
  issuer_zip_code text,
  issuer_phone text,
  issuer_email text,
  issuer_logo_url text,
  payment_method text,
  barcode_boleto text,
  boleto_url text,
  template_faturar text,
  template_lembrete_d3 text,
  template_lembrete_d0 text,
  template_lembrete_d1 text,
  template_lembrete_d3_pos text,
  template_lembrete_d7_pos text,
  template_pago text,
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_password text,
  smtp_secure boolean DEFAULT false,
  smtp_from_email text,
  efi_client_id text,
  efi_client_secret text,
  efi_pix_key text,
  efi_certificate_base64 text,
  efi_sandbox boolean DEFAULT false,
  inter_client_id text,
  inter_client_secret text,
  inter_cert_base64 text,
  inter_key_base64 text,
  inter_sandbox boolean DEFAULT false,
  asaas_api_key text,
  asaas_sandbox boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. empresa_id em todas as tabelas de dados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='empresa_id') THEN
    ALTER TABLE public.customers ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='charges' AND column_name='empresa_id') THEN
    ALTER TABLE public.charges ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='plans' AND column_name='empresa_id') THEN
    ALTER TABLE public.plans ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name='empresa_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscription_addons' AND column_name='empresa_id') THEN
    ALTER TABLE public.subscription_addons ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='efi_recorrencias' AND column_name='empresa_id') THEN
    ALTER TABLE public.efi_recorrencias ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification_queue' AND column_name='empresa_id') THEN
    ALTER TABLE public.notification_queue ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='whatsapp_logs' AND column_name='empresa_id') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='at_atendentes' AND column_name='empresa_id') THEN
    ALTER TABLE public.at_atendentes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='at_atendimentos' AND column_name='empresa_id') THEN
    ALTER TABLE public.at_atendimentos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='at_mensagens' AND column_name='empresa_id') THEN
    ALTER TABLE public.at_mensagens ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='at_setores' AND column_name='empresa_id') THEN
    ALTER TABLE public.at_setores ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='atendimentos' AND column_name='empresa_id') THEN
    ALTER TABLE public.atendimentos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens_atendimento' AND column_name='empresa_id') THEN
    ALTER TABLE public.mensagens_atendimento ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_conversas' AND column_name='empresa_id') THEN
    ALTER TABLE public.chat_conversas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_mensagens' AND column_name='empresa_id') THEN
    ALTER TABLE public.chat_mensagens ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Criar empresa-raiz e backfill
DO $$
DECLARE
  raiz_id uuid;
  settings_record record;
BEGIN
  SELECT id INTO raiz_id FROM public.empresas WHERE nome = 'Matriz' LIMIT 1;
  IF raiz_id IS NULL THEN
    INSERT INTO public.empresas (nome, razao_social, cnpj, plano, status, max_users)
    VALUES ('Matriz', 'Empresa Matriz', NULL, 'ENTERPRISE', 'ATIVO', 50)
    RETURNING id INTO raiz_id;
  END IF;

  UPDATE public.usuarios_sistema SET empresa_id = raiz_id WHERE empresa_id IS NULL AND email != 'admin@cobrancapro.com';
  UPDATE public.customers SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.charges SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.plans SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.subscriptions SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.subscription_addons SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.efi_recorrencias SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.notification_queue SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.whatsapp_logs SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.at_atendentes SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.at_atendimentos SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.at_mensagens SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.at_setores SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.atendimentos SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.mensagens_atendimento SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.chat_conversas SET empresa_id = raiz_id WHERE empresa_id IS NULL;
  UPDATE public.chat_mensagens SET empresa_id = raiz_id WHERE empresa_id IS NULL;

  SELECT * FROM public.settings WHERE id = 1 INTO settings_record;
  IF settings_record IS NOT NULL THEN
    INSERT INTO public.empresa_settings (
      empresa_id, billing_provider, evolution_api_url, evolution_api_key,
      evolution_instance_name, email_template, reminder_rules,
      issuer_name, issuer_trade_name, issuer_cnpj, issuer_ie, issuer_im,
      issuer_address, issuer_city, issuer_state, issuer_zip_code,
      issuer_phone, issuer_email, issuer_logo_url, payment_method,
      barcode_boleto, boleto_url,
      template_faturar, template_lembrete_d3, template_lembrete_d0,
      template_lembrete_d1, template_lembrete_d3_pos, template_lembrete_d7_pos,
      template_pago,
      smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure, smtp_from_email,
      efi_client_id, efi_client_secret, efi_pix_key, efi_certificate_base64, efi_sandbox,
      inter_client_id, inter_client_secret, inter_cert_base64, inter_key_base64, inter_sandbox,
      asaas_api_key, asaas_sandbox
    ) VALUES (
      raiz_id,
      settings_record.billing_provider,
      settings_record.evolution_api_url,
      settings_record.evolution_api_key,
      settings_record.evolution_instance_name,
      settings_record.email_template,
      settings_record.reminder_rules,
      settings_record.issuer_name,
      settings_record.issuer_trade_name,
      settings_record.issuer_cnpj,
      settings_record.issuer_ie,
      settings_record.issuer_im,
      settings_record.issuer_address,
      settings_record.issuer_city,
      settings_record.issuer_state,
      settings_record.issuer_zip_code,
      settings_record.issuer_phone,
      settings_record.issuer_email,
      settings_record.issuer_logo_url,
      settings_record.payment_method,
      settings_record.barcode_boleto,
      settings_record.boleto_url,
      settings_record.template_faturar,
      settings_record.template_lembrete_d3,
      settings_record.template_lembrete_d0,
      settings_record.template_lembrete_d1,
      settings_record.template_lembrete_d3_pos,
      settings_record.template_lembrete_d7_pos,
      settings_record.template_pago,
      settings_record.smtp_host,
      settings_record.smtp_port,
      settings_record.smtp_user,
      settings_record.smtp_password,
      settings_record.smtp_secure,
      settings_record.smtp_from_email,
      settings_record.efi_client_id,
      settings_record.efi_client_secret,
      settings_record.efi_pix_key,
      settings_record.efi_certificate_base64,
      settings_record.efi_sandbox,
      settings_record.inter_client_id,
      settings_record.inter_client_secret,
      settings_record.inter_cert_base64,
      settings_record.inter_key_base64,
      settings_record.inter_sandbox,
      settings_record.asaas_api_key,
      settings_record.asaas_sandbox
    )
    ON CONFLICT (empresa_id) DO NOTHING;
  END IF;
END $$;

-- 6. Promover admin para super_admin
UPDATE public.usuarios_sistema
SET cargo = 'super_admin', empresa_id = NULL
WHERE email = 'admin@cobrancapro.com';

-- 7. RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_empresas" ON empresas;
CREATE POLICY "select_empresas" ON empresas FOR SELECT
  TO authenticated USING (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_empresas" ON empresas;
CREATE POLICY "insert_empresas" ON empresas FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "update_empresas" ON empresas;
CREATE POLICY "update_empresas" ON empresas FOR UPDATE
  TO authenticated USING (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  ) WITH CHECK (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_empresas" ON empresas;
CREATE POLICY "delete_empresas" ON empresas FOR DELETE
  TO authenticated USING (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "select_empresa_settings" ON empresa_settings;
CREATE POLICY "select_empresa_settings" ON empresa_settings FOR SELECT
  TO authenticated USING (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR empresa_id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_empresa_settings" ON empresa_settings;
CREATE POLICY "insert_empresa_settings" ON empresa_settings FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR empresa_id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "update_empresa_settings" ON empresa_settings;
CREATE POLICY "update_empresa_settings" ON empresa_settings FOR UPDATE
  TO authenticated USING (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR empresa_id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  ) WITH CHECK (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
    OR empresa_id = (SELECT empresa_id FROM public.usuarios_sistema WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_empresa_settings" ON empresa_settings;
CREATE POLICY "delete_empresa_settings" ON empresa_settings FOR DELETE
  TO authenticated USING (
    (SELECT cargo FROM public.usuarios_sistema WHERE id = auth.uid()) = 'super_admin'
  );

-- 8. Indices
CREATE INDEX IF NOT EXISTS idx_customers_empresa ON public.customers(empresa_id);
CREATE INDEX IF NOT EXISTS idx_charges_empresa ON public.charges(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plans_empresa ON public.plans(empresa_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_empresa ON public.subscriptions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios_sistema(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_empresa ON public.notification_queue(empresa_id);
CREATE INDEX IF NOT EXISTS idx_subscription_addons_empresa ON public.subscription_addons(empresa_id);
CREATE INDEX IF NOT EXISTS idx_efi_recorrencias_empresa ON public.efi_recorrencias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_empresa ON public.whatsapp_logs(empresa_id);
CREATE INDEX IF NOT EXISTS idx_at_atendentes_empresa ON public.at_atendentes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_at_atendimentos_empresa ON public.at_atendimentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_at_mensagens_empresa ON public.at_mensagens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_at_setores_empresa ON public.at_setores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_empresa ON public.chat_conversas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_empresa ON public.chat_mensagens(empresa_id);
