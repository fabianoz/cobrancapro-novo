export interface ChargeRequestData {
  customerName: string;
  customerCpfCnpj: string;
  customerEmail: string;
  customerPhone: string;
  value: number;
  dueDate: string;
  externalReference: string;
}

export interface ChargeResponse {
  externalId: string;
  barcode: string;
  pixQrCode: string;
  pixCopyPaste: string;
  billetPdfUrl: string;
  paymentUrl: string;
  status: string;
}

export interface BillingProvider {
  createCharge(data: ChargeRequestData): Promise<ChargeResponse>;
  getCharge(externalId: string): Promise<ChargeResponse>;
  cancelCharge(externalId: string): Promise<void>;
}
