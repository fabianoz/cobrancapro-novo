'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, statusLabels, statusColors, chargeTypeLabels, chargeTypeColors, monthNames } from '@/lib/format';
import type { Charge, Customer } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MessageCircle,
  Mail,
  FileText,
  Wallet,
  Filter,
  QrCode,
  X,
  Send,
  Loader2,
  Clock,
  Calendar,
  Copy,
  CheckCircle2,
  Link as LinkIcon,
  Zap,
  XCircle,
  ExternalLink,
  Trash2,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

type ChargeWithCustomer = Charge & { customer?: Customer };

type IssuerInfo = {
  issuer_name: string;
  issuer_trade_name: string;
  issuer_phone: string;
  issuer_email: string;
  billing_provider: 'EFI' | 'C6' | 'INTER' | 'ASAAS';
};

const fullMonthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function buildDefaultMessage(charge: ChargeWithCustomer, issuer: IssuerInfo | null): string {
  const name = charge.customer?.name?.split(' ')[0] || 'cliente';
  const value = formatCurrency(Number(charge.value));
  const dueDate = formatDate(charge.due_date);
  const pix = charge.pix_copy_paste || '';
  const link = charge.link_fatura_publica || charge.payment_url || '';
  const boletoUrl = charge.boleto_url || '';
  const linha = charge.boleto_linha || charge.barcode_boleto || '';
  const issuerName = issuer?.issuer_trade_name || issuer?.issuer_name || '';

  let msg = `Ola, ${name},\n\nSua Fatura já se encontra Disponível\n${issuerName || 'Nossa Empresa'}\n\nSua Mensalidade vence no dia: ${dueDate}\nNo Valor: ${value}\n\nClique no Link da fatura abaixo para Efetuar o Pagamento:\n(PIX E BOLETO)\n${link}\n`;
  if (boletoUrl) msg += `\nPara acessar seu Boleto Clique Aqui:\n${boletoUrl}\n`;
  if (linha) msg += `\nLinha digitavel do boleto:\n${linha}\n`;
  if (pix) msg += `\nPIX Copia e Cola:\n${pix}\n`;
  msg += `\nQualquer dúvida, problema ou sugestão por favor entre em contato conosco para que possamos lhe ajudar.`;
  if (issuer?.issuer_phone) {
    msg += `\n\nContato: ${issuer.issuer_phone}`;
  }
  return msg;
}

