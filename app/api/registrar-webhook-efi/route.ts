import { NextResponse } from 'next/server';
import { authenticate, loadEfiConfig, efiFetch } from '@/lib/efi/auth';

/**
 * Rota temporária: GET /api/registrar-webhook-efi
 *
 * Cadastra o webhook de Pix na Efí para receber notificações de pagamento.
 * Usa PUT /v2/webhook/{chave} com mTLS (certificado .p12 do banco).
 */
export async function GET() {
  try {
    const cfg = await loadEfiConfig();

    if (!cfg.clientId || !cfg.clientSecret) {
      return NextResponse.json(
        { success: false, error: 'Client ID e Client Secret não configurados' },
        { status: 400 }
      );
    }

    if (!cfg.pixKey) {
      return NextResponse.json(
        { success: false, error: 'Chave Pix não configurada' },
        { status: 400 }
      );
    }

    if (!cfg.certificateBase64) {
      return NextResponse.json(
        { success: false, error: 'Certificado .p12 não encontrado no banco' },
        { status: 400 }
      );
    }

    const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BOLT_PUBLIC_URL || '';
    if (!publicUrl) {
      return NextResponse.json(
        { success: false, error: 'NEXT_PUBLIC_APP_URL não configurada — necessário para URL pública do webhook' },
        { status: 400 }
      );
    }

    const webhookUrl = `${publicUrl}/api/webhooks/efi`;
    console.log('[Registrar Webhook] Iniciando cadastro...');
    console.log('[Registrar Webhook] Chave Pix:', cfg.pixKey);
    console.log('[Registrar Webhook] Webhook URL:', webhookUrl);
    console.log('[Registrar Webhook] Ambiente:', cfg.sandbox ? 'Homologação' : 'Produção');
    console.log('[Registrar Webhook] Certificado:', cfg.certificateBase64 ? `${cfg.certificateBase64.length} chars base64` : 'nenhum');

    // Autentica para pegar o token
    const token = await authenticate();
    console.log('[Registrar Webhook] Token obtido com sucesso');

    // PUT /v2/webhook/{chave} — cadastra a URL do webhook
    const baseUrl = cfg.sandbox ? 'https://sandbox.pix.api.efipay.com.br' : 'https://pix.api.efipay.com.br';
    const webhookPath = `/v2/webhook/${encodeURIComponent(cfg.pixKey)}`;

    console.log('[Registrar Webhook] Enviando PUT para:', `${baseUrl}${webhookPath}`);

    const response = await efiFetch(webhookPath, {
      method: 'PUT',
      body: JSON.stringify({ webhookUrl }),
    });

    const responseText = await response.text();
    console.log('[Registrar Webhook] Status:', response.status);
    console.log('[Registrar Webhook] Resposta:', responseText);

    if (!response.ok) {
      let errMsg = responseText;
      try {
        const errJson = JSON.parse(responseText);
        errMsg = errJson.error_description || errJson.error || errJson.mensagem || responseText;
      } catch {
        // mantém text
      }
      return NextResponse.json(
        { success: false, error: `Efí retornou ${response.status}: ${errMsg}` },
        { status: 500 }
      );
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // resposta pode ser vazia
    }

    console.log('[Registrar Webhook] Webhook cadastrado com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Webhook cadastrado com sucesso na Efí',
      webhookUrl,
      pixKey: cfg.pixKey,
      environment: cfg.sandbox ? 'Homologação' : 'Produção',
      response: parsed,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Registrar Webhook] Erro:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
