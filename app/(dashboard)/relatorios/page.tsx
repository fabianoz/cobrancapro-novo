'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, monthNames, statusLabels, statusColors, cycleLabels } from '@/lib/format';
import type { Charge, Customer, Plan, Subscription } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  FileText,
  Download,
  TrendingUp,
  Users,
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Loader2,
  DollarSign,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

type ReportType =
  | 'faturamento'
  | 'cobrancas_status'
  | 'inadimplencia'
  | 'clientes_ativos'
  | 'planos_receita'
  | 'por_banco'
  | 'evolucao_mensal';

const reportOptions: { value: ReportType; label: string; icon: typeof FileText; description: string }[] = [
  { value: 'faturamento', label: 'Faturamento Geral', icon: DollarSign, description: 'Total faturado, a receber e vencido no período' },
  { value: 'cobrancas_status', label: 'Cobranças por Status', icon: Receipt, description: 'Distribuição de pendentes, pagas e vencidas' },
  { value: 'inadimplencia', label: 'Inadimplência', icon: AlertTriangle, description: 'Clientes com cobranças vencidas e valores' },
  { value: 'clientes_ativos', label: 'Clientes Ativos', icon: Users, description: 'Assinaturas ativas e MRR por cliente' },
  { value: 'planos_receita', label: 'Receita por Plano', icon: TrendingUp, description: 'Quanto cada plano gera de receita' },
  { value: 'por_banco', label: 'Cobranças por Banco', icon: CreditCard, description: 'Volume por provedor (Efí, Inter, Asaas)' },
  { value: 'evolucao_mensal', label: 'Evolução Mensal', icon: Calendar, description: 'Receita nos últimos 12 meses' },
];

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#8b5cf6'];

