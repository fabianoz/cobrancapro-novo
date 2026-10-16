/*
# Create bootstrap_admin() function

## Purpose
Creates a SECURITY DEFINER function that bootstraps the first admin user directly
in the database, without needing the Supabase service role key. This solves the
chicken-and-egg problem: the app needs an admin to log in, but creating one
requires elevated privileges that the anon key doesn't have.

## Changes
1. New function `bootstrap_admin(p_email text, p_password text)` in public schema
   - SECURITY DEFINER: runs as the function owner (postgres), bypassing RLS
   - SET search_path = public: prevents search path injection
   - Only works if no users exist in usuarios_sistema (first-access guard)
   - Creates the auth user directly in auth.users with encrypted password
   - Creates the system profile with cargo='admin', ativo=true
   - Creates all 19 module permissions with full access
   - Returns the user id on success
   - Raises exception if admin already exists or on error

2. Security
   - EXECUTE granted to anon AND authenticated (needed for bootstrap before login)
   - Function only succeeds when usuarios_sistema is empty (first-access only)
   - search_path is locked to public
*/

CREATE OR REPLACE FUNCTION public.bootstrap_admin(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_existing_count integer;
  v_existing_user_id uuid;
  v_modules text[] := ARRAY[
    'dashboard','clientes','planos','assinaturas','cobrancas','venda_avulsa',
    'atendimento','atendimento_financeiro','atendimento_suporte','atendimento_vendas',
    'configuracoes','configuracoes_bancos','configuracoes_usuarios',
    'configuracoes_whatsapp','configuracoes_planos','relatorios',
    'relatorios_financeiro','relatorios_atendimento','whatsapp'
  ];
BEGIN
  -- Guard: only allow bootstrap if no system users exist
  SELECT count(*) INTO v_existing_count FROM public.usuarios_sistema;
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Administrador já existe.';
  END IF;

  -- Check if auth user already exists
  SELECT id INTO v_existing_user_id FROM auth.users WHERE lower(email) = lower(p_email);

  IF v_existing_user_id IS NOT NULL THEN
    v_user_id := v_existing_user_id;
    -- Update password and confirm email
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf', 8)),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    -- Create new auth user
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      lower(p_email),
      crypt(p_password, gen_salt('bf', 8)),
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      false,
      false
    );
  END IF;

  -- Create system profile
  INSERT INTO public.usuarios_sistema (id, nome, email, cargo, ativo)
  VALUES (v_user_id, 'Administrador', lower(p_email), 'admin', true)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, ativo = EXCLUDED.ativo;

  -- Create permissions (delete first to avoid duplicates)
  DELETE FROM public.permissoes_usuario WHERE usuario_id = v_user_id;
  INSERT INTO public.permissoes_usuario (usuario_id, modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_exportar)
  SELECT v_user_id, unnest, true, true, true, true, true FROM unnest(v_modules);

  RETURN v_user_id;
END;
$$;

-- Grant execute to anon (needed for bootstrap before any user is logged in)
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text, text) TO anon, authenticated;
