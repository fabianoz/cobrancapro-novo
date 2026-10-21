import { supabase } from '@/lib/supabase';

/**
 * Returns the empresa_id of the currently authenticated user.
 * For super_admin, returns null (can see all empresas).
 * Returns null if not authenticated or no session.
 */
export async function getCurrentEmpresaId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: user } = await supabase
    .from('usuarios_sistema')
    .select('empresa_id, cargo')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!user) return null;
  if (user.cargo === 'super_admin') return null;
  return user.empresa_id;
}
