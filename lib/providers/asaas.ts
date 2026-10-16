import type { BillingProvider, ChargeRequestData, ChargeResponse } from './types';
import { cancelAsaasCharge, createAsaasCharge, getAsaasCharge } from '@/lib/asaas/client';

export const asaasProvider: BillingProvider = {
  createCharge: (data: ChargeRequestData): Promise<ChargeResponse> => createAsaasCharge(data),
  getCharge: (externalId: string): Promise<ChargeResponse> => getAsaasCharge(externalId),
  cancelCharge: (externalId: string): Promise<void> => cancelAsaasCharge(externalId),
};
