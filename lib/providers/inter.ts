import type { BillingProvider, ChargeRequestData, ChargeResponse } from './types';
import { createInterCharge, getInterCharge, cancelInterCharge, loadInterConfig } from '@/lib/inter/client';

export const interProvider: BillingProvider = {
  async createCharge(data: ChargeRequestData): Promise<ChargeResponse> {
    const cfg = await loadInterConfig();

    const charge = await createInterCharge({
      seuNumero: data.externalReference,
      valor: data.value,
      vencimento: data.dueDate,
      pagador: {
        cpfCnpj: data.customerCpfCnpj,
        nome: data.customerName,
        email: data.customerEmail || undefined,
      },
      mensagem: `Cobrança ${data.externalReference}`,
    });

    return {
      externalId: charge.codigoSolicitacao,
      barcode: charge.linhaDigitavel,
      pixQrCode: '',
      pixCopyPaste: charge.pixCopiaECola,
      billetPdfUrl: charge.pdfUrl,
      paymentUrl: '',
      status: 'PENDING',
    };
  },

  async getCharge(externalId: string): Promise<ChargeResponse> {
    const charge = await getInterCharge(externalId);

    return {
      externalId,
      barcode: charge.linhaDigitavel,
      pixQrCode: '',
      pixCopyPaste: charge.pixCopiaECola,
      billetPdfUrl: charge.pdfUrl,
      paymentUrl: '',
      status: charge.situacao === 'PAGO' ? 'PAID' : 'PENDING',
    };
  },

  async cancelCharge(externalId: string): Promise<void> {
    await cancelInterCharge(externalId);
  },
};
