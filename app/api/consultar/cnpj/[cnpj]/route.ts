import { NextResponse } from 'next/server';

/**
 * Fetch company data from CNPJ using public APIs.
 * Tries BrasilAPI first, falls back to ReceitaWS.
 * Runs server-side to avoid CORS issues.
 */
export async function GET(
  _request: Request,
  { params }: { params: { cnpj: string } }
) {
  const cnpj = params.cnpj.replace(/\D/g, '');

  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json(
      { error: 'CNPJ invalido. Deve conter 14 digitos.' },
      { status: 400 }
    );
  }

  // Try BrasilAPI first
  try {
    const data = await fetchWithTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      12000
    );

    if (data) {
      const phone = (data.ddd_telefone_1 || data.ddd_telefone_2 || '').trim();
      const cep = data.cep ? String(data.cep).replace(/(\d{5})(\d{3})/, '$1-$2') : '';

      return NextResponse.json({
        success: true,
        data: {
          name: data.razao_social || data.nome_fantasia || '',
          trade_name: data.nome_fantasia || '',
          cpf_cnpj: cnpj,
          email: (data.email || '').trim(),
          whatsapp: phone,
          zip_code: cep,
          street: data.logradouro || '',
          street_number: data.numero || '',
          complement: data.complemento || '',
          neighborhood: data.bairro || '',
          city: data.municipio || '',
          state: data.uf || '',
          state_registration: '',
          situacao: data.descricao_situacao_cadastral || '',
          cnae: data.cnae_fiscal_descricao || '',
          cnae_code: data.cnae_fiscal || '',
          natureza_juridica: data.natureza_juridica || '',
          porte: data.porte || '',
          capital_social: data.capital_social || '',
          abertura: data.data_inicio_atividade || '',
          socios: data.qsa || [],
        },
      });
    }
  } catch {
    // Fall through to backup API
  }

  // Fallback: ReceitaWS
  try {
    const data = await fetchWithTimeout(
      `https://receitaws.com.br/v1/cnpj/${cnpj}`,
      12000
    );

    if (data) {
      const phone = (data.telefone || '').trim();
      const cep = data.cep ? String(data.cep).replace(/(\d{5})(\d{3})/, '$1-$2') : '';

      return NextResponse.json({
        success: true,
        data: {
          name: data.nome || '',
          trade_name: data.fantasia || '',
          cpf_cnpj: cnpj,
          email: (data.email || '').trim(),
          whatsapp: phone,
          zip_code: cep,
          street: data.logradouro || '',
          street_number: data.numero || '',
          complement: data.complemento || '',
          neighborhood: data.bairro || '',
          city: data.municipio || '',
          state: data.uf || '',
          situacao: data.situacao || '',
          cnae: data.atividade_principal?.[0]?.text || '',
          natureza_juridica: data.natureza_juridica || '',
          porte: data.porte || '',
          abertura: data.abertura || '',
        },
      });
    }
  } catch {
    // Fall through to error
  }

  return NextResponse.json(
    {
      error:
        'Nao foi possivel consultar o CNPJ no momento. Os servicos de consulta (BrasilAPI e ReceitaWS) podem estar indisponiveis. Tente novamente em alguns segundos.',
    },
    { status: 503 }
  );
}

/**
 * Fetch JSON from a URL with a manual timeout (compatible with older Node.js).
 * Returns null on 404, throws on other errors.
 */
async function fetchWithTimeout(url: string, ms: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CobrancaPro/1.0)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new Error('CNPJ_NAO_ENCONTRADO');
    }

    if (response.status === 429) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      if (error.message === 'CNPJ_NAO_ENCONTRADO') {
        throw new Error('CNPJ nao encontrado. Verifique o numero digitado.');
      }
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
