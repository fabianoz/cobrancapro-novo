export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { POST as faturarCharge } from '../faturar/route';

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function createCharge(request: Request, payload: Record<string, unknown>): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  return faturarCharge(new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, subscriptionId, saleValue, saleDescription, dueDate, installments = 1, installmentStart = 'this_month' } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId é obrigatório' }, { status: 400 });
    }

    if (subscriptionId) {
      const response = await createCharge(request, {
        customerId,
        subscriptionId,
        value: saleValue,
        dueDate,
      });
      const data = await response.json();
      return NextResponse.json({ ...data, charges: data.charge ? [data.charge] : [] }, { status: response.status });
    }

    if (!saleValue || Number(saleValue) <= 0) {
      return NextResponse.json({ error: 'Valor da cobrança não encontrado' }, { status: 400 });
    }

    const count = Math.max(1, Math.min(36, Math.floor(Number(installments) || 1)));
    const installmentValue = Math.round((Number(saleValue) / count) * 100) / 100;
    const firstDate = dueDate
      ? new Date(dueDate)
      : installmentStart === 'next_month'
        ? addMonths(new Date(), 1)
        : new Date();
    const charges: unknown[] = [];

    for (let index = 0; index < count; index += 1) {
      const chargeDate = addMonths(firstDate, index).toISOString().split('T')[0];
      const description = count > 1
        ? `${saleDescription || 'Venda avulsa'} — Parcela ${index + 1}/${count}`
        : saleDescription || 'Venda avulsa';

      const response = await createCharge(request, {
        customerId,
        value: installmentValue,
        dueDate: chargeDate,
        description,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        return NextResponse.json({
          error: data.error || `Erro ao criar parcela ${index + 1}`,
          charges,
          chargesCreated: charges.length,
        }, { status: response.status || 500 });
      }

      charges.push(data.charge);
    }

    return NextResponse.json({
      success: true,
      charge: charges[0] || null,
      charges,
      installments: count,
      message: 'Cobrança criada com PIX, boleto e painel público. A mensagem foi enviada ao cliente quando há WhatsApp cadastrado.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível criar a cobrança';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
