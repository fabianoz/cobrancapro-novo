/**
 * EfiPixService — Cobrança Pix Imediata e Pix com Vencimento
 *
 * Endpoints:
 * - POST /v2/cob              -> Pix imediato
 * - GET  /v2/cob/:txid        -> Consultar cobrança
 * - GET  /v2/pix              -> Listar Pix recebidos
 * - POST /v2/loc              -> Criar location para QR Code
 * - GET  /v2/loc/:id/qrcode   -> Imagem QR Code
 */

import { efiRequest, efiFetch, loadEfiConfig } from './auth';

export type PixCobrancaInput = {
  valor: number;
  nomePagador: string;
  cpfCnpjPagador: string;
  mensagem?: string;
  expiracao?: number; // segundos, default 3600
};

export type PixCobrancaResponse = {
  txid: string;
  status: string;
  pixCopiaECola: string;
  qrCodeBase64?: string;
  valor: number;
  calendario?: { criacao: string; expiracao: number };
};

export type PixRecebido = {
  endToEndId: string;
  txid: string;
  valor: number;
  horario: string;
  pagador: { nome: string; cpf?: string; cnpj?: string };
};

/** Cria uma cobrança Pix imediata (POST /v2/cob) */
export async function criarPixImediato(input: PixCobrancaInput): Promise<PixCobrancaResponse> {
  const cfg = await loadEfiConfig();
  if (!cfg.pixKey) {
    throw new Error('EFI: pix_key não configurada');
  }

  const cpfCnpj = input.cpfCnpjPagador.replace(/\D/g, '');
  const isCpf = cpfCnpj.length === 11;

  const body = {
    calendario: { expiracao: input.expiracao || 3600 },
    valor: { original: input.valor.toFixed(2) },
    chave: cfg.pixKey,
    solicitacaoPagador: input.mensagem || 'Cobrança CobrancaPro',
    devedor: {
      nome: input.nomePagador.substring(0, 30),
      ...(isCpf ? { cpf: cpfCnpj } : { cnpj: cpfCnpj }),
    },
  };

  const data = await efiRequest<any>('/v2/cob', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  let qrCodeBase64 = '';
  let pixCopiaECola = data.pixCopiaECola || data.qrcode || '';

  // Tenta buscar a imagem do QR Code via location
  if (data.loc?.id) {
    try {
      const qrRes = await efiFetch(`/v2/loc/${data.loc.id}/qrcode`);
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        qrCodeBase64 = qrData.imagemQrcode || '';
        pixCopiaECola = pixCopiaECola || qrData.qrcode || qrData.pixCopiaECola || '';
      }
    } catch {
      // QR Code image é opcional — o copia e cola já funciona
    }
  }

  return {
    txid: data.txid,
    status: data.status,
    pixCopiaECola,
    qrCodeBase64,
    valor: input.valor,
    calendario: data.calendario,
  };
}

/** Consulta uma cobrança Pix por txid (GET /v2/cob/:txid) */
export async function consultarPix(txid: string): Promise<PixCobrancaResponse> {
  const data = await efiRequest<any>(`/v2/cob/${txid}`);

  return {
    txid: data.txid,
    status: data.status,
    pixCopiaECola: data.pixCopiaECola || '',
    qrCodeBase64: '',
    valor: data.valor?.original ? parseFloat(data.valor.original) : 0,
    calendario: data.calendario,
  };
}

/** Lista Pix recebidos (GET /v2/pix) */
export async function listarPixRecebidos(params?: {
  inicio?: string;
  fim?: string;
  txid?: string;
}): Promise<PixRecebido[]> {
  const now = new Date();
  const inicio = params?.inicio || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const fim = params?.fim || now.toISOString();

  let path = `/v2/pix?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
  if (params?.txid) path += `&txid=${encodeURIComponent(params.txid)}`;

  const data = await efiRequest<any>(path);

  return (data.pix || []) as PixRecebido[];
}

/** Cadastra webhook para receber notificações de Pix (POST /v2/webhook/:chave) */
export async function cadastrarWebhookPix(chave: string, webhookUrl: string): Promise<void> {
  await efiRequest('/v2/webhook/' + encodeURIComponent(chave), {
    method: 'POST',
    body: JSON.stringify({ webhookUrl }),
  });
}
