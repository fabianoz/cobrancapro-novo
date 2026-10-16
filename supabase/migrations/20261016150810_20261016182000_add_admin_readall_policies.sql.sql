/*
# Add admin read-all policies for usuarios_sistema and permissoes_usuario

## Purpose
Admins need to list all system users and their permissions in the user management UI.
Currently RLS only allows reading your own profile. These new policies allow admins
(verified via is_system_admin()) to read all rows in both tables.

## Changes
1. New SELECT policy on usuarios_sistema: admins can read all rows
2. New SELECT policy on permissoes_usuario: admins can read all rows
3. Existing own-row policies remain for non-admin users
*/
DROP POLICY IF EXISTS "admins_read_all_system_profiles" ON public.usuarios_sistema;
CREATE POLICY "admins_read_all_system_profiles"
ON public.usuarios_sistema FOR SELECT
TO authenticated
USING (public.is_system_admin());

DROP POLICY IF EXISTS "admins_read_all_permissions" ON public.permissoes_usuario;
CREATE POLICY "admins_read_all_permissions"
ON public.permissoes_usuario FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_sistema
    WHERE usuarios_sistema.id = auth.uid()
    AND usuarios_sistema.cargo = 'admin'
    AND usuarios_sistema.ativo = true
  )
);
