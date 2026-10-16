/**
 * EfiRecorrenteService — Pix Automático Recorrente
 *
 * Endpoints:
 * - POST /v2/rec             -> Criar recorrência
 * - POST /v2/rec/:id/cob     -> Criar cobrança vinculada
 * - GET  /v2/rec             -> Listar recorrências
 * - GET  /v2/rec/:id         -> Detalhar recorrência
 * - PUT  /v2/rec/:id/finish  -> Encerrar recorrência
 */

import { efiRequest } from './auth';
import type { PixCobrancaResponse } from './pix';

export type RecorrenciaInput = {
  periodicidade: 'MENSAL' | 'SEMANAL';
  valor: number;
  dataInicio: string; // YYYY-MM-DD
  nomePagador: string;
  cpfPagador: string;
  emailPagador?: string;
};

export type RecorrenciaResponse = {
  id: string;
  txid: string;
  status: string;
  periodicidade: string;
  valor: number;
  dataInicio: string;
  proximaCobranca?: string;
};

/** Cria uma recorrência de Pix Automático (POST /v2/rec) */
export async function criarRecorrencia(input: RecorrenciaInput): Promise<RecorrenciaResponse> {
  const cpf = input.cpfPagador.replace(/\D/g, '');

  const body = {
    calendario: {
      dataDeInicio: input.dataInicio,
    },
    devedor: {
      nome: input.nomePagador.substring(0, 30),
      cpf,
    },
    valor: { original: input.valor.toFixed(2) },
    periodicidade: input.periodicidade === 'SEMANAL' ? 'SEMANAL' : 'MENSAL',
    ...(input.emailPagador ? { recebedor: { email: input.emailPagador } } : {}),
  };

  const data = await efiRequest<any>('/v2/rec', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    id: String(data.id || data.recId || ''),
    txid: data.txid || '',
    status: data.status || 'ATIVA',
    periodicidade: input.periodicidade,
    valor: input.valor,
    dataInicio: input.dataInicio,
    proximaCobranca: data.calendario?.proximaCobranca,
  };
}

/** Cria uma cobrança vinculada a uma recorrência (POST /v2/rec/:id/cob) */
export async function criarCobrancaRecorrente(recId: string, valor: number): Promise<PixCobrancaResponse> {
  const body = {
    valor: { original: valor.toFixed(2) },
  };

  const data = await efiRequest<any>(`/v2/rec/${recId}/cob`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    txid: data.txid,
    status: data.status,
    pixCopiaECola: data.pixCopiaECola || '',
    qrCodeBase64: '',
    valor,
    calendario: data.calendario,
  };
}

/** Lista recorrências (GET /v2/rec) */
export async function listarRecorrencias(): Promise<RecorrenciaResponse[]> {
  const data = await efiRequest<any>('/v2/rec');
  return (data.recorrencias || data || []) as RecorrenciaResponse[];
}

/** Detalha uma recorrência (GET /v2/rec/:id) */
export async function consultarRecorrencia(recId: string): Promise<RecorrenciaResponse> {
  const data = await efiRequest<any>(`/v2/rec/${recId}`);
  return {
    id: String(data.id || recId),
    txid: data.txid || '',
    status: data.status || 'unknown',
    periodicidade: data.periodicidade || 'MENSAL',
    valor: data.valor?.original ? parseFloat(data.valor.original) : 0,
    dataInicio: data.calendario?.dataDeInicio || '',
    proximaCobranca: data.calendario?.proximaCobranca,
  };
}

/** Encerra uma recorrência (PUT /v2/rec/:id/finish) */
export async function encerrarRecorrencia(recId: string): Promise<void> {
  await efiRequest(`/v2/rec/${recId}/finish`, { method: 'PUT' });
}
