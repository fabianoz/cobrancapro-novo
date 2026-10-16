import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { atendente_id } = await request.json();

    if (!atendente_id) {
      return NextResponse.json({ error: 'atendente_id obrigatorio' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('at_atendimentos')
      .update({
        status: 'em_atendimento',
        atendente_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Atendimento nao encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, atendimento: data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
