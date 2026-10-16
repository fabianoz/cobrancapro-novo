/*
# Create system user management functions

## Purpose
The app manages system users (create, update, delete) via API routes that previously
used supabaseAdmin.auth.admin (Supabase Admin API). Since the service role key is not
available in the deployment environment, these operations need to be done via
SECURITY DEFINER functions that run as postgres and bypass RLS.

## New Functions

### 1. create_system_user(p_admin_token text, p_nome text, p_email text, p_password text, p_cargo text, p_ativo boolean, p_permissions jsonb)
- Verifies the caller is an active admin by looking up the token's user
- Creates a new auth user with encrypted password and email confirmed
- Creates the auth.identities entry
- Creates the system profile
- Creates the permissions from the jsonb array
- Returns the new user id

### 2. update_system_user(p_admin_token text, p_user_id uuid, p_nome text, p_cargo text, p_ativo boolean, p_permissions jsonb, p_password text)
- Verifies the caller is an active admin
- Updates the profile, replaces permissions
- Optionally updates the password
- Returns success

### 3. delete_system_user(p_admin_token text, p_user_id uuid)
- Verifies the caller is an active admin
- Prevents self-deletion
- Deletes the profile, permissions, and auth user
- Returns success

## Security
- All functions are SECURITY DEFINER with SET search_path = public, auth
- Each function derives the caller from auth.uid() via the JWT in the token
- EXECUTE granted to authenticated only (admin operations require login)
*/
CREATE OR REPLACE FUNCTION public.create_system_user(
  p_admin_token text,
  p_nome text,
  p_email text,
  p_password text,
  p_cargo text,
  p_ativo boolean,
  p_permissions jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_cargo text;
  v_user_id uuid;
  v_existing_id uuid;
  v_perm record;
BEGIN
  -- Validate admin caller
  SELECT id INTO v_admin_id FROM auth.users WHERE id = auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;
  SELECT cargo, ativo INTO v_admin_cargo FROM public.usuarios_sistema WHERE id = v_admin_id;
  IF v_admin_cargo IS NULL OR v_admin_cargo != 'admin' OR NOT COALESCE((SELECT ativo FROM public.usuarios_sistema WHERE id = v_admin_id), false) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Validate inputs
  IF length(trim(p_nome)) = 0 THEN RAISE EXCEPTION 'Nome é obrigatório.'; END IF;
  IF length(trim(p_email)) = 0 THEN RAISE EXCEPTION 'Email é obrigatório.'; END IF;
  IF length(p_password) < 6 THEN RAISE EXCEPTION 'Senha deve ter ao menos 6 caracteres.'; END IF;
  IF p_cargo NOT IN ('admin','financeiro','suporte','vendas','estagiario') THEN RAISE EXCEPTION 'Cargo inválido.'; END IF;

  -- Check if auth user already exists
  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email já cadastrado.';
  END IF;

  -- Create auth user
  v_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf', 8)),
    now(), now(), now(),
    '{}'::jsonb, '{}'::jsonb,
    false, false
  );

  -- Create identity
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
    'email', now(), now()
  );

  -- Create profile
  INSERT INTO public.usuarios_sistema (id, nome, email, cargo, ativo, criado_por)
  VALUES (v_user_id, trim(p_nome), lower(p_email), p_cargo, p_ativo, v_admin_id);

  -- Create permissions
  IF p_permissions IS NOT NULL AND jsonb_array_length(p_permissions) > 0 THEN
    FOR v_perm IN SELECT * FROM jsonb_array_elements(p_permissions) LOOP
      INSERT INTO public.permissoes_usuario (usuario_id, modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_exportar)
      VALUES (
        v_user_id,
        v_perm->>'modulo',
        COALESCE((v_perm->>'pode_ver')::boolean, false),
        COALESCE((v_perm->>'pode_criar')::boolean, false),
        COALESCE((v_perm->>'pode_editar')::boolean, false),
        COALESCE((v_perm->>'pode_excluir')::boolean, false),
        COALESCE((v_perm->>'pode_exportar')::boolean, false)
      );
    END LOOP;
  END IF;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_system_user(
  p_admin_token text,
  p_user_id uuid,
  p_nome text,
  p_cargo text,
  p_ativo boolean,
  p_permissions jsonb,
  p_password text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_cargo text;
  v_perm record;
BEGIN
  -- Validate admin caller
  SELECT id INTO v_admin_id FROM auth.users WHERE id = auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;
  SELECT cargo INTO v_admin_cargo FROM public.usuarios_sistema WHERE id = v_admin_id AND ativo = true;
  IF v_admin_cargo IS NULL OR v_admin_cargo != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Update profile
  UPDATE public.usuarios_sistema
  SET nome = trim(p_nome), cargo = p_cargo, ativo = p_ativo, updated_at = now()
  WHERE id = p_user_id;

  -- Replace permissions
  DELETE FROM public.permissoes_usuario WHERE usuario_id = p_user_id;
  IF p_permissions IS NOT NULL AND jsonb_array_length(p_permissions) > 0 THEN
    FOR v_perm IN SELECT * FROM jsonb_array_elements(p_permissions) LOOP
      INSERT INTO public.permissoes_usuario (usuario_id, modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_exportar)
      VALUES (
        p_user_id,
        v_perm->>'modulo',
        COALESCE((v_perm->>'pode_ver')::boolean, false),
        COALESCE((v_perm->>'pode_criar')::boolean, false),
        COALESCE((v_perm->>'pode_editar')::boolean, false),
        COALESCE((v_perm->>'pode_excluir')::boolean, false),
        COALESCE((v_perm->>'pode_exportar')::boolean, false)
      );
    END LOOP;
  END IF;

  -- Update password if provided
  IF p_password IS NOT NULL AND length(p_password) >= 6 THEN
    UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf', 8)), updated_at = now() WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_system_user(
  p_admin_token text,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_cargo text;
BEGIN
  -- Validate admin caller
  SELECT id INTO v_admin_id FROM auth.users WHERE id = auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;
  SELECT cargo INTO v_admin_cargo FROM public.usuarios_sistema WHERE id = v_admin_id AND ativo = true;
  IF v_admin_cargo IS NULL OR v_admin_cargo != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Prevent self-deletion
  IF v_admin_id = p_user_id THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário.';
  END IF;

  -- Delete permissions, profile, identity, and auth user
  DELETE FROM public.permissoes_usuario WHERE usuario_id = p_user_id;
  DELETE FROM public.usuarios_sistema WHERE id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN true;
END;
$$;

-- Grant execute to authenticated (all require admin check inside)
REVOKE EXECUTE ON FUNCTION public.create_system_user(text, text, text, text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_system_user(text, text, text, text, text, boolean, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_system_user(text, uuid, text, text, boolean, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_system_user(text, uuid, text, text, boolean, jsonb, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_system_user(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_system_user(text, uuid) TO authenticated;
