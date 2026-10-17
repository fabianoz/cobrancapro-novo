export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { criarCarnet, cancelarCarnet } from '@/lib/efi/boleto';
import { getSupabaseAdmin } from '@/lib/supabase/api';

/** Criar carnê */
export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();
    const { valor, nome, cpfCnpj, email, telefone, vencimento, parcelas, customerId } = body;

    if (!valor || !nome || !cpfCnpj || !vencimento || !parcelas) {
      return NextResponse.json({ error: 'valor, nome, cpfCnpj, vencimento e parcelas são obrigatórios' }, { status: 400 });
    }

    const carnet = await criarCarnet({
      customerName: nome,
      customerCpfCnpj: cpfCnpj,
      customerEmail: email,
      customerPhone: telefone,
      valorParcela: Number(valor),
      primeiraParcela: Number(valor),
      numeroParcelas: Number(parcelas),
      vencimentoPrimeira: vencimento,
      externalReference: `CARNE${Date.now()}`,
    });

    // Salva cada parcela no banco
    if (customerId && carnet.parcelas.length > 0) {
      const charges = carnet.parcelas.map((p) => ({
        customer_id: customerId,
        value: p.valor,
        due_date: p.expire_at,
        status: 'PENDING',
        provider: 'EFI',
        external_id: carnet.carnetId,
        barcode: p.barcode,
        billet_pdf_url: p.pdf,
        charge_type: 'SALE' as const,
        description: `Carnê parcela ${p.parcela}`,
      }));
      await supabaseAdmin.from('charges').insert(charges);
    }

    return NextResponse.json({ success: true, carnet });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Cancelar carnê */
export async function PUT(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const { searchParams } = new URL(request.url);
    const carnetId = searchParams.get('id');

    if (!carnetId) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    await cancelarCarnet(carnetId);

    await supabaseAdmin
      .from('charges')
      .update({ status: 'CANCELLED' })
      .eq('external_id', carnetId);

    return NextResponse.json({ success: true, message: 'Carnê cancelado' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
