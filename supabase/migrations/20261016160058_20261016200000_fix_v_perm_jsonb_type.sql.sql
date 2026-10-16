/*
# Fix v_perm type in system user management functions

## Purpose
The `create_system_user_profile`, `update_system_user`, and `create_system_user` functions
declared `v_perm` as `record`, but `jsonb_array_elements()` returns `jsonb` values.
The `->>` operator only works on `jsonb`, not `record`, causing:
"operator does not exist: record ->> unknown"

## Changes
1. Recreate all three functions with `v_perm jsonb` instead of `v_perm record`.
2. Preserve all existing logic and security checks.
*/

CREATE OR REPLACE FUNCTION public.create_system_user_profile(
  p_admin_token text,
  p_user_id uuid,
  p_nome text,
  p_email text,
  p_cargo text,
  p_ativo boolean,
  p_permissions jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_cargo text;
  v_perm jsonb;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE id = auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;
  SELECT cargo INTO v_admin_cargo FROM public.usuarios_sistema WHERE id = v_admin_id AND ativo = true;
  IF v_admin_cargo IS NULL OR v_admin_cargo != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF length(trim(p_nome)) = 0 THEN RAISE EXCEPTION 'Nome é obrigatório.'; END IF;
  IF p_cargo NOT IN ('admin','financeiro','suporte','vendas','estagiario') THEN RAISE EXCEPTION 'Cargo inválido.'; END IF;

  INSERT INTO public.usuarios_sistema (id, nome, email, cargo, ativo, criado_por)
  VALUES (p_user_id, trim(p_nome), lower(p_email), p_cargo, p_ativo, v_admin_id)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, ativo = EXCLUDED.ativo;

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

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_system_user_profile(text, uuid, text, text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_system_user_profile(text, uuid, text, text, text, boolean, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_system_user(
  p_admin_token text,
  p_user_id uuid,
  p_nome text,
  p_cargo text,
  p_ativo boolean,
  p_permissions jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_cargo text;
  v_perm jsonb;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE id = auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;
  SELECT cargo INTO v_admin_cargo FROM public.usuarios_sistema WHERE id = v_admin_id AND ativo = true;
  IF v_admin_cargo IS NULL OR v_admin_cargo != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.usuarios_sistema
  SET nome = trim(p_nome), cargo = p_cargo, ativo = p_ativo, updated_at = now()
  WHERE id = p_user_id;

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

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_system_user(text, uuid, text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_system_user(text, uuid, text, text, boolean, jsonb) TO authenticated;

DROP FUNCTION IF EXISTS public.create_system_user(text, text, text, text, text, boolean, jsonb);

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
  v_perm jsonb;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE id = auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado.';
  END IF;
  SELECT cargo INTO v_admin_cargo FROM public.usuarios_sistema WHERE id = v_admin_id;
  IF v_admin_cargo IS NULL OR v_admin_cargo != 'admin' OR NOT COALESCE((SELECT ativo FROM public.usuarios_sistema WHERE id = v_admin_id), false) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF length(trim(p_nome)) = 0 THEN RAISE EXCEPTION 'Nome é obrigatório.'; END IF;
  IF length(trim(p_email)) = 0 THEN RAISE EXCEPTION 'Email é obrigatório.'; END IF;
  IF length(p_password) < 6 THEN RAISE EXCEPTION 'Senha deve ter ao menos 6 caracteres.'; END IF;
  IF p_cargo NOT IN ('admin','financeiro','suporte','vendas','estagiario') THEN RAISE EXCEPTION 'Cargo inválido.'; END IF;

  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email já cadastrado.';
  END IF;

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

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, created_at, updated_at
  ) VALUES (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
    'email', now(), now()
  );

  INSERT INTO public.usuarios_sistema (id, nome, email, cargo, ativo, criado_por)
  VALUES (v_user_id, trim(p_nome), lower(p_email), p_cargo, p_ativo, v_admin_id);

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

REVOKE EXECUTE ON FUNCTION public.create_system_user(text, text, text, text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_system_user(text, text, text, text, text, boolean, jsonb) TO authenticated;
