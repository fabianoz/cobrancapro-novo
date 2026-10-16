import type { BillingProvider, ChargeRequestData, ChargeResponse } from './types';
import { efiRequest, efiBoletoRequest, loadEfiConfig } from '@/lib/efi/auth';
import { criarBoleto } from '@/lib/efi/boleto';
import { criarPixImediato } from '@/lib/efi/pix';

/**
 * EFI Bank (Gerencianet) Billing Provider
 *
 * Usa os serviços em lib/efi/ para autenticação e criação de cobranças.
 * Mantém compatibilidade com a interface BillingProvider.
 */
export const efiProvider: BillingProvider = {
  async createCharge(data: ChargeRequestData): Promise<ChargeResponse> {
    const cfg = await loadEfiConfig();
    const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/efi`;

    // Cria boleto/bolix
    const boleto = await criarBoleto({
      customerName: data.customerName,
      customerCpfCnpj: data.customerCpfCnpj,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      valor: data.value,
      vencimento: data.dueDate,
      externalReference: data.externalReference,
      notificationUrl,
    });

    let pixQrCode = boleto.pixQrCode || '';
    let pixCopyPaste = boleto.pixCopyPaste || '';

    // Se tem pix_key configurada, cria também um Pix imediato
    if (cfg.pixKey && !pixCopyPaste) {
      try {
        const pix = await criarPixImediato({
          valor: data.value,
          nomePagador: data.customerName,
          cpfCnpjPagador: data.customerCpfCnpj,
          mensagem: `Cobrança ${data.externalReference}`,
        });
        pixCopyPaste = pix.pixCopiaECola;
        pixQrCode = pix.qrCodeBase64 || '';
      } catch {
        // Pix é opcional — boleto já foi criado
      }
    }

    return {
      externalId: boleto.chargeId,
      barcode: boleto.barcode,
      pixQrCode,
      pixCopyPaste,
      billetPdfUrl: boleto.pdf,
      paymentUrl: boleto.paymentUrl,
      status: 'PENDING',
    };
  },

  async getCharge(externalId: string): Promise<ChargeResponse> {
    // Se parece txid, consulta Pix; senão boleto
    if (externalId.length > 20 && /^[a-zA-Z0-9]+$/.test(externalId)) {
      const data = await efiRequest<any>(`/v2/cob/${externalId}`);
      return {
        externalId,
        barcode: '',
        pixQrCode: '',
        pixCopyPaste: data.pixCopiaECola || '',
        billetPdfUrl: '',
        paymentUrl: '',
        status: data.status === 'CONCLUIDA' ? 'PAID' : 'PENDING',
      };
    }

    const data = await efiBoletoRequest<any>(`/v1/charge/${externalId}`);
    const bb = data.data?.payment?.banking_billet || {};
    const links = data.data?.links || [];
    const status = data.data?.status;

    return {
      externalId,
      barcode: bb.barcode || '',
      pixQrCode: bb.pix_qr_code || '',
      pixCopyPaste: bb.pix_copy_and_paste || '',
      billetPdfUrl: bb.pdf || '',
      paymentUrl: links.find((l: { rel: string; href: string }) => l.rel === 'payment')?.href || '',
      status: status === 'paid' || status === 'settled' ? 'PAID' : 'PENDING',
    };
  },

  async cancelCharge(externalId: string): Promise<void> {
    await efiBoletoRequest(`/v1/charge/${externalId}/cancel`, { method: 'PUT' });
  },
};