export default function RelatoriosPage() {
  const [reportType, setReportType] = useState<ReportType>('faturamento');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState<(Charge & { customer?: Customer })[]>([]);
  const [subscriptions, setSubscriptions] = useState<(Subscription & { customer?: Customer; plan?: Plan })[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [chargesRes, subsRes, plansRes, customersRes] = await Promise.all([
        supabase.from('charges').select('*, customer:customers(*)').order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*, customer:customers(*), plan:plans(*)').eq('status', 'ACTIVE'),
        supabase.from('plans').select('*'),
        supabase.from('customers').select('*'),
      ]);

      setCharges((chargesRes.data as (Charge & { customer?: Customer })[]) || []);
      setSubscriptions((subsRes.data as (Subscription & { customer?: Customer; plan?: Plan })[]) || []);
      setPlans(plansRes.data || []);
      setCustomers(customersRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      const refDate = c.paid_at || c.due_date || c.created_at;
      if (periodFrom && refDate < periodFrom) return false;
      if (periodTo && refDate > periodTo + 'T23:59:59') return false;
      return true;
    });
  }, [charges, periodFrom, periodTo]);

  const stats = useMemo(() => {
    const paid = filteredCharges.filter((c) => c.status === 'PAID');
    const pending = filteredCharges.filter((c) => c.status === 'PENDING');
    const overdue = filteredCharges.filter((c) => c.status === 'OVERDUE');
    return {
      totalFaturado: paid.reduce((s, c) => s + Number(c.valor_pago || c.value), 0),
      aReceber: pending.reduce((s, c) => s + Number(c.value), 0),
      vencido: overdue.reduce((s, c) => s + Number(c.value), 0),
      countPaid: paid.length,
      countPending: pending.length,
      countOverdue: overdue.length,
      ticketMedio: paid.length ? paid.reduce((s, c) => s + Number(c.valor_pago || c.value), 0) / paid.length : 0,
      taxaInadimplencia: filteredCharges.length
        ? (overdue.length / (overdue.length + paid.length || 1)) * 100
        : 0,
    };
  }, [filteredCharges]);

  // Data for charts per report type
  const statusData = useMemo(() => [
    { name: 'Pagas', value: stats.countPaid, fill: '#10b981' },
    { name: 'Pendentes', value: stats.countPending, fill: '#f59e0b' },
    { name: 'Vencidas', value: stats.countOverdue, fill: '#ef4444' },
  ], [stats]);

  const inadimplenciaData = useMemo(() => {
    const overdueByCustomer = new Map<string, { customer: Customer; total: number; count: number }>();
    filteredCharges
      .filter((c) => c.status === 'OVERDUE' && c.customer)
      .forEach((c) => {
        const existing = overdueByCustomer.get(c.customer_id);
        if (existing) {
          existing.total += Number(c.value);
          existing.count += 1;
        } else {
          overdueByCustomer.set(c.customer_id, { customer: c.customer!, total: Number(c.value), count: 1 });
        }
      });
    return Array.from(overdueByCustomer.values()).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [filteredCharges]);

  const planosReceitaData = useMemo(() => {
    const byPlan = new Map<string, { name: string; receita: number; assinaturas: number }>();
    subscriptions.forEach((s) => {
      const plan = s.plan as Plan;
      if (!plan) return;
      const existing = byPlan.get(plan.id);
      const monthlyValue =
        plan.cycle === 'YEARLY' ? Number(plan.value) / 12 :
        plan.cycle === 'WEEKLY' ? Number(plan.value) * 4.33 :
        Number(plan.value);
      if (existing) {
        existing.receita += monthlyValue;
        existing.assinaturas += 1;
      } else {
        byPlan.set(plan.id, { name: plan.name, receita: monthlyValue, assinaturas: 1 });
      }
    });
    return Array.from(byPlan.values()).sort((a, b) => b.receita - a.receita);
  }, [subscriptions]);

  const porBancoData = useMemo(() => {
    const byBank = new Map<string, { name: string; total: number; count: number }>();
    filteredCharges.forEach((c) => {
      const bank = c.provider || 'EFI';
      const labels: Record<string, string> = { EFI: 'Efí Bank', INTER: 'Banco Inter', ASAAS: 'Asaas', C6: 'C6 Bank' };
      const existing = byBank.get(bank);
      if (existing) {
        existing.total += Number(c.value);
        existing.count += 1;
      } else {
        byBank.set(bank, { name: labels[bank] || bank, total: Number(c.value), count: 1 });
      }
    });
    return Array.from(byBank.values()).sort((a, b) => b.total - a.total);
  }, [filteredCharges]);

  const evolucaoData = useMemo(() => {
    const now = new Date();
    const arr: { month: string; pago: number; pendente: number; vencido: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mFirst = new Date(m.getFullYear(), m.getMonth(), 1).toISOString();
      const mLast = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString();
      const monthCharges = charges.filter((c) => {
        const d = c.paid_at || c.created_at;
        return d >= mFirst && d <= mLast;
      });
      arr.push({
        month: monthNames[m.getMonth()] + '/' + String(m.getFullYear()).slice(2),
        pago: monthCharges.filter((c) => c.status === 'PAID').reduce((s, c) => s + Number(c.valor_pago || c.value), 0),
        pendente: monthCharges.filter((c) => c.status === 'PENDING').reduce((s, c) => s + Number(c.value), 0),
        vencido: monthCharges.filter((c) => c.status === 'OVERDUE').reduce((s, c) => s + Number(c.value), 0),
      });
    }
    return arr;
  }, [charges]);

  const clientesAtivosData = useMemo(() => {
    return subscriptions.map((s) => {
      const plan = s.plan as Plan;
      const monthlyValue = plan
        ? plan.cycle === 'YEARLY' ? Number(plan.value) / 12 :
          plan.cycle === 'WEEKLY' ? Number(plan.value) * 4.33 :
          Number(plan.value)
        : 0;
      return {
        nome: s.customer?.name || '—',
        plano: plan?.name || '—',
        ciclo: plan ? cycleLabels[plan.cycle] || plan.cycle : '—',
        valor: monthlyValue,
        desde: s.start_date,
      };
    }).sort((a, b) => b.valor - a.valor);
  }, [subscriptions]);

  function exportCSV() {
    let csv = '';
    const sep = ';';

    switch (reportType) {
      case 'faturamento':
        csv = ['Metrica', 'Valor'].join(sep) + '\n';
        csv += ['Total Faturado', stats.totalFaturado.toFixed(2)].join(sep) + '\n';
        csv += ['A Receber', stats.aReceber.toFixed(2)].join(sep) + '\n';
        csv += ['Vencido', stats.vencido.toFixed(2)].join(sep) + '\n';
        csv += ['Cobrancas Pagas', stats.countPaid].join(sep) + '\n';
        csv += ['Cobrancas Pendentes', stats.countPending].join(sep) + '\n';
        csv += ['Cobrancas Vencidas', stats.countOverdue].join(sep) + '\n';
        csv += ['Ticket Medio', stats.ticketMedio.toFixed(2)].join(sep) + '\n';
        csv += ['Taxa Inadimplencia %', stats.taxaInadimplencia.toFixed(1)].join(sep) + '\n';
        break;

      case 'cobrancas_status':
        csv = ['Status', 'Quantidade'].join(sep) + '\n';
        statusData.forEach((d) => { csv += [d.name, d.value].join(sep) + '\n'; });
        break;

      case 'inadimplencia':
        csv = ['Cliente', 'Telefone', 'Email', 'Valor Vencido', 'Qtd Vencidas'].join(sep) + '\n';
        inadimplenciaData.forEach((d) => {
          csv += [d.customer.name, d.customer.whatsapp || '', d.customer.email || '', d.total.toFixed(2), d.count].join(sep) + '\n';
        });
        break;

      case 'clientes_ativos':
        csv = ['Cliente', 'Plano', 'Ciclo', 'Valor Mensal', 'Assinante Desde'].join(sep) + '\n';
        clientesAtivosData.forEach((d) => {
          csv += [d.nome, d.plano, d.ciclo, d.valor.toFixed(2), formatDate(d.desde)].join(sep) + '\n';
        });
        break;

      case 'planos_receita':
        csv = ['Plano', 'Assinaturas', 'Receita Mensal'].join(sep) + '\n';
        planosReceitaData.forEach((d) => {
          csv += [d.name, d.assinaturas, d.receita.toFixed(2)].join(sep) + '\n';
        });
        break;

      case 'por_banco':
        csv = ['Banco', 'Cobrancas', 'Volume Total'].join(sep) + '\n';
        porBancoData.forEach((d) => {
          csv += [d.name, d.count, d.total.toFixed(2)].join(sep) + '\n';
        });
        break;

      case 'evolucao_mensal':
        csv = ['Mes', 'Pago', 'Pendente', 'Vencido'].join(sep) + '\n';
        evolucaoData.forEach((d) => {
          csv += [d.month, d.pago.toFixed(2), d.pendente.toFixed(2), d.vencido.toFixed(2)].join(sep) + '\n';
        });
        break;
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado em CSV');
  }

  const currentReport = reportOptions.find((r) => r.value === reportType)!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere relatórios detalhados das suas cobranças, clientes e receitas
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Report type selector */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {reportOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = reportType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setReportType(opt.value)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                isActive
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-medium text-sm">{opt.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Period filter */}
      <Card className="p-4 border-border/60">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Período — De</label>
            <Input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPeriodFrom(''); setPeriodTo(''); }}
            className="text-muted-foreground"
          >
            Limpar período
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredCharges.length} cobrança(s) no período
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Faturamento Geral */}
          {reportType === 'faturamento' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={DollarSign} label="Total Faturado" value={formatCurrency(stats.totalFaturado)} sub={`${stats.countPaid} cobranças pagas`} color="emerald" />
                <StatCard icon={Wallet} label="A Receber" value={formatCurrency(stats.aReceber)} sub={`${stats.countPending} pendentes`} color="blue" />
                <StatCard icon={AlertTriangle} label="Vencido" value={formatCurrency(stats.vencido)} sub={`${stats.countOverdue} vencidas`} color="red" />
                <StatCard icon={TrendingUp} label="Ticket Médio" value={formatCurrency(stats.ticketMedio)} sub={`por cobrança paga`} color="slate" />
              </div>
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-1">Resumo Financeiro</h2>
                <p className="text-sm text-muted-foreground mb-6">Visão consolidada do período selecionado</p>
                <div className="space-y-3">
                  <FinanceBar label="Faturado" value={stats.totalFaturado} max={stats.totalFaturado + stats.aReceber + stats.vencido} color="bg-emerald-500" />
                  <FinanceBar label="A Receber" value={stats.aReceber} max={stats.totalFaturado + stats.aReceber + stats.vencido} color="bg-blue-500" />
                  <FinanceBar label="Vencido" value={stats.vencido} max={stats.totalFaturado + stats.aReceber + stats.vencido} color="bg-red-500" />
                </div>
                <div className="mt-6 grid sm:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Taxa de Inadimplência</p>
                    <p className="text-xl font-bold mt-1 text-red-600">{stats.taxaInadimplencia.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Total de Cobranças</p>
                    <p className="text-xl font-bold mt-1">{filteredCharges.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Clientes Ativos</p>
                    <p className="text-xl font-bold mt-1">{subscriptions.length}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Cobranças por Status */}
          {reportType === 'cobrancas_status' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-4">Distribuição por Status</h2>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}: ${e.value}`}>
                        {statusData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-4">Valores por Status</h2>
                <div className="space-y-4">
                  <StatusRow icon={CheckCircle2} label="Pagas" count={stats.countPaid} value={stats.totalFaturado} color="emerald" />
                  <StatusRow icon={Calendar} label="Pendentes" count={stats.countPending} value={stats.aReceber} color="amber" />
                  <StatusRow icon={AlertTriangle} label="Vencidas" count={stats.countOverdue} value={stats.vencido} color="red" />
                </div>
              </Card>
            </div>
          )}

          {/* Inadimplência */}
          {reportType === 'inadimplencia' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard icon={AlertTriangle} label="Total Vencido" value={formatCurrency(stats.vencido)} sub={`${stats.countOverdue} cobranças`} color="red" />
                <StatCard icon={Users} label="Clientes Inadimplentes" value={String(inadimplenciaData.length)} sub="com pelo menos 1 vencida" color="amber" />
                <StatCard icon={TrendingUp} label="Taxa de Inadimplência" value={`${stats.taxaInadimplencia.toFixed(1)}%`} sub="vencidas / (vencidas + pagas)" color="slate" />
              </div>
              <Card className="border-border/60 overflow-hidden">
                <div className="p-6 pb-4">
                  <h2 className="text-lg font-semibold">Top Clientes Inadimplentes</h2>
                  <p className="text-sm text-muted-foreground">Ordenado por valor vencido</p>
                </div>
                {inadimplenciaData.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                    <p className="text-muted-foreground">Nenhuma cobrança vencida. Tudo em dia!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-border bg-muted/30">
                          <th className="text-left font-medium text-muted-foreground px-6 py-3">Cliente</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Telefone</th>
                          <th className="text-center font-medium text-muted-foreground px-4 py-3">Qtd</th>
                          <th className="text-right font-medium text-muted-foreground px-6 py-3">Valor Vencido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inadimplenciaData.map((d) => (
                          <tr key={d.customer.id} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="px-6 py-3 font-medium">{d.customer.name}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{d.customer.whatsapp || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{d.count}</Badge>
                            </td>
                            <td className="px-6 py-3 text-right font-semibold text-red-600">{formatCurrency(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Clientes Ativos */}
          {reportType === 'clientes_ativos' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard icon={Users} label="Clientes Ativos" value={String(subscriptions.length)} sub="assinaturas ativas" color="blue" />
                <StatCard icon={UserCheck} label="Total de Clientes" value={String(customers.length)} sub="cadastrados" color="emerald" />
                <StatCard icon={TrendingUp} label="MRR" value={formatCurrency(clientesAtivosData.reduce((s, c) => s + c.valor, 0))} sub="receita recorrente mensal" color="slate" />
              </div>
              <Card className="border-border/60 overflow-hidden">
                <div className="p-6 pb-4">
                  <h2 className="text-lg font-semibold">Assinaturas Ativas por Cliente</h2>
                  <p className="text-sm text-muted-foreground">Receita mensal recorrente</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border bg-muted/30">
                        <th className="text-left font-medium text-muted-foreground px-6 py-3">Cliente</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Plano</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Ciclo</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Desde</th>
                        <th className="text-right font-medium text-muted-foreground px-6 py-3">Valor Mensal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesAtivosData.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Nenhuma assinatura ativa.</td></tr>
                      ) : clientesAtivosData.map((d, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="px-6 py-3 font-medium">{d.nome}</td>
                          <td className="px-4 py-3">{d.plano}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{d.ciclo}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(d.desde)}</td>
                          <td className="px-6 py-3 text-right font-semibold">{formatCurrency(d.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Receita por Plano */}
          {reportType === 'planos_receita' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-4">Receita Mensal por Plano</h2>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={planosReceitaData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="receita" fill="#0a3d8f" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-4">Detalhes por Plano</h2>
                <div className="space-y-3">
                  {planosReceitaData.map((p) => (
                    <div key={p.name} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.assinaturas} assinatura(s) ativa(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">{formatCurrency(p.receita)}</p>
                        <p className="text-xs text-muted-foreground">por mês</p>
                      </div>
                    </div>
                  ))}
                  {planosReceitaData.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">Nenhum plano com assinatura ativa.</div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Por Banco */}
          {reportType === 'por_banco' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-4">Volume por Provedor</h2>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={porBancoData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => e.name}>
                        {porBancoData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-6 border-border/60">
                <h2 className="text-lg font-semibold mb-4">Comparativo</h2>
                <div className="space-y-3">
                  {porBancoData.map((b, i) => (
                    <div key={b.name} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.count} cobrança(s)</p>
                        </div>
                      </div>
                      <p className="font-semibold">{formatCurrency(b.total)}</p>
                    </div>
                  ))}
                  {porBancoData.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">Nenhuma cobrança no período.</div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Evolução Mensal */}
          {reportType === 'evolucao_mensal' && (
            <Card className="p-6 border-border/60">
              <h2 className="text-lg font-semibold mb-1">Evolução de Receita — Últimos 12 Meses</h2>
              <p className="text-sm text-muted-foreground mb-6">Pagos, pendentes e vencidos por mês</p>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolucaoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="pago" name="Pago" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendente" name="Pendente" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="vencido" name="Vencido" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof FileText; label: string; value: string; sub: string; color: 'emerald' | 'blue' | 'red' | 'slate' | 'amber' }) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function FinanceBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{formatCurrency(value)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, label, count, value, color }: { icon: typeof FileText; label: string; count: number; value: number; color: 'emerald' | 'amber' | 'red' }) {
  const colorMap = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{count} cobrança(s)</p>
        </div>
      </div>
      <p className="font-semibold text-lg">{formatCurrency(value)}</p>
    </div>
  );
}
