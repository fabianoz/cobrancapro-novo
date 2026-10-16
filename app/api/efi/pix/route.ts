import { NextResponse } from 'next/server';
import { criarPixImediato, consultarPix, listarPixRecebidos } from '@/lib/efi/pix';
import { supabaseAdmin } from '@/lib/supabase';
import { sendNotification } from '@/lib/notifications';
import type { Charge, Customer } from '@/lib/supabase';

function getPublicUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.BOLT_PUBLIC_URL;
  if (configured) return configured;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return host ? `${proto}://${host}` : '';
}

/** Criar Pix imediato ou consultar/listar */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { valor, nome, cpfCnpj, mensagem, customerId } = body;

    if (!valor || !nome || !cpfCnpj) {
      return NextResponse.json({ error: 'valor, nome e cpfCnpj são obrigatórios' }, { status: 400 });
    }

    const pix = await criarPixImediato({
      valor: Number(valor),
      nomePagador: nome,
      cpfCnpjPagador: cpfCnpj,
      mensagem,
    });

    let charge: Charge | null = null;
    if (customerId) {
      const link = `${getPublicUrl(request)}/fatura/${pix.txid}`;
      const { data, error } = await supabaseAdmin
        .from('charges')
        .insert({
          customer_id: customerId,
          value: Number(valor),
          due_date: new Date().toISOString().split('T')[0],
          status: 'PENDING',
          provider: 'EFI',
          external_id: pix.txid,
          txid: pix.txid,
          pix_copy_paste: pix.pixCopiaECola,
          pix_qr_code: pix.qrCodeBase64,
          link_fatura_publica: link,
          charge_type: 'SALE',
          description: mensagem || 'Pix Imediato',
        })
        .select('*, customer:customers(*)')
        .single();

      if (error) return NextResponse.json({ error: 'Pix criado, mas não foi salvo no painel' }, { status: 500 });
      charge = data as Charge;

      if (charge.customer) {
        sendNotification(charge, charge.customer as Customer).catch((error: unknown) =>
          console.error('[Pix] Erro ao enviar link ao cliente:', error)
        );
      }
    }

    return NextResponse.json({ success: true, pix, charge });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const txid = searchParams.get('txid');
    if (txid) return NextResponse.json(await consultarPix(txid));
    return NextResponse.json(await listarPixRecebidos());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
