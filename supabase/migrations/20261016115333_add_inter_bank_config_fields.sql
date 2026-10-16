/*
# Add Banco Inter configuration fields to settings

## Purpose
Adds columns to the `settings` table to store Banco Inter API credentials,
enabling a second billing provider alongside the existing Efí integration.
Efí remains the default; Inter is opt-in via a `billing_provider` selector.

## Changes
1. New columns on `settings`:
   - `inter_client_id` (text) — Banco Inter OAuth client_id
   - `inter_client_secret` (text) — Banco Inter OAuth client_secret
   - `inter_cert_base64` (text) — Base64-encoded .crt certificate
   - `inter_key_base64` (text) — Base64-encoded .key private key
   - `inter_sandbox` (boolean, default false) — Toggle sandbox/production

2. Alter `billing_provider` constraint to accept 'INTER' in addition to 'EFI' and 'C6'.

3. Alter `charges.provider` constraint to accept 'INTER'.

## Security
- No new tables; RLS already enabled on `settings`.
- No policy changes needed — existing policies cover the new columns.
- Credentials are stored as text (same pattern as existing Efí fields).
*/

DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS inter_client_id text;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS inter_client_secret text;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS inter_cert_base64 text;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS inter_key_base64 text;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS inter_sandbox boolean DEFAULT false;
END $$;

-- Update billing_provider constraint to accept INTER
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_billing_provider_check;
ALTER TABLE settings ADD CONSTRAINT settings_billing_provider_check
  CHECK (billing_provider IN ('EFI', 'C6', 'INTER'));

-- Update charges.provider constraint to accept INTER
ALTER TABLE charges DROP CONSTRAINT IF EXISTS charges_provider_check;
ALTER TABLE charges ADD CONSTRAINT charges_provider_check
  CHECK (provider IN ('EFI', 'C6', 'INTER'));
