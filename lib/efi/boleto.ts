/**
 * EfiBoletoService — Boleto, Bolix (boleto+pix) e Carnê
 *
 * Endpoints:
 * - POST /v1/charge           -> Criar cobrança (boleto/bolix)
 * - POST /v1/charge/:id/cancel-> Cancelar cobrança
 * - GET  /v1/charge/:id       -> Detalhar cobrança
 * - GET  /v1/charge/:id/pdf   -> PDF do boleto
 * - POST /v1/carnet           -> Criar carnê
 * - GET  /v1/carnet/:id       -> Detalhar carnê
 * - PUT  /v1/carnet/:id/cancel-> Cancelar carnê
 */

import { efiBoletoRequest, efiBoletoFetch } from './auth';

export type BoletoInput = {
  customerName: string;
  customerCpfCnpj: string;
  customerEmail?: string;
  customerPhone?: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  juros?: number; // % ao dia
  multa?: number; // % sobre valor
  desconto?: { valor: number; vencimento: string };
  mensagem?: string;
  externalReference?: string;
  notificationUrl?: string;
};

export type BoletoResponse = {
  chargeId: string;
  status: string;
  barcode: string;
  pdf: string;
  pixCopyPaste?: string;
  pixQrCode?: string;
  paymentUrl: string;
  links: { rel: string; href: string; method: string }[];
};

/** Cria um boleto ou bolix (boleto híbrido com QR Code Pix) */
export async function criarBoleto(input: BoletoInput): Promise<BoletoResponse> {
  const cpfCnpj = (input.customerCpfCnpj || '').replace(/\D/g, '');
  const valorCentavos = Math.round(input.valor * 100);

  console.log('=== INICIANDO GERAÇÃO BOLETO EFI ===');
  console.log('[Boleto] Cliente:', input.customerName);
  console.log('[Boleto] CPF/CNPJ raw:', input.customerCpfCnpj, '→ limpo:', cpfCnpj, `(${cpfCnpj.length} dígitos)`);
  console.log('[Boleto] Valor em centavos:', valorCentavos, '(R$', input.valor, ')');
  console.log('[Boleto] Vencimento:', input.vencimento);

  if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    console.warn('[Boleto] AVISO: CPF/CNPJ inválido ou ausente para', input.customerName, '— CPF recebido:', input.customerCpfCnpj);
    throw new Error(
      `Cliente "${input.customerName}" sem CPF/CNPJ válido. ` +
      `O boleto bancário exige CPF (11 dígitos) ou CNPJ (14 dígitos). ` +
      `Cadastre o documento do cliente antes de emitir boleto.`
    );
  }

  const body: Record<string, unknown> = {
    items: [
      {
        name: input.mensagem || 'Cobrança CobrancaPro',
        value: valorCentavos,
        amount: 1,
      },
    ],
    payment: {
      banking_billet: {
        expire_at: input.vencimento,
        customer: {
          name: input.customerName,
          cpf: cpfCnpj.length === 11 ? cpfCnpj : undefined,
          cnpj: cpfCnpj.length === 14 ? cpfCnpj : undefined,
          email: input.customerEmail || undefined,
          phone_number: input.customerPhone || undefined,
        },
        configurations: {
          fine: 200,
          interest: 33,
        },
        ...(input.desconto ? {
          discount: {
            value: Math.round(input.desconto.valor * 100),
            expire_at: input.desconto.vencimento,
          },
        } : {}),
        message: input.mensagem || undefined,
      },
    },
    metadata: {
      custom_id: input.externalReference,
      notification_url: input.notificationUrl,
    },
  };

  const cleanBody = JSON.parse(JSON.stringify(body));
  console.log('[Boleto] Body enviado à Efí:', JSON.stringify(cleanBody, null, 2));

  const data = await efiBoletoRequest<any>('/v1/charge', {
    method: 'POST',
    body: JSON.stringify(cleanBody),
  });

  console.log('[Boleto] Resposta Efí completa:', JSON.stringify(data, null, 2));

  const bb = data.data?.payment?.banking_billet || {};
  const links = data.data?.links || [];

  const result: BoletoResponse = {
    chargeId: String(data.data?.charge_id || data.data?.id || data.charge_id || ''),
    status: data.data?.status || 'pending',
    barcode: bb.barcode || '',
    pdf: bb.pdf || '',
    pixCopyPaste: bb.pix_copy_and_paste || '',
    pixQrCode: bb.pix_qr_code || '',
    paymentUrl: links.find((l: any) => l.rel === 'payment')?.href || '',
    links,
  };

  console.log('[Boleto] Resultado — chargeId:', result.chargeId, '| barcode:', result.barcode ? 'OK' : 'VAZIO', '| pdf:', result.pdf ? 'OK' : 'VAZIO');
  console.log('=== BOLETO EFI GERADO COM SUCESSO ===');
  return result;
}

