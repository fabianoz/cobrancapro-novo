import type { BillingProvider } from './types';
import { efiProvider } from './efi';
import { interProvider } from './inter';
import { asaasProvider } from './asaas';

export type { BillingProvider, ChargeRequestData, ChargeResponse } from './types';
export type ProviderName = 'EFI' | 'C6' | 'INTER' | 'ASAAS';

export function getProvider(name?: string): BillingProvider {
  if (name === 'INTER') return interProvider;
  if (name === 'ASAAS') return asaasProvider;
  return efiProvider;
}
