import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.ativo === 'boolean') updates.ativo = body.ativo;
    if (typeof body.nome === 'string') updates.nome = body.nome;
    if (typeof body.ordem === 'number') updates.ordem = body.ordem;

    const { data, error } = await supabaseAdmin
      .from('at_setores')
      .update(updates)
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Setor nao encontrado' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await supabaseAdmin
    .from('at_setores')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
