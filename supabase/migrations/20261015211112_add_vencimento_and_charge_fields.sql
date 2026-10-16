-- 1. Plans: add tipo_vencimento and dia_vencimento
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS tipo_vencimento text NOT NULL DEFAULT 'DIA_FIXO',
  ADD COLUMN IF NOT EXISTS dia_vencimento int;

-- Backfill dia_vencimento from existing due_day
UPDATE plans SET dia_vencimento = due_day WHERE dia_vencimento IS NULL;

-- 2. Subscriptions: rename start_date usage — add data_inicio (alias for start_date)
-- start_date already exists; we just use it as data_inicio in the app logic.
-- No schema change needed — start_date serves as data_inicio.

-- 3. Charges: add new fields for unified emission
ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS txid text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS barcode_boleto text,
  ADD COLUMN IF NOT EXISTS boleto_url text;

-- Backfill barcode_boleto from existing barcode
UPDATE charges SET barcode_boleto = barcode WHERE barcode IS NOT NULL AND barcode_boleto IS NULL;
UPDATE charges SET boleto_url = billet_pdf_url WHERE billet_pdf_url IS NOT NULL AND boleto_url IS NULL;

-- 4. Settings: add message templates
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS template_faturar text DEFAULT 'Olá {nome}, sua cobrança do mês de {mes} referente ao plano {plano} no valor de {valor} já está disponível para pagamento. Vencimento {data_vencimento}. Segue o Pix: {pix} ou Boleto: {boleto}',
  ADD COLUMN IF NOT EXISTS template_lembrete_d3 text DEFAULT 'Olá {nome}, lembrete amigável: sua cobrança de {valor} vence em {data_vencimento}. Pague via Pix: {pix} ou pelo link: {link}',
  ADD COLUMN IF NOT EXISTS template_lembrete_d0 text DEFAULT 'Olá {nome}, sua cobrança de {valor} vence hoje! Pague agora via Pix: {pix} ou pelo link: {link}',
  ADD COLUMN IF NOT EXISTS template_lembrete_d1 text DEFAULT 'Olá {nome}, sua cobrança de {valor} venceu ontem. Regularize agora via Pix: {pix} ou pelo link: {link}',
  ADD COLUMN IF NOT EXISTS template_lembrete_d3_pos text DEFAULT 'Olá {nome}, sua cobrança de {valor} está 3 dias atrasada. Regularize via Pix: {pix} ou pelo link: {link}',
  ADD COLUMN IF NOT EXISTS template_lembrete_d7_pos text DEFAULT 'Olá {nome}, sua cobrança de {valor} está 7 dias atrasada. Evite negativação — regularize via Pix: {pix} ou pelo link: {link}',
  ADD COLUMN IF NOT EXISTS template_pago text DEFAULT 'Pagamento confirmado! Recebemos {valor}. Obrigado, {nome}!';

-- Index for polling efficiency
CREATE INDEX IF NOT EXISTS idx_charges_created_at ON charges(created_at DESC);
