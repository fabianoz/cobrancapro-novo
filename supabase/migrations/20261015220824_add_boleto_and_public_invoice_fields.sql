-- Add boleto-specific fields, public invoice link, and payment details to charges
ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS boleto_charge_id text,
  ADD COLUMN IF NOT EXISTS boleto_linha text,
  ADD COLUMN IF NOT EXISTS boleto_status text,
  ADD COLUMN IF NOT EXISTS link_fatura_publica text,
  ADD COLUMN IF NOT EXISTS valor_pago numeric,
  ADD COLUMN IF NOT EXISTS data_pagamento timestamp with time zone;

-- Backfill boleto_linha from existing barcode_boleto
UPDATE charges SET boleto_linha = barcode_boleto WHERE barcode_boleto IS NOT NULL AND boleto_linha IS NULL;
UPDATE charges SET boleto_status = 'PENDING' WHERE boleto_charge_id IS NOT NULL AND boleto_status IS NULL;

-- Index for public invoice lookup by external_id
CREATE INDEX IF NOT EXISTS idx_charges_external_id ON charges(external_id);