/** Consulta detalhes de uma cobrança (GET /v1/charge/:id) */
export async function consultarBoleto(chargeId: string): Promise<BoletoResponse> {
  const data = await efiBoletoRequest<any>(`/v1/charge/${chargeId}`);

  const bb = data.data?.payment?.banking_billet || {};
  const links = data.data?.links || [];

  return {
    chargeId: String(data.data?.charge_id || chargeId),
    status: data.data?.status || 'unknown',
    barcode: bb.barcode || '',
    pdf: bb.pdf || '',
    pixCopyPaste: bb.pix_copy_and_paste || '',
    pixQrCode: bb.pix_qr_code || '',
    paymentUrl: links.find((l: any) => l.rel === 'payment')?.href || '',
    links,
  };
}

/** Cancela uma cobrança (PUT /v1/charge/:id/cancel) */
export async function cancelarBoleto(chargeId: string): Promise<void> {
  await efiBoletoRequest(`/v1/charge/${chargeId}/cancel`, { method: 'PUT' });
}

/** Baixa o PDF do boleto (GET /v1/charge/:id/pdf) — retorna base64 */
export async function baixarPdfBoleto(chargeId: string): Promise<string> {
  const response = await efiBoletoFetch(`/v1/charge/${chargeId}/pdf`);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`EFI PDF: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.data?.pdf || data.pdf || '';
}

// --- CARNÊ ---

export type CarnetInput = {
  customerName: string;
  customerCpfCnpj: string;
  customerEmail?: string;
  customerPhone?: string;
  valorParcela: number;
  primeiraParcela: number;
  numeroParcelas: number;
  vencimentoPrimeira: string;
  externalReference?: string;
};

export type CarnetResponse = {
  carnetId: string;
  status: string;
  cover: string;
  parcelas: { parcela: number; valor: number; expire_at: string; barcode: string; pdf: string }[];
};

/** Cria um carnê (POST /v1/carnet) */
export async function criarCarnet(input: CarnetInput): Promise<CarnetResponse> {
  const cpfCnpj = input.customerCpfCnpj.replace(/\D/g, '');

  const body = {
    items: [
      {
        name: 'Carnê CobrancaPro',
        value: Math.round(input.valorParcela * 100),
      },
    ],
    customer: {
      name: input.customerName,
      cpf: cpfCnpj.length === 11 ? cpfCnpj : undefined,
      cnpj: cpfCnpj.length === 14 ? cpfCnpj : undefined,
      email: input.customerEmail || undefined,
      phone_number: input.customerPhone || undefined,
    },
    expire_at: input.vencimentoPrimeira,
    repeat: input.numeroParcelas - 1,
    split_items: false,
    metadata: {
      custom_id: input.externalReference,
    },
  };

  const cleanBody = JSON.parse(JSON.stringify(body));

  const data = await efiBoletoRequest<any>('/v1/carnet', {
    method: 'POST',
    body: JSON.stringify(cleanBody),
  });

  const parcelas = (data.data?.charges || []).map((c: any) => ({
    parcela: c.parcela || 0,
    valor: c.value / 100,
    expire_at: c.expire_at || '',
    barcode: c.payment?.banking_billet?.barcode || c.barcode || '',
    pdf: c.payment?.banking_billet?.pdf || c.pdf || '',
  }));

  return {
    carnetId: String(data.data?.carnet_id || data.carnet_id),
    status: data.data?.status || 'active',
    cover: data.data?.cover || '',
    parcelas,
  };
}

/** Cancela um carnê inteiro (PUT /v1/carnet/:id/cancel) */
export async function cancelarCarnet(carnetId: string): Promise<void> {
  await efiBoletoRequest(`/v1/carnet/${carnetId}/cancel`, { method: 'PUT' });
}
