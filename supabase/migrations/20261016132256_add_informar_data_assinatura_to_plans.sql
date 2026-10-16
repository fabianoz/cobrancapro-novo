/*
# Add informar_data_assinatura to plans

## Purpose
Adds a boolean column to `plans` so that when creating a subscription,
the system knows whether to ask the user for a custom billing date
or just use the plan's fixed due day.

## Changes
1. New column on `plans`:
   - `informar_data_assinatura` (boolean, default false)
     When true: the subscription form shows a date picker so the user can
     set a custom billing start date (for personalized contracts).
     When false: the system uses the plan's fixed due day automatically.
*/

ALTER TABLE plans ADD COLUMN IF NOT EXISTS informar_data_assinatura boolean DEFAULT false;
