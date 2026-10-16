/*
# Update bootstrap_admin function to create auth.identities entry

## Purpose
The previous version of bootstrap_admin created the auth.users record but not
the auth.identities record. Supabase Auth requires an identity entry for
email/password login to work. This update adds the identity creation.

## Changes
1. Updated function `bootstrap_admin(p_email text, p_password text)`:
   - Now also inserts into auth.identities after creating the auth user
   - Uses the same user_id as provider_id and in identity_data
   - Works for both new user creation and existing user update paths
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
  v_existing_identity_count integer;
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

  -- Ensure auth.identities entry exists (required for email/password login)
  SELECT count(*) INTO v_existing_identity_count
  FROM auth.identities WHERE user_id = v_user_id AND provider = 'email';
  IF v_existing_identity_count = 0 THEN
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
      'email',
      now(),
      now()
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

REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text, text) TO anon, authenticated;
