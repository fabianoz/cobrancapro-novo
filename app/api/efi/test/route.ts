export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { authenticate, loadEfiConfig, invalidateConfig, invalidateToken } from '@/lib/efi/auth';
import { getSupabaseAdmin } from '@/lib/supabase/api';

/** Testa a conexão com a API Efí Bank */
export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json().catch(() => ({}));

    // Se recebeu credenciais reais (não vazias/mascaradas), salva no banco
    // Só atualiza campos que vieram com valores válidos — nunca sobrescreve com vazio
    if (body.clientId || body.clientSecret) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.clientId && typeof body.clientId === 'string'
          && !body.clientId.includes('•') && !body.clientId.includes('....')
          && body.clientId.trim().length > 10) {
        updates.efi_client_id = body.clientId.trim();
      }

      if (body.clientSecret && typeof body.clientSecret === 'string'
          && !body.clientSecret.includes('•') && !body.clientSecret.includes('....')
          && body.clientSecret.trim().length > 10) {
        updates.efi_client_secret = body.clientSecret.trim();
      }

      if (body.pixKey !== undefined) {
        updates.efi_pix_key = body.pixKey?.trim() || null;
      }

      if (body.certificateBase64 && typeof body.certificateBase64 === 'string'
          && body.certificateBase64.length > 200) {
        updates.efi_certificate_base64 = body.certificateBase64;
      }

      if (body.sandbox !== undefined) {
        updates.efi_sandbox = !!body.sandbox;
      }

      const keys = Object.keys(updates);
      if (keys.length > 1) {
        await supabaseAdmin.from('settings').update(updates).eq('id', 1);
      }
    }

    // Invalida cache de config antes de ler, para pegar os dados atualizados
    invalidateConfig();
    invalidateToken();

    const cfg = await loadEfiConfig();
    if (!cfg.clientId || !cfg.clientSecret) {
      return NextResponse.json({
        success: false,
        message: 'Client ID e Client Secret não configurados',
      }, { status: 400 });
    }

    // Tenta autenticar
    const token = await authenticate();

    let certSize = 0;
    if (cfg.certificateBase64) {
      certSize = Buffer.from(cfg.certificateBase64, 'base64').length;
    }

    return NextResponse.json({
      success: true,
      message: `Conexão OK — ambiente: ${cfg.sandbox ? 'Homologação' : 'Produção'}` +
        (certSize > 0 ? ` | Certificado: ${certSize} bytes` : ' | Sem certificado'),
      environment: cfg.sandbox ? 'sandbox' : 'production',
      hasPixKey: !!cfg.pixKey,
      hasCertificate: certSize > 0,
      certificateSize: certSize,
      tokenPreview: token.substring(0, 10) + '...',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
