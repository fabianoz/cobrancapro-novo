/*
# Enable Realtime on atendimento tables

1. Changes
- Adds `atendimentos`, `mensagens_atendimento` to the `supabase_realtime` publication so the frontend can subscribe to INSERT/UPDATE events via Supabase Realtime channels.
2. Security
- No RLS changes. Realtime respects existing RLS policies on these tables.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos;
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens_atendimento;
