import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: { id_externo: string } }
) {
  const externalId = params.id_externo;
  if (!externalId) {
    return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
  }

  let { data: charge, error } = await supabaseAdmin
    .from('charges')
    .select('*, customer:customers(*)')
    .eq('external_id', externalId)
    .maybeSingle();

  if (!charge) {
    const r2 = await supabaseAdmin
      .from('charges')
      .select('*, customer:customers(*)')
      .eq('txid', externalId)
      .maybeSingle();
    charge = r2.data;
    error = r2.error;
  }

  if (!charge) {
    const r3 = await supabaseAdmin
      .from('charges')
      .select('*, customer:customers(*)')
      .eq('boleto_charge_id', externalId)
      .maybeSingle();
    charge = r3.data;
    error = r3.error;
  }

  if (error || !charge) {
    return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 });
  }

  const { data: issuer } = await supabaseAdmin
    .from('settings')
    .select('issuer_name, issuer_trade_name, issuer_cnpj, issuer_address, issuer_city, issuer_state, issuer_phone, issuer_email, issuer_logo_url')
    .eq('id', 1)
    .maybeSingle();

  return NextResponse.json({ charge, issuer });
}
