'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, monthNames, statusLabels, statusColors } from '@/lib/format';
import type { Charge, Customer } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  MessageCircle,
  Mail,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';

type DashboardStats = {
  totalToReceive: number;
  overdue: number;
  paidThisMonth: number;
  mrr: number;
  totalCharges: number;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
};

type ChartData = {
  month: string;
  pago: number;
  pendente: number;
  vencido: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalToReceive: 0,
    overdue: 0,
    paidThisMonth: 0,
    mrr: 0,
    totalCharges: 0,
    pendingCount: 0,
    overdueCount: 0,
    paidCount: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentCharges, setRecentCharges] = useState<(Charge & { customer?: Customer })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1).toISOString();
      const lastDay = new Date(year, month + 1, 0).toISOString();

      // Load all charges
      const { data: charges } = await supabase
        .from('charges')
        .select('*, customer:customers(*)')
        .order('created_at', { ascending: false });

      if (!charges) {
        setLoading(false);
        return;
      }

      // Calculate stats
      const pending = charges.filter((c) => c.status === 'PENDING');
      const overdue = charges.filter((c) => c.status === 'OVERDUE');
      const paidThisMonthCharges = charges.filter(
        (c) => c.status === 'PAID' && c.paid_at && c.paid_at >= firstDay && c.paid_at <= lastDay
      );

      const totalToReceive = pending.reduce((sum, c) => sum + Number(c.value), 0);
      const overdueTotal = overdue.reduce((sum, c) => sum + Number(c.value), 0);
      const paidTotal = paidThisMonthCharges.reduce((sum, c) => sum + Number(c.value), 0);

      // MRR: sum of active subscription plan values
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('status', 'ACTIVE');

      const mrr = (subs || []).reduce((sum, s) => {
        const plan = s.plan as any;
        if (!plan) return sum;
        if (plan.cycle === 'MONTHLY') return sum + Number(plan.value);
        if (plan.cycle === 'YEARLY') return sum + Number(plan.value) / 12;
        if (plan.cycle === 'WEEKLY') return sum + Number(plan.value) * 4.33;
        return sum;
      }, 0);

      setStats({
        totalToReceive,
        overdue: overdueTotal,
        paidThisMonth: paidTotal,
        mrr,
        totalCharges: charges.length,
        pendingCount: pending.length,
        overdueCount: overdue.length,
        paidCount: paidThisMonthCharges.length,
      });

      // Build chart data (last 6 months)
      const chartArr: ChartData[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = new Date(year, month - i, 1);
        const mFirst = new Date(m.getFullYear(), m.getMonth(), 1).toISOString();
        const mLast = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString();

        const monthCharges = charges.filter((c) => {
          const d = c.paid_at || c.created_at;
          return d >= mFirst && d <= mLast;
        });

        chartArr.push({
          month: monthNames[m.getMonth()],
          pago: monthCharges
            .filter((c) => c.status === 'PAID')
            .reduce((sum, c) => sum + Number(c.value), 0),
          pendente: monthCharges
            .filter((c) => c.status === 'PENDING')
            .reduce((sum, c) => sum + Number(c.value), 0),
          vencido: monthCharges
            .filter((c) => c.status === 'OVERDUE')
            .reduce((sum, c) => sum + Number(c.value), 0),
        });
      }
      setChartData(chartArr);

      // Recent charges (latest 8)
      setRecentCharges(charges.slice(0, 8) as (Charge & { customer?: Customer })[]);
      setLoading(false);
    }

    loadData();
  }, []);

  function handleResendWhatsApp(charge: Charge & { customer?: Customer }) {
    const phone = charge.customer?.whatsapp;
    if (phone) {
      const msg = `Olá ${charge.customer?.name?.split(' ')[0]}, sua cobrança de ${formatCurrency(charge.value)} vence em ${formatDate(charge.due_date)}. Pague via PIX ou boleto.`;
      fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: msg }),
      });
    }
  }

  function handleResendEmail(charge: Charge & { customer?: Customer }) {
    const email = charge.customer?.email;
    if (email) {
      fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Cobrança CobrancaPro — ${formatCurrency(charge.value)}`,
          chargeId: charge.id,
        }),
      });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das suas cobranças e receitas
          </p>
        </div>
        <Link href="/charges">
          <Button variant="outline" size="sm">
            Ver todas cobranças
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total to receive */}
        <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">A Receber (Mês)</p>
              <p className="text-2xl font-bold mt-2 text-slate-800">
                {formatCurrency(stats.totalToReceive)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.pendingCount} cobranças pendentes
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Overdue */}
        <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Vencido</p>
              <p className="text-2xl font-bold mt-2 text-red-600">
                {formatCurrency(stats.overdue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-red-500" />
                {stats.overdueCount} cobranças vencidas
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </Card>

        {/* Paid this month */}
        <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Pago (Mês)</p>
              <p className="text-2xl font-bold mt-2 text-emerald-600">
                {formatCurrency(stats.paidThisMonth)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                {stats.paidCount} cobranças pagas
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        {/* MRR */}
        <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">MRR</p>
              <p className="text-2xl font-bold mt-2 text-slate-800">
                {formatCurrency(stats.mrr)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Receita recorrente mensal
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-slate-700" />
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-6 border-border/60">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Pagamentos por Mês</h2>
            <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
          </div>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPendente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorVencido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${v}`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="pago"
                name="Pago"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorPago)"
              />
              <Area
                type="monotone"
                dataKey="pendente"
                name="Pendente"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#colorPendente)"
              />
              <Area
                type="monotone"
                dataKey="vencido"
                name="Vencido"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorVencido)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent charges */}
      <Card className="border-border/60 overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold">Cobranças Recentes</h2>
          <p className="text-sm text-muted-foreground">Últimas cobranças criadas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-6 py-3">Cliente</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Vencimento</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right font-medium text-muted-foreground px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentCharges.map((charge) => (
                <tr key={charge.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800">
                      {charge.customer?.name || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {charge.customer?.email || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {formatDate(charge.due_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(Number(charge.value))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={`font-medium border ${statusColors[charge.status] || ''}`}
                    >
                      {statusLabels[charge.status] || charge.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleResendWhatsApp(charge)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                        title="Reenviar WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResendEmail(charge)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Reenviar Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      {charge.billet_pdf_url && (
                        <a
                          href={charge.billet_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                          title="Ver Boleto"
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
