/*
# Multiempresa — Parte 0: Expandir CHECK de cargo para incluir super_admin
*/
ALTER TABLE public.usuarios_sistema DROP CONSTRAINT IF EXISTS usuarios_sistema_cargo_check;
ALTER TABLE public.usuarios_sistema ADD CONSTRAINT usuarios_sistema_cargo_check
  CHECK (cargo = ANY (ARRAY['super_admin'::text, 'admin'::text, 'financeiro'::text, 'suporte'::text, 'vendas'::text, 'estagiario'::text]));
