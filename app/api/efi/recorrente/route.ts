import { NextResponse } from 'next/server';
import { criarRecorrencia, listarRecorrencias, consultarRecorrencia, encerrarRecorrencia } from '@/lib/efi/recorrente';
import { supabaseAdmin } from '@/lib/supabase';

/** Criar recorrência de Pix Automático */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { valor, nome, cpf, email, periodicidade, dataInicio, customerId } = body;

    if (!valor || !nome || !cpf || !dataInicio) {
      return NextResponse.json({ error: 'valor, nome, cpf e dataInicio são obrigatórios' }, { status: 400 });
    }

    const rec = await criarRecorrencia({
      valor: Number(valor),
      nomePagador: nome,
      cpfPagador: cpf,
      emailPagador: email,
      periodicidade: periodicidade || 'MENSAL',
      dataInicio,
    });

    // Salva no banco
    await supabaseAdmin.from('efi_recorrencias').insert({
      txid: rec.txid,
      status: 'ATIVA',
      periodicidade: periodicidade || 'MENSAL',
      valor: Number(valor),
      data_inicio: dataInicio,
      proxima_cobranca: rec.proximaCobranca || null,
      pagador_nome: nome,
      pagador_cpf: cpf.replace(/\D/g, ''),
      pagador_email: email || null,
      customer_id: customerId || null,
    });

    return NextResponse.json({ success: true, recorrencia: rec });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Listar ou consultar recorrências */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const rec = await consultarRecorrencia(id);
      return NextResponse.json(rec);
    }

    // Lista do banco
    const { data } = await supabaseAdmin
      .from('efi_recorrencias')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json(data || []);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Encerrar recorrência */
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    await encerrarRecorrencia(id);

    await supabaseAdmin
      .from('efi_recorrencias')
      .update({ status: 'ENCERRADA', updated_at: new Date().toISOString() })
      .eq('txid', id)
      .or(`id.eq.${id}`);

    return NextResponse.json({ success: true, message: 'Recorrência encerrada' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
