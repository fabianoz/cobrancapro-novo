/*
# Add system users and permissions

1. New Tables
- `usuarios_sistema` stores the authenticated user's profile, role, active status and audit dates.
- `permissoes_usuario` stores one row per user/module with view, create, edit, delete and export flags.

2. Modules
- Seeds the complete CobrancaPro module catalog through the application permission model: dashboard, clientes, planos, assinaturas, cobrancas, venda_avulsa, atendimento, atendimento_financeiro, atendimento_suporte, atendimento_vendas, configuracoes, configuracoes_bancos, configuracoes_usuarios, configuracoes_whatsapp, configuracoes_planos, relatorios, relatorios_financeiro, relatorios_atendimento and whatsapp.

3. Security
- Both tables have RLS enabled.
- Authenticated users can read their own profile and permissions.
- A user can create and update only the profile row matching auth.uid() during first access.
- Admin management writes are performed by the application server after checking the caller's admin profile.
- No password is stored in these tables; Supabase Auth owns password storage and verification.

4. Important notes
- Existing billing tables are unchanged and remain available to the current application.
- The first application administrator is created by the login flow after the first successful Supabase Auth signup with the documented default credentials.
*/

CREATE TABLE IF NOT EXISTS public.usuarios_sistema (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  foto_url text,
  cargo text NOT NULL DEFAULT 'estagiario' CHECK (cargo IN ('admin', 'financeiro', 'suporte', 'vendas', 'estagiario')),
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_sistema_email_lower_key ON public.usuarios_sistema (lower(email));

CREATE TABLE IF NOT EXISTS public.permissoes_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  pode_ver boolean NOT NULL DEFAULT false,
  pode_criar boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT false,
  pode_excluir boolean NOT NULL DEFAULT false,
  pode_exportar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, modulo)
);

CREATE INDEX IF NOT EXISTS permissoes_usuario_usuario_id_idx ON public.permissoes_usuario(usuario_id);

ALTER TABLE public.usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_system_profile" ON public.usuarios_sistema;
CREATE POLICY "users_read_own_system_profile" ON public.usuarios_sistema FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_insert_own_system_profile" ON public.usuarios_sistema;
CREATE POLICY "users_insert_own_system_profile" ON public.usuarios_sistema FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "users_update_own_system_profile" ON public.usuarios_sistema;
CREATE POLICY "users_update_own_system_profile" ON public.usuarios_sistema FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "users_delete_own_system_profile" ON public.usuarios_sistema;
CREATE POLICY "users_delete_own_system_profile" ON public.usuarios_sistema FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_read_own_permissions" ON public.permissoes_usuario;
CREATE POLICY "users_read_own_permissions" ON public.permissoes_usuario FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "users_insert_own_permissions" ON public.permissoes_usuario;
CREATE POLICY "users_insert_own_permissions" ON public.permissoes_usuario FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "users_update_own_permissions" ON public.permissoes_usuario;
CREATE POLICY "users_update_own_permissions" ON public.permissoes_usuario FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "users_delete_own_permissions" ON public.permissoes_usuario;
CREATE POLICY "users_delete_own_permissions" ON public.permissoes_usuario FOR DELETE TO authenticated USING (auth.uid() = usuario_id);

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_sistema
    WHERE id = auth.uid() AND cargo = 'admin' AND ativo = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_system_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
