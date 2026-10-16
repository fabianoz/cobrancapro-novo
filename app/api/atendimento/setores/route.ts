import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('at_setores')
    .select('*')
    .order('ordem', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const { nome, ativo, ordem } = await request.json();

    if (!nome) {
      return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('at_setores')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrdem = ordem ?? (existing ? existing.ordem + 1 : 1);

    const { data, error } = await supabaseAdmin
      .from('at_setores')
      .insert({ nome, ativo: ativo ?? true, ordem: nextOrdem })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
