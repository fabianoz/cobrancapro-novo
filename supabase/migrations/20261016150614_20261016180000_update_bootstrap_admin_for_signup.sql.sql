/*
# Update bootstrap_admin to work with signUp-created users

## Purpose
The previous bootstrap_admin tried to create auth.users directly via SQL,
but Supabase's GoTrue auth service doesn't properly validate users created
this way for signInWithPassword. The new approach: the client calls
supabase.auth.signUp() first (which creates the user properly via GoTrue),
then calls bootstrap_admin which only creates the profile + permissions
(using the already-created auth user).

## Changes
1. Updated function `bootstrap_admin(p_email text, p_password text)`:
   - No longer creates/updates auth.users (signUp handles that)
   - Looks up the existing auth user by email
   - Only creates the system profile + permissions
   - Still guards: only works if no system users exist yet
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

  -- Find the auth user created by signUp
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário de autenticação não encontrado. Faça signUp primeiro.';
  END IF;

  -- Ensure email is confirmed
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  -- Create system profile
  INSERT INTO public.usuarios_sistema (id, nome, email, cargo, ativo)
  VALUES (v_user_id, 'Administrador', lower(p_email), 'admin', true)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, ativo = EXCLUDED.ativo;

  -- Create permissions
  DELETE FROM public.permissoes_usuario WHERE usuario_id = v_user_id;
  INSERT INTO public.permissoes_usuario (usuario_id, modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_exportar)
  SELECT v_user_id, unnest, true, true, true, true, true FROM unnest(v_modules);

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text, text) TO anon, authenticated;
