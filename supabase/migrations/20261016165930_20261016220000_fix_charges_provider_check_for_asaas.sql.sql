/*
# Fix charges_provider_check to allow ASAAS

## Purpose
The charges table has a CHECK constraint on the provider column that only
allows 'EFI', 'C6', and 'INTER'. Since ASAAS is now a supported billing
provider, saving a charge with provider='ASAAS' fails with:
"new row for relation charges violates check constraint charges_provider_check"

## Changes
1. Drop the existing check constraint.
2. Recreate it including 'ASAAS'.
*/
ALTER TABLE public.charges DROP CONSTRAINT IF EXISTS charges_provider_check;

ALTER TABLE public.charges
  ADD CONSTRAINT charges_provider_check
  CHECK (provider IN ('EFI', 'C6', 'INTER', 'ASAAS'));
