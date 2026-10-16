/**
 * gerarPixCobrancaPro — Helper principal que decide o tipo de cobrança
 *
 * Baseado no tipo, cria Pix Imediato, Bolix (boleto+pix) ou Carnê.
 * Integra com o banco de dados CobrancaPro (tabela charges).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { criarPixImediato } from './pix';
import { criarBoleto, criarCarnet } from './boleto';
import { isEfiConfigured } from './auth';

export type CobrancaTipo = 'PIX' | 'BOLIX' | 'CARNE';

export type GerarCobrancaInput = {
  valor: number;
  cliente: {
    nome: string;
    cpfCnpj: string;
    email?: string;
    telefone?: string;
  };
  tipo: CobrancaTipo;
  vencimento?: string;
  parcelas?: number;
  externalReference?: string;
  customerId?: string;
  mensagem?: string;
};

export type GerarCobrancaResult = {
  success: boolean;
  externalId: string;
  pixCopyPaste: string;
  pixQrCode: string;
  barcode: string;
  billetPdfUrl: string;
  paymentUrl: string;
  status: string;
  txid?: string;
  parcelas?: { parcela: number; valor: number; vencimento: string; pdf: string }[];
};

/**
 * Helper principal: decide se cria Pix ou Bolix baseado no tipo.
 *
 * - PIX: cobrança Pix imediata (sem vencimento, expira em 1h)
 * - BOLIX: boleto híbrido que já vem com QR Code Pix
 * - CARNE: carnê com múltiplas parcelas
 */
export async function gerarPixCobrancaPro(input: GerarCobrancaInput): Promise<GerarCobrancaResult> {
  const configured = await isEfiConfigured();
  if (!configured) {
    throw new Error('EFI Bank não configurado. Configure Client ID e Client Secret nas Configurações.');
  }

  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/efi`;

  if (input.tipo === 'PIX') {
    const pix = await criarPixImediato({
      valor: input.valor,
      nomePagador: input.cliente.nome,
      cpfCnpjPagador: input.cliente.cpfCnpj,
      mensagem: input.mensagem,
    });

    return {
      success: true,
      externalId: pix.txid,
      pixCopyPaste: pix.pixCopiaECola,
      pixQrCode: pix.qrCodeBase64 || '',
      barcode: '',
      billetPdfUrl: '',
      paymentUrl: '',
      status: 'ATIVA',
      txid: pix.txid,
    };
  }

  if (input.tipo === 'BOLIX') {
    const boleto = await criarBoleto({
      customerName: input.cliente.nome,
      customerCpfCnpj: input.cliente.cpfCnpj,
      customerEmail: input.cliente.email,
      customerPhone: input.cliente.telefone,
      valor: input.valor,
      vencimento: input.vencimento || new Date().toISOString().split('T')[0],
      externalReference: input.externalReference,
      notificationUrl,
      mensagem: input.mensagem,
    });

    return {
      success: true,
      externalId: boleto.chargeId,
      pixCopyPaste: boleto.pixCopyPaste || '',
      pixQrCode: boleto.pixQrCode || '',
      barcode: boleto.barcode,
      billetPdfUrl: boleto.pdf,
      paymentUrl: boleto.paymentUrl,
      status: boleto.status,
    };
  }

  if (input.tipo === 'CARNE') {
    const numParcelas = Math.max(2, Math.min(12, input.parcelas || 3));
    const carnet = await criarCarnet({
      customerName: input.cliente.nome,
      customerCpfCnpj: input.cliente.cpfCnpj,
      customerEmail: input.cliente.email,
      customerPhone: input.cliente.telefone,
      valorParcela: input.valor,
      primeiraParcela: input.valor,
      numeroParcelas: numParcelas,
      vencimentoPrimeira: input.vencimento || new Date().toISOString().split('T')[0],
      externalReference: input.externalReference,
    });

    return {
      success: true,
      externalId: carnet.carnetId,
      pixCopyPaste: '',
      pixQrCode: '',
      barcode: carnet.parcelas[0]?.barcode || '',
      billetPdfUrl: carnet.parcelas[0]?.pdf || '',
      paymentUrl: carnet.cover || '',
      status: carnet.status,
      parcelas: carnet.parcelas.map((p) => ({
        parcela: p.parcela,
        valor: p.valor,
        vencimento: p.expire_at,
        pdf: p.pdf,
      })),
    };
  }

  throw new Error(`Tipo de cobrança não suportado: ${input.tipo}`);
}

/**
 * Sincroniza o status de uma cobrança consultando a API Efí.
 * Atualiza o banco de dados se o status mudou.
 */
export async function sincronizarStatusCharge(chargeId: string, externalId: string): Promise<string> {
  const { consultarBoleto } = await import('./boleto');
  const { consultarPix } = await import('./pix');

  let newStatus = 'PENDING';

  try {
    // Se externalId parece txid (32+ chars alfanum), consulta Pix; senão boleto
    if (externalId.length > 20 && /^[a-zA-Z0-9]+$/.test(externalId)) {
      const pix = await consultarPix(externalId);
      if (pix.status === 'CONCLUIDA') newStatus = 'PAID';
      else if (pix.status === 'REMOVIDA_PELO_USUARIO_RECEBEDOR') newStatus = 'CANCELLED';
      else newStatus = 'PENDING';
    } else {
      const boleto = await consultarBoleto(externalId);
      if (boleto.status === 'paid' || boleto.status === 'settled') newStatus = 'PAID';
      else if (boleto.status === 'unpaid' || boleto.status === 'refunded') newStatus = 'CANCELLED';
      else newStatus = 'PENDING';
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'PAID') {
      updateData.paid_at = new Date().toISOString();
    }

    await supabaseAdmin.from('charges').update(updateData).eq('id', chargeId);

    return newStatus;
  } catch (err) {
    console.error(`[gerarPixCobrancaPro] Erro ao sincronizar ${externalId}:`, err);
    return 'PENDING';
  }
}
