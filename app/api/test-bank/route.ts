export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { authenticate, loadEfiConfig, invalidateConfig, invalidateToken } from '@/lib/efi/auth';
import { loadInterConfig, getInterToken } from '@/lib/inter/client';
import { testAsaasConnection } from '@/lib/asaas/client';

export async function POST() {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('billing_provider')
      .eq('id', 1)
      .maybeSingle();

    const provider = settings?.billing_provider || 'EFI';

    if (provider === 'ASAAS') {
      const result = await testAsaasConnection();
      return NextResponse.json({
        success: true,
        provider: 'Asaas',
        message: `Conexão Asaas OK — ambiente: ${result.environment} | Conta: ${result.accountEmail}`,
      });
    }

    if (provider === 'INTER') {
      const cfg = await loadInterConfig();
      if (!cfg.clientId || !cfg.clientSecret) {
        return NextResponse.json({
          success: false,
          provider: 'Banco Inter',
          message: 'Client ID e Client Secret do Inter não configurados',
        }, { status: 400 });
      }
      if (!cfg.certBase64 || !cfg.keyBase64) {
        return NextResponse.json({
          success: false,
          provider: 'Banco Inter',
          message: 'Certificado .crt e chave .key do Inter não carregados',
        }, { status: 400 });
      }
      const token = await getInterToken();
      return NextResponse.json({
        success: true,
        provider: 'Banco Inter',
        message: `Conexão Banco Inter OK — token obtido (${token.substring(0, 20)}...)`,
      });
    }

    // EFI (default)
    invalidateConfig();
    invalidateToken();
    const cfg = await loadEfiConfig();
    if (!cfg.clientId || !cfg.clientSecret) {
      return NextResponse.json({
        success: false,
        provider: 'Efí Bank',
        message: 'Client ID e Client Secret não configurados',
      }, { status: 400 });
    }
    const token = await authenticate();
    let certSize = 0;
    if (cfg.certificateBase64) {
      certSize = Buffer.from(cfg.certificateBase64, 'base64').length;
    }
    return NextResponse.json({
      success: true,
      provider: 'Efí Bank',
      message: `Conexão OK — ambiente: ${cfg.sandbox ? 'Homologação' : 'Produção'}` +
        (certSize > 0 ? ` | Certificado: ${certSize} bytes` : ' | Sem certificado'),
      hasPixKey: !!cfg.pixKey,
      hasCertificate: certSize > 0,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('billing_provider')
      .eq('id', 1)
      .maybeSingle();
    const providerName = settings?.billing_provider === 'ASAAS' ? 'Asaas' : settings?.billing_provider === 'INTER' ? 'Banco Inter' : 'Efí Bank';
    return NextResponse.json({
      success: false,
      provider: providerName,
      message: msg,
    }, { status: 500 });
  }
}
