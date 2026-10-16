'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Charge, Customer } from '@/lib/supabase';
import { chargeTypeLabels, formatCurrency, formatDate } from '@/lib/format';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  Mail,
  Phone,
  QrCode,
  Tag,
} from 'lucide-react';

type Issuer = {
  issuer_name: string | null;
  issuer_trade_name: string | null;
  issuer_cnpj: string | null;
  issuer_address: string | null;
  issuer_city: string | null;
  issuer_state: string | null;
  issuer_phone: string | null;
  issuer_email: string | null;
  issuer_logo_url: string | null;
};

type PublicCharge = Charge & { customer?: Customer; erro_boleto?: string | null };
type PaymentMethod = 'pix' | 'boleto';

function getQrCodeSource(value: string | null): string {
  if (!value) return '';
  return value.startsWith('data:image') ? value : `data:image/png;base64,${value}`;
}

function getStatusLabel(status: string): string {
  if (status === 'PAID') return 'Pago';
  if (status === 'OVERDUE') return 'Vencido';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Pendente';
}

export default function FaturaPublicaPage() {
  const params = useParams();
  const externalId = params.id_externo as string;
  const [charge, setCharge] = useState<PublicCharge | null>(null);
  const [issuer, setIssuer] = useState<Issuer | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<PaymentMethod | 'link' | null>(null);
  const [gerandoBoleto, setGerandoBoleto] = useState(false);

  async function loadInvoice() {
    const response = await fetch(`/api/fatura/${externalId}`);
    if (!response.ok) throw new Error('Cobrança não encontrada');
    const data = await response.json();
    setCharge(data.charge);
    setIssuer(data.issuer || null);
  }

  useEffect(() => {
    if (!externalId) return;
    loadInvoice()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a cobrança'))
      .finally(() => setLoading(false));
  }, [externalId]);

  useEffect(() => {
    if (!externalId || loading || error || charge?.status === 'PAID') return;
    const interval = window.setInterval(() => {
      loadInvoice().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [externalId, loading, error, charge?.status]);

  const companyName = issuer?.issuer_trade_name || issuer?.issuer_name || 'CobrancaPro';
  const paymentLabel = charge?.payment_method === 'BOLETO' ? 'Boleto' : charge?.payment_method === 'PIX' ? 'PIX' : '';
  const boletoLine = charge?.boleto_linha || charge?.barcode_boleto || '';
  const qrSource = useMemo(() => getQrCodeSource(charge?.pix_qr_code || null), [charge?.pix_qr_code]);
  const hasPix = Boolean(charge?.pix_copy_paste || qrSource);
  const hasBoleto = Boolean(boletoLine || charge?.boleto_url || charge?.billet_pdf_url || charge?.payment_url);
  const providerLabel = charge?.provider === 'ASAAS' ? 'Asaas' : charge?.provider === 'INTER' ? 'Banco Inter' : 'Efí';
  const hasBoletoError = Boolean(charge?.erro_boleto);
  const showBoletoButton = hasBoleto || hasBoletoError;

  async function copyValue(value: string, type: PaymentMethod | 'link') {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 2200);
  }

  async function handleGerarBoleto() {
    if (!charge?.id) return;
    setGerandoBoleto(true);
    try {
      const res = await fetch(`/api/charges/${charge.id}/gerar-boleto`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadInvoice();
      } else {
        setError(data.error || 'Erro ao gerar boleto');
      }
    } catch {
      setError('Erro de conexão ao gerar boleto');
    }
    setGerandoBoleto(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-700" /></div>;
  }

  if (error || !charge) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm border border-slate-200">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Cobrança não encontrada</h1>
          <p className="mt-2 text-sm text-slate-500">{error || 'Confira o link recebido e tente novamente.'}</p>
        </section>
      </main>
    );
  }

  const isPaid = charge.status === 'PAID';
  const invoiceLink = typeof window !== 'undefined' ? window.location.href : '';
  const visibleMethod = method === 'pix' && !hasPix && (hasBoleto || hasBoletoError) ? 'boleto' : method;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="overflow-hidden rounded-2xl bg-[#101a91] text-white shadow-lg">
          <div className="flex min-h-[148px] items-center justify-between gap-5 px-5 py-5 sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{companyName}</p>
              {issuer?.issuer_cnpj && <p className="mt-1 text-sm font-medium text-blue-100">{issuer.issuer_cnpj}</p>}
              <div className="mt-4 space-y-1 text-xs text-blue-50 sm:text-sm">
                {issuer?.issuer_email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{issuer.issuer_email}</p>}
                {issuer?.issuer_phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{issuer.issuer_phone}</p>}
                {(issuer?.issuer_city || issuer?.issuer_state) && <p>{[issuer.issuer_city, issuer.issuer_state].filter(Boolean).join(' - ')}</p>}
              </div>
            </div>
            <Image
              src="/cobrancapro-logo-transparent.png"
              alt="CobrancaPro"
              width={280}
              height={168}
              priority
              className="h-20 w-[134px] shrink-0 rounded-xl object-cover shadow-sm sm:h-24 sm:w-[160px]"
            />
          </div>
        </header>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-200 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className={`text-2xl font-bold ${isPaid ? 'text-emerald-600' : charge.status === 'OVERDUE' ? 'text-red-600' : 'text-emerald-600'}`}>
                {isPaid ? 'Pagamento confirmado' : charge.status === 'OVERDUE' ? 'Vencida' : 'Vence hoje'}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="h-4 w-4" />Vencimento: <span className="font-medium text-slate-700">{formatDate(charge.due_date)}</span></p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-blue-700">Valor a ser pago</p>
              <p className="text-3xl font-bold text-slate-900 sm:text-4xl">{formatCurrency(Number(charge.value))}</p>
              {paymentLabel && <p className="mt-1 text-xs text-emerald-600">Pago via {paymentLabel}</p>}
            </div>
          </div>

          <div className="grid gap-4 border-b border-slate-200 py-5 text-sm sm:grid-cols-3">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Referente a</p><p className="mt-1 font-medium text-slate-700">{charge.description || 'Cobrança'}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Pagador</p><p className="mt-1 font-medium text-slate-700">{charge.customer?.name || '—'}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Tipo</p><p className="mt-1 font-medium text-slate-700">{chargeTypeLabels[charge.charge_type] || charge.charge_type}</p></div>
          </div>

          {isPaid ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-3 text-lg font-bold text-emerald-800">Esta cobrança já foi paga</h2>
              <p className="mt-1 text-sm text-emerald-700">O boleto correspondente foi baixado automaticamente.</p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-slate-800">Pagar com</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{getStatusLabel(charge.status)}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {hasPix && <button onClick={() => setMethod('pix')} className={`flex min-h-[78px] items-center justify-center gap-3 rounded-xl border-2 bg-white px-5 font-semibold transition ${visibleMethod === 'pix' ? 'border-teal-500 text-teal-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}><QrCode className="h-7 w-7" />PIX</button>}
                {showBoletoButton && <button onClick={() => setMethod('boleto')} className={`flex min-h-[78px] items-center justify-center gap-3 rounded-xl border-2 bg-white px-5 font-semibold transition ${visibleMethod === 'boleto' ? 'border-blue-600 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}><FileText className="h-7 w-7" />Boleto</button>}
              </div>

              {visibleMethod === 'pix' && hasPix && (
                <div className="mt-5 rounded-xl border border-teal-100 bg-white p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-teal-700"><QrCode className="h-5 w-5" /><h3 className="font-bold">Pagamento via PIX</h3></div>
                  {qrSource && <div className="mt-5 flex justify-center"><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><img src={qrSource} alt="QR Code para pagamento PIX" className="h-52 w-52 sm:h-60 sm:w-60" /></div></div>}
                  {charge.pix_copy_paste && <><p className="mt-5 text-sm font-semibold text-slate-700">PIX Copia e Cola</p><div className="mt-2 max-h-24 overflow-auto rounded-lg bg-slate-100 p-3 font-mono text-xs leading-5 text-slate-600">{charge.pix_copy_paste}</div><button onClick={() => copyValue(charge.pix_copy_paste || '', 'pix')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700">{copied === 'pix' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'pix' ? 'PIX copiado' : 'Copiar PIX'}</button></>}
                  <p className="mt-3 text-center text-xs text-slate-500">Abra o aplicativo do seu banco, escolha PIX e escaneie o código.</p>
                </div>
              )}

              {visibleMethod === 'boleto' && hasBoleto && (
                <div className="mt-5 rounded-xl border border-blue-100 bg-white p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-blue-700"><FileText className="h-5 w-5" /><h3 className="font-bold">Pagamento via Boleto</h3></div>
                  {boletoLine && <><p className="mt-5 text-sm font-semibold text-slate-700">Linha digitável</p><div className="mt-2 max-h-24 overflow-auto rounded-lg bg-slate-100 p-3 font-mono text-xs leading-5 text-slate-600">{boletoLine}</div><button onClick={() => copyValue(boletoLine, 'boleto')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800">{copied === 'boleto' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'boleto' ? 'Linha copiada' : 'Copiar linha do boleto'}</button></>}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(charge.boleto_url || charge.billet_pdf_url) && <a href={charge.boleto_url || charge.billet_pdf_url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"><FileText className="h-4 w-4" />Baixar boleto PDF</a>}
                    {charge.payment_url && <a href={charge.payment_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ExternalLink className="h-4 w-4" />Visualizar boleto</a>}
                  </div>
                </div>
              )}

              {/* Boleto error / retry section — shown when boleto failed or is missing */}
              {visibleMethod === 'boleto' && !hasBoleto && (
                <div className="mt-5 rounded-xl border border-red-100 bg-white p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-red-700"><AlertCircle className="h-5 w-5" /><h3 className="font-bold">Boleto não disponível</h3></div>
                  {charge.erro_boleto && (
                    <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                      <p className="font-semibold mb-1">Erro ao gerar boleto:</p>
                      <p className="font-mono text-xs break-all">{charge.erro_boleto}</p>
                    </div>
                  )}
                  <button onClick={handleGerarBoleto} disabled={gerandoBoleto} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50">
                    {gerandoBoleto ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    {gerandoBoleto ? 'Gerando boleto...' : 'Gerar Boleto Agora'}
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {charge.erro_boleto ? 'Corrija o erro acima e tente novamente, ou contate o emissor.' : `O boleto será gerado pelo ${providerLabel} e aparecerá aqui automaticamente.`}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:grid-cols-3">
            <p className="flex items-center gap-2"><Building2 className="h-4 w-4" />Provedor: <strong className="text-slate-700">{providerLabel}</strong></p>
            <p className="flex items-center gap-2"><Hash className="h-4 w-4" />ID: <strong className="truncate text-slate-700">{charge.external_id || '—'}</strong></p>
            <p className="flex items-center gap-2"><Tag className="h-4 w-4" />Método: <strong className="text-slate-700">PIX + Boleto</strong></p>
          </div>
        </section>

        {invoiceLink && <button onClick={() => copyValue(invoiceLink, 'link')} className="mx-auto flex items-center gap-2 rounded-lg px-4 py-2 text-xs text-slate-500 transition hover:bg-white hover:text-slate-700"><Clipboard className="h-3.5 w-3.5" />Copiar link desta cobrança</button>}
        <footer className="pb-4 text-center text-xs text-slate-400">Pagamento processado com segurança pelo {providerLabel}.</footer>
      </div>
    </main>
  );
}
