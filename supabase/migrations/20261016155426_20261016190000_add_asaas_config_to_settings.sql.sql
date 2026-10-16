/*
# Add Asaas config fields to settings table

## Purpose
The settings table has no columns for storing Asaas API key and environment.
The Asaas client currently reads from env vars (ASAAS_API_KEY, ASAAS_ENV),
but the user needs to configure these from the settings UI.

## Changes
1. Add asaas_api_key text column (stores the Asaas API key)
2. Add asaas_sandbox boolean column (true = sandbox, false = production)
*/
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS asaas_api_key text,
  ADD COLUMN IF NOT EXISTS asaas_sandbox boolean DEFAULT true;
