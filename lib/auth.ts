import { supabase } from '@/lib/supabase';

export const SYSTEM_MODULES = [
  'dashboard', 'clientes', 'planos', 'assinaturas', 'cobrancas', 'venda_avulsa',
  'atendimento', 'atendimento_financeiro', 'atendimento_suporte', 'atendimento_vendas',
  'configuracoes', 'configuracoes_bancos', 'configuracoes_usuarios',
  'configuracoes_whatsapp', 'configuracoes_planos', 'relatorios',
  'relatorios_financeiro', 'relatorios_atendimento', 'whatsapp',
] as const;

export type SystemModule = (typeof SYSTEM_MODULES)[number];
export type UserRole = 'super_admin' | 'admin' | 'financeiro' | 'suporte' | 'vendas' | 'estagiario';

export type SystemUser = {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  cargo: UserRole;
  ativo: boolean;
  ultimo_acesso: string | null;
  empresa_id: string | null;
};

export type UserPermission = {
  modulo: SystemModule;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_exportar: boolean;
};

export async function loadSystemUser(userId: string) {
  const [{ data: user, error: userError }, { data: permissions, error: permissionError }] = await Promise.all([
    supabase.from('usuarios_sistema').select('*').eq('id', userId).maybeSingle(),
    supabase.from('permissoes_usuario').select('*').eq('usuario_id', userId),
  ]);

  if (userError || permissionError) throw new Error('Não foi possível carregar seu acesso.');
  return { user: user as SystemUser | null, permissions: (permissions || []) as UserPermission[] };
}

export function can(permission: UserPermission | undefined, action: keyof Omit<UserPermission, 'modulo'> = 'pode_ver') {
  return permission?.[action] === true;
}


