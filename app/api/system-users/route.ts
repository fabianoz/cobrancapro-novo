export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SYSTEM_MODULES, type UserRole } from '@/lib/auth';

function getAuthedClient(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAdmin(request: NextRequest) {
  const client = getAuthedClient(request);
  if (!client) return null;
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return null;
  const { data: admin } = await client
    .from('usuarios_sistema')
    .select('id, cargo, ativo, empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!admin?.ativo) return null;
  if (admin.cargo !== 'admin' && admin.cargo !== 'super_admin') return null;
  return { user: authData.user, client, empresaId: admin.empresa_id, isSuperAdmin: admin.cargo === 'super_admin' };
}

export async function GET(request: NextRequest) {
  const admin = await getAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  let query = admin.client
    .from('usuarios_sistema')
    .select('*, permissoes_usuario(*)')
    .order('criado_em', { ascending: false });
  if (!admin.isSuperAdmin && admin.empresaId) {
    query = query.eq('empresa_id', admin.empresaId);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Não foi possível carregar os usuários.' }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await getAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  try {
    const body = await request.json();
    const nome = String(body.nome || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const cargo = body.cargo as UserRole;
    const ativo = body.ativo !== false;

    if (!nome || !email || password.length < 6 || !['admin', 'financeiro', 'suporte', 'vendas', 'estagiario'].includes(cargo)) {
      return NextResponse.json({ error: 'Preencha nome, email, senha (mínimo 6 caracteres) e cargo corretamente.' }, { status: 400 });
    }

    const { data: signUpData, error: signUpError } = await admin.client.auth.signUp({ email, password });
    if (signUpError || !signUpData.user) {
      return NextResponse.json({ error: signUpError?.message || 'Não foi possível criar o usuário.' }, { status: 400 });
    }

    const userId = signUpData.user.id;

    const permissions = (body.permissions || []).filter(
      (p: { modulo?: string }) => p.modulo && SYSTEM_MODULES.includes(p.modulo as (typeof SYSTEM_MODULES)[number]),
    );

    const { error: rpcError } = await admin.client.rpc('create_system_user_profile', {
      p_admin_token: admin.user.id,
      p_user_id: userId,
      p_nome: nome,
      p_email: email,
      p_cargo: cargo,
      p_ativo: ativo,
      p_permissions: permissions,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Link new user to the same empresa as the admin (unless super_admin creating a global user)
    if (!admin.isSuperAdmin && admin.empresaId) {
      await admin.client
        .from('usuarios_sistema')
        .update({ empresa_id: admin.empresaId })
        .eq('id', userId);
    } else if (admin.isSuperAdmin && body.empresa_id) {
      await admin.client
        .from('usuarios_sistema')
        .update({ empresa_id: body.empresa_id })
        .eq('id', userId);
    }

    return NextResponse.json({ success: true, userId });
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar o usuário.' }, { status: 500 });
  }
}
