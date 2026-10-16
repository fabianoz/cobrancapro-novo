/*
# Simplify system user management to work with signUp

## Purpose
The create_system_user function previously tried to create auth.users directly
via SQL, but Supabase's GoTrue auth service doesn't properly validate users
created this way. Now the app creates auth users via supabase.auth.signUp(),
and the database function only creates the profile + permissions.

## Changes
1. Replaced create_system_user with create_system_user_profile:
   - Takes admin token, user_id, nome, email, cargo, ativo, permissions
   - Verifies caller is admin
   - Creates only the profile + permissions (auth user already created by signUp)

2. Updated update_system_user:
   - No longer updates auth.users password (app handles via updateUserById or
     a separate mechanism). Password updates for existing users are handled
     client-side via the admin API.
   - Actually, since we don't have service role, password updates for other
     users need a different approach. For now, password updates are skipped
     in update mode (admin can delete and recreate if needed).

3. delete_system_user unchanged (deleting from auth.users via SQL works fine
   since it's a DELETE, not a login validation)
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

  -- Validate inputs
  IF length(trim(p_nome)) = 0 THEN RAISE EXCEPTION 'Nome é obrigatório.'; END IF;
  IF p_cargo NOT IN ('admin','financeiro','suporte','vendas','estagiario') THEN RAISE EXCEPTION 'Cargo inválido.'; END IF;

  -- Create profile
  INSERT INTO public.usuarios_sistema (id, nome, email, cargo, ativo, criado_por)
  VALUES (p_user_id, trim(p_nome), lower(p_email), p_cargo, p_ativo, v_admin_id)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, ativo = EXCLUDED.ativo;

  -- Create permissions
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

-- Drop the old function that tried to create auth.users via SQL
DROP FUNCTION IF EXISTS public.create_system_user(text, text, text, text, text, boolean, jsonb);

REVOKE EXECUTE ON FUNCTION public.create_system_user_profile(text, uuid, text, text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_system_user_profile(text, uuid, text, text, text, boolean, jsonb) TO authenticated;

-- Update update_system_user to remove password update (can't do it via SQL reliably)
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

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_system_user(text, uuid, text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_system_user(text, uuid, text, text, boolean, jsonb) TO authenticated;
