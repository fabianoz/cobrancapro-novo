export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { invalidateConfig, invalidateToken } from '@/lib/efi/auth';

/**
 * Saves EFI settings to the database.
 * Only updates fields that are present and non-empty — never overwrites
 * existing credentials with empty/masked values.
 */
export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json().catch(() => ({}));

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only update client_id if it's a real value (not masked, not empty)
    if (body.clientId && typeof body.clientId === 'string'
        && !body.clientId.includes('•') && !body.clientId.includes('....')
        && body.clientId.trim().length > 10) {
      updates.efi_client_id = body.clientId.trim();
    }

    // Only update client_secret if the user typed a new one
    if (body.clientSecret && typeof body.clientSecret === 'string'
        && !body.clientSecret.includes('•') && !body.clientSecret.includes('....')
        && body.clientSecret.trim().length > 10) {
      updates.efi_client_secret = body.clientSecret.trim();
    }

    // Pix key — always update if provided (it's not sensitive)
    if (body.pixKey !== undefined) {
      updates.efi_pix_key = body.pixKey?.trim() || null;
    }

    // Certificate — only update if a new one was uploaded
    if (body.certificateBase64 && typeof body.certificateBase64 === 'string'
        && body.certificateBase64.length > 200) {
      updates.efi_certificate_base64 = body.certificateBase64;
    }

    // Sandbox flag
    if (body.sandbox !== undefined) {
      updates.efi_sandbox = !!body.sandbox;
    }

    const { error } = await supabaseAdmin
      .from('settings')
      .update(updates)
      .eq('id', 1);

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Erro ao salvar: ' + error.message },
        { status: 500 }
      );
    }

    invalidateConfig();
    invalidateToken();

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
