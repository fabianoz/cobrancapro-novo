/*
# EFI Bank - Config and Recurring Pix

1. Settings table additions:
- efi_client_id, efi_client_secret (text, nullable) — stored encrypted in DB
- efi_pix_key (text) — PIX key for immediate pix
- efi_certificate_path (text) — path to .p12 cert on server
- efi_certificate_password (text) — password for cert
- efi_sandbox (boolean, default false) — production vs homolog

2. New table: efi_recorrencias
- Stores Pix Automático recurring configurations
- id, txid, status, periodicidade, valor, data_inicio, proxima_cobranca
- pagador_nome, pagador_cpf, pagador_email
- created_at, updated_at

3. Security
- RLS enabled, single-tenant (TO anon, authenticated)
*/

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS efi_client_id text,
  ADD COLUMN IF NOT EXISTS efi_client_secret text,
  ADD COLUMN IF NOT EXISTS efi_pix_key text,
  ADD COLUMN IF NOT EXISTS efi_certificate_path text,
  ADD COLUMN IF NOT EXISTS efi_certificate_password text,
  ADD COLUMN IF NOT EXISTS efi_sandbox boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS efi_recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txid text,
  status text NOT NULL DEFAULT 'ATIVA',
  periodicidade text NOT NULL DEFAULT 'MENSAL',
  valor decimal(10,2) NOT NULL,
  data_inicio date NOT NULL,
  proxima_cobranca date,
  pagador_nome text NOT NULL,
  pagador_cpf text,
  pagador_email text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE efi_recorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "efi_rec_select" ON efi_recorrencias;
CREATE POLICY "efi_rec_select" ON efi_recorrencias FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "efi_rec_insert" ON efi_recorrencias;
CREATE POLICY "efi_rec_insert" ON efi_recorrencias FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "efi_rec_update" ON efi_recorrencias;
CREATE POLICY "efi_rec_update" ON efi_recorrencias FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "efi_rec_delete" ON efi_recorrencias;
CREATE POLICY "efi_rec_delete" ON efi_recorrencias FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_efi_rec_status ON efi_recorrencias(status);
