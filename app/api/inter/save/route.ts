export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { invalidateInterConfig } from '@/lib/inter/client';

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.clientId !== undefined) updateData.inter_client_id = body.clientId;
    if (body.clientSecret !== undefined) updateData.inter_client_secret = body.clientSecret;
    if (body.certBase64 !== undefined) updateData.inter_cert_base64 = body.certBase64;
    if (body.keyBase64 !== undefined) updateData.inter_key_base64 = body.keyBase64;
    if (body.sandbox !== undefined) updateData.inter_sandbox = body.sandbox;
    if (body.billingProvider !== undefined) updateData.billing_provider = body.billingProvider;

    const { error } = await supabaseAdmin
      .from('settings')
      .update(updateData)
      .eq('id', 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateInterConfig();
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