export default function ChargesPage() {
  const [charges, setCharges] = useState<ChargeWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('current');
  const [viewCharge, setViewCharge] = useState<ChargeWithCustomer | null>(null);
  const [sendModal, setSendModal] = useState<ChargeWithCustomer | null>(null);
  const [messageText, setMessageText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sendChannel, setSendChannel] = useState<'whatsapp' | 'email' | 'both'>('both');
  const [sending, setSending] = useState(false);
  const [faturando, setFaturando] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<{ isBusinessHours: boolean; message: string }>({
    isBusinessHours: true,
    message: '',
  });
  const [issuer, setIssuer] = useState<IssuerInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [gerandoBoleto, setGerandoBoleto] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [receiveModal, setReceiveModal] = useState<ChargeWithCustomer | null>(null);
  const [receiveForm, setReceiveForm] = useState({ valorPago: '', desconto: '', dataPagamento: '' });
  const [receiving, setReceiving] = useState(false);
  const [yearFilter, setYearFilter] = useState('ALL');
  const [testingBank, setTestingBank] = useState(false);

  const loadCharges = useCallback(async () => {
    const { data } = await supabase
      .from('charges')
      .select('*, customer:customers(*)')
      .order('due_date', { ascending: false });
    setCharges((data as ChargeWithCustomer[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCharges();
    loadIssuer();
    fetch('/api/notifications/business-hours')
      .then((r) => r.json())
      .then((data) => setBusinessHours(data))
      .catch(() => {});
  }, [loadCharges]);

  // Polling: refresh charges every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadCharges();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadCharges]);

  async function loadIssuer() {
    const { data } = await supabase
      .from('settings')
      .select('issuer_name, issuer_trade_name, issuer_phone, issuer_email, billing_provider')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      setIssuer(data as IssuerInfo);
    }
  }

  function openSendModal(charge: ChargeWithCustomer) {
    setSendModal(charge);
    setMessageText(buildDefaultMessage(charge, issuer));
    const issuerName = issuer?.issuer_trade_name || issuer?.issuer_name || 'CobrancaPro';
    setEmailSubject(`Cobrança ${issuerName} — ${formatCurrency(Number(charge.value))}`);
    setSendChannel('both');
  }

  async function handleSend() {
    if (!sendModal) return;
    if (!sendModal.customer) {
      toast.error('Cliente não encontrado');
      return;
    }
    if (!messageText.trim()) {
      toast.error('Digite a mensagem que será enviada');
      return;
    }

    setSending(true);
    const phone = sendModal.customer.whatsapp;
    const email = sendModal.customer.email;
    let whatsappOk = true;
    let emailOk = true;

    if ((sendChannel === 'whatsapp' || sendChannel === 'both') && phone) {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message: messageText }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          whatsappOk = false;
          toast.error(`WhatsApp: ${data.error || 'erro ao enviar'}`);
        }
      } catch {
        whatsappOk = false;
        toast.error('Erro ao enviar WhatsApp');
      }
    } else if ((sendChannel === 'whatsapp' || sendChannel === 'both') && !phone) {
      toast.error('Cliente não tem WhatsApp cadastrado');
      whatsappOk = false;
    }

    if ((sendChannel === 'email' || sendChannel === 'both') && email) {
      try {
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: emailSubject,
            chargeId: sendModal.id,
            message: messageText,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          emailOk = false;
          toast.error(`Email: ${data.error || 'erro ao enviar'}`);
        }
      } catch {
        emailOk = false;
        toast.error('Erro ao enviar email');
      }
    } else if ((sendChannel === 'email' || sendChannel === 'both') && !email) {
      toast.error('Cliente não tem email cadastrado');
      emailOk = false;
    }

    if (whatsappOk && emailOk) {
      toast.success('Mensagem enviada com sucesso!');
      setSendModal(null);
    }
    setSending(false);
  }

  async function handleFaturar(charge: ChargeWithCustomer) {
    setFaturando(charge.id);
    try {
      const res = await fetch('/api/charges/faturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: charge.subscription_id,
          customerId: charge.customer_id,
          value: charge.value,
          dueDate: charge.due_date,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Cobrança faturada e enviada via WhatsApp!');
        loadCharges();
      } else {
        toast.error(data.error || 'Erro ao faturar');
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setFaturando(null);
  }

  async function handleSyncBank() {
    setTestingBank(true);
    try {
      const res = await fetch('/api/charges/sync-efi', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.updated > 0) {
          toast.success(`${data.updated} cobrança(s) atualizada(s)! ${data.checked} verificadas.`);
        } else {
          toast.info(`${data.checked} cobranças verificadas. Nenhuma mudança de status.`);
        }
        loadCharges();
      } else {
        toast.error(data.error || 'Erro ao sincronizar cobranças');
      }
    } catch {
      toast.error('Erro de conexão ao sincronizar cobranças');
    }
    setTestingBank(false);
  }

  async function handleDeleteCharge() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/charges/${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Cobrança excluída');
        loadCharges();
      } else {
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setDeleting(false);
    setDeleteId(null);
  }

  function openReceiveModal(charge: ChargeWithCustomer) {
    setReceiveModal(charge);
    setReceiveForm({
      valorPago: String(charge.value),
      desconto: '',
      dataPagamento: new Date().toISOString().split('T')[0],
    });
  }

  async function handleReceive() {
    if (!receiveModal) return;
    setReceiving(true);
    try {
      const res = await fetch('/api/charges/receber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeId: receiveModal.id,
          valorPago: Number(receiveForm.valorPago) || null,
          desconto: Number(receiveForm.desconto) || 0,
          dataPagamento: receiveForm.dataPagamento
            ? new Date(receiveForm.dataPagamento).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Cobrança recebida com sucesso!');
        setReceiveModal(null);
        loadCharges();
      } else {
        toast.error(data.error || 'Erro ao receber');
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setReceiving(false);
  }

  async function handleGerarBoleto(charge: ChargeWithCustomer) {
    setGerandoBoleto(charge.id);
    try {
      const res = await fetch(`/api/charges/${charge.id}/gerar-boleto`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Boleto gerado com sucesso!');
        loadCharges();
      } else {
        toast.error(data.error || 'Erro ao gerar boleto');
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setGerandoBoleto(null);
  }

  function copyToClipboard(text: string, field: string) {
    if (!text) {
      toast.error('Nada para copiar');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copiado!`);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function sendWhatsAppDirect(charge: ChargeWithCustomer) {
    if (!charge.customer?.whatsapp) {
      toast.error('Cliente não tem WhatsApp');
      return;
    }
    const msg = buildDefaultMessage(charge, issuer);
    fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: charge.customer.whatsapp, message: msg }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          toast.success('Mensagem enviada no WhatsApp!');
        } else {
          toast.error(data.error || 'Erro ao enviar');
        }
      })
      .catch(() => toast.error('Erro de conexão'));
  }

  // Filtering
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filtered = charges.filter((c) => {
    const matchesSearch =
      (c.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customer?.cpf_cnpj || '').includes(search);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const chargeMonthKey = (() => {
      const d = new Date(c.due_date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
    const matchesMonth =
      monthFilter === 'ALL' ||
      (monthFilter === 'current' && chargeMonthKey === currentMonthKey) ||
      chargeMonthKey === monthFilter;
    const chargeYear = new Date(c.due_date).getFullYear().toString();
    const matchesYear = yearFilter === 'ALL' || chargeYear === yearFilter;
    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  });

  // Build available months from charges
  const availableMonths = Array.from(
    new Set(
      charges.map((c) => {
        const d = new Date(c.due_date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })
    )
  ).sort((a, b) => b.localeCompare(a));

  const availableYears = Array.from(
    new Set(charges.map((c) => new Date(c.due_date).getFullYear().toString()))
  ).sort((a, b) => b.localeCompare(a));

  const totalValue = filtered.reduce((sum, c) => sum + Number(c.value), 0);
  const paidValue = filtered.filter((c) => c.status === 'PAID').reduce((sum, c) => sum + Number(c.value), 0);
  const pendingValue = filtered.filter((c) => c.status === 'PENDING').reduce((sum, c) => sum + Number(c.value), 0);
  const overdueValue = filtered.filter((c) => c.status === 'OVERDUE').reduce((sum, c) => sum + Number(c.value), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} cobrança{filtered.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalValue)}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const url = new URL(window.location.href);
            fetch('/api/cron/generate-charges', { method: 'POST' })
              .then((r) => r.json())
              .then((data) => {
                if (data.chargesCreated > 0) {
                  toast.success(`${data.chargesCreated} cobrança(s) gerada(s)!`);
                } else {
                  toast.info('Nenhuma cobrança pendente para gerar hoje');
                }
                loadCharges();
              })
              .catch(() => toast.error('Erro ao gerar cobranças'));
          }}
        >
          <Zap className="w-4 h-4 mr-2" />
          Gerar Cobranças
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncBank}
          disabled={testingBank}
        >
          {testingBank ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {testingBank ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalValue)}</p>
        </Card>
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Pago</p>
          <p className="text-xl font-bold mt-1 text-emerald-600">{formatCurrency(paidValue)}</p>
        </Card>
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{formatCurrency(pendingValue)}</p>
        </Card>
        <Card className="p-4 border-border/60">
          <p className="text-xs text-muted-foreground">Vencido</p>
          <p className="text-xl font-bold mt-1 text-red-600">{formatCurrency(overdueValue)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="w-3.5 h-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos Status</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="PAID">Pago</SelectItem>
            <SelectItem value="OVERDUE">Vencido</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <Calendar className="w-3.5 h-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês Atual</SelectItem>
            <SelectItem value="ALL">Todos Meses</SelectItem>
            {availableMonths.map((m) => {
              const [year, mon] = m.split('-');
              const label = `${fullMonthNames[parseInt(mon, 10) - 1]}/${year}`;
              return (
                <SelectItem key={m} value={m}>{label}</SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px]">
            <Calendar className="w-3.5 h-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos Anos</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-6 py-3">Cliente</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Vencimento</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right font-medium text-muted-foreground px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              ) : (
                filtered.map((charge) => (
                  <tr
                    key={charge.id}
                    className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setViewCharge(charge)}
                  >
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800">
                        {charge.customer?.name || '—'}
                      </div>
                      {charge.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {charge.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDate(charge.due_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {formatDate(charge.due_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(charge.value))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="outline" className={`font-medium border ${statusColors[charge.status] || ''}`}>
                          {statusLabels[charge.status] || charge.status}
                        </Badge>
                        {charge.charge_type && charge.charge_type !== 'RECURRING' && (
                          <Badge variant="outline" className={`text-xs border ${chargeTypeColors[charge.charge_type] || ''}`}>
                            {chargeTypeLabels[charge.charge_type] || charge.charge_type}
                          </Badge>
                        )}
                        {charge.payment_method && (
                          <span className="text-xs text-muted-foreground">{charge.payment_method}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {charge.pix_copy_paste && (
                          <button
                            onClick={() => copyToClipboard(charge.pix_copy_paste!, 'Pix')}
                            className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"
                            title="Copiar Pix"
                          >
                            {copiedField === 'Pix' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                        {charge.pix_qr_code && (
                          <button
                            onClick={() => setViewCharge(charge)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Ver QR Code Pix"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}
                        {(charge.barcode_boleto || charge.barcode) && (
                          <button
                            onClick={() => copyToClipboard(charge.barcode_boleto || charge.barcode || '', 'Linha Boleto')}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            title="Copiar Linha do Boleto"
                          >
                            {copiedField === 'Linha Boleto' ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </button>
                        )}
                        {charge.payment_url && (
                          <button
                            onClick={() => copyToClipboard(charge.payment_url!, 'Link')}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                            title="Copiar Link da Cobrança"
                          >
                            {copiedField === 'Link' ? <CheckCircle2 className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                          </button>
                        )}
                        {charge.link_fatura_publica && (
                          <button
                            onClick={() => copyToClipboard(charge.link_fatura_publica!, 'Link Fatura')}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                            title="Copiar Link da Fatura Pública"
                          >
                            {copiedField === 'Link Fatura' ? <CheckCircle2 className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                          </button>
                        )}
                        {(charge.boleto_url || charge.billet_pdf_url) && (
                          <a
                            href={charge.boleto_url || charge.billet_pdf_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Baixar Boleto PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                        {!charge.boleto_charge_id && (
                          <button
                            onClick={() => handleGerarBoleto(charge)}
                            disabled={gerandoBoleto === charge.id}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors disabled:opacity-50"
                            title="Gerar Boleto Agora"
                          >
                            {gerandoBoleto === charge.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => sendWhatsAppDirect(charge)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                          title="Enviar no WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {charge.status !== 'PAID' && (
                          <button
                            onClick={() => openReceiveModal(charge)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                            title="Receber com Desconto"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(charge.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          title="Excluir Cobrança"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Charge detail dialog */}
      {viewCharge && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setViewCharge(null)}
        >
          <Card
            className="max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Detalhes da Cobrança</h2>
                <p className="text-sm text-muted-foreground">{viewCharge.customer?.name}</p>
                {issuer?.issuer_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Emitente: {issuer.issuer_name}
                  </p>
                )}
              </div>
              <Badge variant="outline" className={`font-medium border ${statusColors[viewCharge.status]}`}>
                {statusLabels[viewCharge.status]}
              </Badge>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-bold text-lg">{formatCurrency(Number(viewCharge.value))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vencimento</span>
                <span>{formatDate(viewCharge.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provedor</span>
                <span>{viewCharge.provider}</span>
              </div>
              {viewCharge.payment_method && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forma de Pagamento</span>
                  <span className="font-medium">{viewCharge.payment_method}</span>
                </div>
              )}
              {viewCharge.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pago em</span>
                  <span>{formatDate(viewCharge.paid_at)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Externo</span>
                <span className="font-mono text-xs">{viewCharge.external_id || '—'}</span>
              </div>
              {viewCharge.description && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descrição</span>
                  <span className="text-right max-w-[60%]">{viewCharge.description}</span>
                </div>
              )}
              {viewCharge.charge_type && viewCharge.charge_type !== 'RECURRING' && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tipo</span>
                  <Badge variant="outline" className={`text-xs border ${chargeTypeColors[viewCharge.charge_type] || ''}`}>
                    {chargeTypeLabels[viewCharge.charge_type] || viewCharge.charge_type}
                  </Badge>
                </div>
              )}

              {/* Pix Copy Paste */}
              {viewCharge.pix_copy_paste && (
                <div>
                  <span className="text-muted-foreground block mb-1">PIX Copia e Cola</span>
                  <div className="font-mono text-xs bg-muted rounded p-2 break-all">{viewCharge.pix_copy_paste}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => copyToClipboard(viewCharge.pix_copy_paste!, 'Pix')}
                  >
                    {copiedField === 'Pix' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copiar Pix
                  </Button>
                </div>
              )}

              {/* QR Code Pix */}
              {viewCharge.pix_qr_code && (
                <div>
                  <span className="text-muted-foreground block mb-2">QR Code PIX</span>
                  <div className="flex justify-center bg-white rounded-lg p-4">
                    <img src={viewCharge.pix_qr_code} alt="PIX QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}

              {/* Boleto */}
              {(viewCharge.barcode_boleto || viewCharge.barcode) && (
                <div>
                  <span className="text-muted-foreground block mb-1">Linha Digitável do Boleto</span>
                  <div className="font-mono text-xs bg-muted rounded p-2 break-all">{viewCharge.boleto_linha || viewCharge.barcode_boleto || viewCharge.barcode}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => copyToClipboard(viewCharge.boleto_linha || viewCharge.barcode_boleto || viewCharge.barcode || '', 'Linha Boleto')}
                  >
                    {copiedField === 'Linha Boleto' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copiar Linha do Boleto
                  </Button>
                </div>
              )}

              {/* Link */}
              {viewCharge.payment_url && (
                <div>
                  <span className="text-muted-foreground block mb-1">Link de Pagamento</span>
                  <div className="font-mono text-xs bg-muted rounded p-2 break-all">{viewCharge.payment_url}</div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyToClipboard(viewCharge.payment_url!, 'Link')}
                    >
                      {copiedField === 'Link' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      Copiar Link
                    </Button>
                    <a href={viewCharge.payment_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        Abrir
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {(viewCharge.boleto_url || viewCharge.billet_pdf_url) && (
                <a href={viewCharge.boleto_url || viewCharge.billet_pdf_url || '#'} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Ver PDF do Boleto
                  </Button>
                </a>
              )}

              {/* Link Fatura Pública */}
              {viewCharge.link_fatura_publica && (
                <div>
                  <span className="text-muted-foreground block mb-1">Link da Fatura Pública</span>
                  <div className="font-mono text-xs bg-muted rounded p-2 break-all">{viewCharge.link_fatura_publica}</div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyToClipboard(viewCharge.link_fatura_publica!, 'Link Fatura')}
                    >
                      {copiedField === 'Link Fatura' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      Copiar Link
                    </Button>
                    <a href={viewCharge.link_fatura_publica} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir Fatura
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-6">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  const c = viewCharge;
                  setViewCharge(null);
                  openSendModal(c);
                }}
              >
                <Send className="w-4 h-4 mr-1" /> Enviar Mensagem
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => sendWhatsAppDirect(viewCharge)}
              >
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </Button>
              {viewCharge.status !== 'PAID' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const c = viewCharge;
                    setViewCharge(null);
                    openReceiveModal(c);
                  }}
                >
                  <DollarSign className="w-4 h-4 mr-1" /> Receber
                </Button>
              )}
              {viewCharge.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFaturar(viewCharge)}
                  disabled={faturando === viewCharge.id}
                >
                  {faturando === viewCharge.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                  Faturar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  setDeleteId(viewCharge.id);
                  setViewCharge(null);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewCharge(null)}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDeleteId(null)}
        >
          <Card className="max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Excluir Cobrança</h2>
                <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteCharge}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Excluir
              </Button>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Receive with discount modal */}
      {receiveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setReceiveModal(null)}
        >
          <Card className="max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Receber Cobrança</h2>
                <p className="text-sm text-muted-foreground">
                  {receiveModal.customer?.name} • {formatCurrency(Number(receiveModal.value))}
                </p>
              </div>
              <button onClick={() => setReceiveModal(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recv-value">Valor Pago</Label>
                <Input
                  id="recv-value"
                  type="number"
                  step="0.01"
                  value={receiveForm.valorPago}
                  onChange={(e) => setReceiveForm({ ...receiveForm, valorPago: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recv-discount">Desconto</Label>
                <Input
                  id="recv-discount"
                  type="number"
                  step="0.01"
                  value={receiveForm.desconto}
                  onChange={(e) => setReceiveForm({ ...receiveForm, desconto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recv-date">Data do Pagamento</Label>
                <Input
                  id="recv-date"
                  type="date"
                  value={receiveForm.dataPagamento}
                  onChange={(e) => setReceiveForm({ ...receiveForm, dataPagamento: e.target.value })}
                />
              </div>
              {receiveForm.desconto && Number(receiveForm.desconto) > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  Desconto de {formatCurrency(Number(receiveForm.desconto))} aplicado.
                  Valor final: {formatCurrency(Number(receiveForm.valorPago) || (Number(receiveModal.value) - Number(receiveForm.desconto)))}
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleReceive} disabled={receiving}>
                  {receiving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                  Confirmar Recebimento
                </Button>
                <Button variant="outline" onClick={() => setReceiveModal(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Send Message Modal */}
      {sendModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSendModal(null)}
        >
          <Card
            className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Enviar Mensagem da Cobrança</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {sendModal.customer?.name} • {formatCurrency(Number(sendModal.value))}
                </p>
              </div>
              <button
                onClick={() => setSendModal(null)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Enviar por</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSendChannel('both')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                      sendChannel === 'both'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    Ambos
                  </button>
                  <button
                    onClick={() => setSendChannel('whatsapp')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                      sendChannel === 'whatsapp'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => setSendChannel('email')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                      sendChannel === 'email'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className={`rounded-lg border p-3 ${sendModal.customer?.whatsapp ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                  <span className="text-muted-foreground">WhatsApp: </span>
                  <span className={sendModal.customer?.whatsapp ? 'text-emerald-700 font-medium' : 'text-red-600'}>
                    {sendModal.customer?.whatsapp || 'não cadastrado'}
                  </span>
                </div>
                <div className={`rounded-lg border p-3 ${sendModal.customer?.email ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
                  <span className="text-muted-foreground">Email: </span>
                  <span className={sendModal.customer?.email ? 'text-blue-700 font-medium' : 'text-red-600'}>
                    {sendModal.customer?.email || 'não cadastrado'}
                  </span>
                </div>
              </div>

              {(sendChannel === 'email' || sendChannel === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="msg-subject">Assunto do Email</Label>
                  <Input
                    id="msg-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="msg-text">Texto da Mensagem</Label>
                  <span className="text-xs text-muted-foreground">
                    {messageText.length} caracteres
                  </span>
                </div>
                <Textarea
                  id="msg-text"
                  rows={10}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite a mensagem que será enviada para o cliente..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  O texto acima será enviado exatamente como digitado. Use *texto* para negrito no WhatsApp.
                </p>
              </div>

              {!businessHours.isBusinessHours && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  {businessHours.message}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSend}
                  disabled={sending || !messageText.trim()}
                  className="flex-1"
                >
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {sending ? 'Enviando...' : 'Enviar Mensagem'}
                </Button>
                <Button variant="outline" onClick={() => setSendModal(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
