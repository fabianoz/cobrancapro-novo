/*
# Professional charge message templates

## Purpose
Creates the default WhatsApp-ready message set for the five billing moments
requested by the business: charge generated, one day before, due today, one
day overdue, and five days overdue.

## Modified data
- `settings.reminder_rules`: changes the default schedule to D-1,D-0,D+1,D+5.
- `settings.template_faturar`: message sent when a charge is generated.
- `settings.template_lembrete_d3`: reused for the D-1 reminder.
- `settings.template_lembrete_d0`: message sent on the due date.
- `settings.template_lembrete_d1`: reused for the D+1 reminder.
- `settings.template_lembrete_d7_pos`: reused for the D+5 reminder.

## Template variables
Every default message includes the full legal company name, customer name,
amount, due date, PIX copy-and-paste, boleto line, boleto link, and public
payment link where the corresponding value exists.

## Data safety
Existing customized messages are preserved. Defaults are written only when a
field is empty or still contains the previous generic default.
*/

UPDATE public.settings
SET reminder_rules = 'D-1,D-0,D+1,D+5', updated_at = now()
WHERE id = 1
  AND (reminder_rules IS NULL OR reminder_rules IN ('D-3,D-0,D+1,D+3,D+7', ''));

UPDATE public.settings
SET template_faturar = 'Olá, {NOME_CLIENTE}!\n\nSua cobrança foi gerada pela {RAZAO_SOCIAL}.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável do boleto:\n{LINHA_DIGITAVEL}\n\nAcesse sua fatura e escolha a forma de pagamento:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}\n\nSe precisar de ajuda, estamos à disposição.', updated_at = now()
WHERE id = 1 AND (template_faturar IS NULL OR template_faturar = '');

UPDATE public.settings
SET template_lembrete_d3 = 'Olá, {NOME_CLIENTE}!\n\nLembrete da {RAZAO_SOCIAL}: sua cobrança vence amanhã.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nPague pela fatura:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}', updated_at = now()
WHERE id = 1 AND (template_lembrete_d3 IS NULL OR template_lembrete_d3 = '');

UPDATE public.settings
SET template_lembrete_d0 = 'Olá, {NOME_CLIENTE}!\n\nHoje é o vencimento da sua cobrança com a {RAZAO_SOCIAL}.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nFatura e opções de pagamento:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}', updated_at = now()
WHERE id = 1 AND (template_lembrete_d0 IS NULL OR template_lembrete_d0 = '');

UPDATE public.settings
SET template_lembrete_d1 = 'Olá, {NOME_CLIENTE}!\n\nIdentificamos que a cobrança da {RAZAO_SOCIAL} venceu ontem e ainda está pendente.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nRegularize pela fatura:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}\n\nSe já realizou o pagamento, desconsidere esta mensagem.', updated_at = now()
WHERE id = 1 AND (template_lembrete_d1 IS NULL OR template_lembrete_d1 = '');

UPDATE public.settings
SET template_lembrete_d7_pos = 'Olá, {NOME_CLIENTE}!\n\nSua cobrança da {RAZAO_SOCIAL} está há 5 dias vencida. Evite a continuidade da pendência e regularize hoje.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nAcesse a fatura para pagar:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}\n\nSe já realizou o pagamento, desconsidere esta mensagem.', updated_at = now()
WHERE id = 1 AND (template_lembrete_d7_pos IS NULL OR template_lembrete_d7_pos = '');