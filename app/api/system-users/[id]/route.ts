export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

async function isAdmin(request: NextRequest) {
  const client = getAuthedClient(request);
  if (!client) return null;
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await client
    .from('usuarios_sistema')
    .select('id, cargo, ativo')
    .eq('id', data.user.id)
    .maybeSingle();
  return profile?.ativo && profile.cargo === 'admin' ? { user: data.user, client } : null;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await isAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  try {
    const body = await request.json();
    const nome = String(body.nome || '').trim();
    const cargo = String(body.cargo || '');
    const ativo = body.ativo !== false;
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    const { error } = await admin.client.rpc('update_system_user', {
      p_admin_token: admin.user.id,
      p_user_id: params.id,
      p_nome: nome,
      p_cargo: cargo,
      p_ativo: ativo,
      p_permissions: permissions,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível atualizar o usuário.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await isAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  if (admin.user.id === params.id) return NextResponse.json({ error: 'Não é possível excluir o próprio usuário.' }, { status: 400 });

  const { error } = await admin.client.rpc('delete_system_user', {
    p_admin_token: admin.user.id,
    p_user_id: params.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
