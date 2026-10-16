/*
# Fix billing_provider check constraint to allow ASAAS

## Purpose
The settings table has a CHECK constraint on billing_provider that only allows
'EFI', 'C6', and 'INTER'. The app already supports ASAAS as a provider, but the
database rejects it with: "new row violates check constraint settings_billing_provider_check".

## Changes
1. Drop the existing check constraint.
2. Recreate it including 'ASAAS'.
*/
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_billing_provider_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_billing_provider_check
  CHECK (billing_provider IN ('EFI', 'C6', 'INTER', 'ASAAS'));
