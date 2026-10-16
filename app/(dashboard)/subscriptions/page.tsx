'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, cycleLabels, statusColors, statusLabels } from '@/lib/format';
import type { Subscription, Customer, Plan, SubscriptionAddon } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Pause,
  Play,
  XCircle,
  PackagePlus,
  Clock,
  Loader2,
  Calendar,
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';

type SubWithRelations = Subscription & { customer?: Customer; plan?: Plan; addons?: SubscriptionAddon[] };

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubWithRelations[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubWithRelations | null>(null);
  const [form, setForm] = useState({ customer_id: '', plan_id: '', start_date: '', status: 'ACTIVE', billing_start: 'this_month', sign_date: '' });

  // Addon dialog
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addonSub, setAddonSub] = useState<SubWithRelations | null>(null);
  const [addonForm, setAddonForm] = useState({ name: '', value: '', total_months: '1' });
  const [addonSaving, setAddonSaving] = useState(false);

  const [subSaving, setSubSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [subsRes, custRes, plansRes] = await Promise.all([
      supabase.from('subscriptions').select('*, customer:customers(*), plan:plans(*), addons:subscription_addons(*)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
      supabase.from('plans').select('*').order('name'),
    ]);
    setSubscriptions((subsRes.data as SubWithRelations[]) || []);
    setCustomers((custRes.data as Customer[]) || []);
    setPlans((plansRes.data as Plan[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingSub(null);
    const today = new Date().toISOString().split('T')[0];
    setForm({ customer_id: '', plan_id: '', start_date: today, status: 'ACTIVE', billing_start: 'this_month', sign_date: today });
    setDialogOpen(true);
  }

  function openEdit(s: SubWithRelations) {
    setEditingSub(s);
    setForm({
      customer_id: s.customer_id,
      plan_id: s.plan_id,
      start_date: s.start_date,
      status: s.status,
      billing_start: 'this_month',
      sign_date: s.start_date,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.customer_id || !form.plan_id) {
      toast.error('Selecione cliente e plano');
      return;
    }

    const plan = plans.find((p) => p.id === form.plan_id);
    if (!plan) return;

    setSubSaving(true);

    const useSignDate = plan.informar_data_assinatura && form.sign_date;
    const baseDate = useSignDate ? new Date(form.sign_date) : new Date(form.start_date);
    const nextBilling = new Date(baseDate);

    if (useSignDate) {
      const maxDay = new Date(nextBilling.getFullYear(), nextBilling.getMonth() + 1, 0).getDate();
      nextBilling.setDate(Math.min(plan.due_day, maxDay));
    } else if (form.billing_start === 'next_month' && plan.cycle !== 'WEEKLY') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      const maxDay = new Date(nextBilling.getFullYear(), nextBilling.getMonth() + 1, 0).getDate();
      nextBilling.setDate(Math.min(plan.due_day, maxDay));
    } else {
      if (plan.cycle === 'WEEKLY') {
        nextBilling.setDate(nextBilling.getDate() + 7);
      } else {
        const maxDay = new Date(nextBilling.getFullYear(), nextBilling.getMonth() + 1, 0).getDate();
        nextBilling.setDate(Math.min(plan.due_day, maxDay));
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (nextBilling < today) {
        if (plan.cycle === 'WEEKLY') {
          nextBilling.setDate(nextBilling.getDate() + 7);
        } else if (plan.cycle === 'YEARLY') {
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        } else {
          nextBilling.setMonth(nextBilling.getMonth() + 1);
          const maxDay2 = new Date(nextBilling.getFullYear(), nextBilling.getMonth() + 1, 0).getDate();
          nextBilling.setDate(Math.min(plan.due_day, maxDay2));
        }
      }
    }

    const dueDateStr = nextBilling.toISOString().split('T')[0];

    const payload = {
      customer_id: form.customer_id,
      plan_id: form.plan_id,
      start_date: form.start_date,
      status: form.status,
      next_billing_date: form.status === 'ACTIVE' ? dueDateStr : null,
    };

    let subscriptionId: string | null = null;

    if (editingSub) {
      const { error } = await supabase.from('subscriptions').update(payload).eq('id', editingSub.id);
      if (error) {
        toast.error('Erro ao atualizar assinatura');
        setSubSaving(false);
        return;
      }
      subscriptionId = editingSub.id;
      toast.success('Assinatura atualizada');
    } else {
      const { data: inserted, error } = await supabase
        .from('subscriptions')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        toast.error('Erro ao criar assinatura');
        setSubSaving(false);
        return;
      }
      subscriptionId = inserted.id;
      toast.success('Assinatura criada — gerando cobrança e enviando WhatsApp...');
    }

    setDialogOpen(false);
    loadAll();

    // Auto-generate charges (3 when plan has informar_data_assinatura, else 1)
    if (subscriptionId && form.status === 'ACTIVE') {
      const numCharges = useSignDate ? 3 : 1;
      let successCount = 0;
      let lastError = '';

      for (let i = 0; i < numCharges; i++) {
        const chargeDate = new Date(nextBilling);
        chargeDate.setMonth(chargeDate.getMonth() + i);
        const maxD = new Date(chargeDate.getFullYear(), chargeDate.getMonth() + 1, 0).getDate();
        chargeDate.setDate(Math.min(plan.due_day, maxD));
        const chargeDueStr = chargeDate.toISOString().split('T')[0];

        try {
          const res = await fetch('/api/charges/faturar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptionId,
              customerId: form.customer_id,
              dueDate: chargeDueStr,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            successCount++;
          } else {
            lastError = data.error || 'Erro ao gerar cobrança';
          }
        } catch {
          lastError = 'Erro de conexão ao gerar cobrança';
        }
      }

      if (successCount > 0) {
        toast.success(
          numCharges > 1
            ? `${successCount} cobrança(s) gerada(s) e enviada(s) no WhatsApp`
            : 'Cobrança gerada e enviada no WhatsApp'
        );
        if (lastError && successCount < numCharges) {
          toast.error(`Algumas cobranças falharam: ${lastError}`);
        }
      } else {
        toast.error(lastError || 'Erro ao gerar cobrança');
      }
    }

    setSubSaving(false);
  }

  async function handleStatusChange(s: SubWithRelations, newStatus: string) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: newStatus, next_billing_date: newStatus === 'ACTIVE' ? new Date().toISOString().split('T')[0] : null })
      .eq('id', s.id);
    if (error) {
      toast.error('Erro ao alterar status');
      return;
    }
    toast.success(`Assinatura ${newStatus === 'ACTIVE' ? 'ativada' : newStatus === 'PAUSED' ? 'pausada' : 'cancelada'}`);
    loadAll();
  }

  async function handleDelete(s: SubWithRelations) {
    if (!confirm('Excluir esta assinatura?')) return;
    const { error } = await supabase.from('subscriptions').delete().eq('id', s.id);
    if (error) {
      toast.error('Erro ao excluir assinatura');
      return;
    }
    toast.success('Assinatura excluída');
    loadAll();
  }

  // --- Addon management ---
  function openAddonDialog(s: SubWithRelations) {
    setAddonSub(s);
    setAddonForm({ name: '', value: '', total_months: '1' });
    setAddonDialogOpen(true);
  }

  async function handleAddAddon() {
    if (!addonSub) return;
    if (!addonForm.name || !addonForm.value) {
      toast.error('Preencha nome e valor do serviço adicional');
      return;
    }
    setAddonSaving(true);
    const { error } = await supabase.from('subscription_addons').insert({
      subscription_id: addonSub.id,
      name: addonForm.name,
      value: Number(addonForm.value),
      total_months: Number(addonForm.total_months),
      remaining_months: Number(addonForm.total_months),
      status: 'ACTIVE',
    });
    if (error) {
      toast.error('Erro ao adicionar serviço');
      setAddonSaving(false);
      return;
    }
    toast.success('Serviço adicional adicionado');
    setAddonDialogOpen(false);
    setAddonSaving(false);
    loadAll();
  }

  async function handleDeleteAddon(addon: SubscriptionAddon) {
    if (!confirm(`Excluir o serviço adicional "${addon.name}"?`)) return;
    const { error } = await supabase.from('subscription_addons').delete().eq('id', addon.id);
    if (error) {
      toast.error('Erro ao excluir serviço');
      return;
    }
    toast.success('Serviço removido');
    loadAll();
  }

  function getActiveAddons(s: SubWithRelations): SubscriptionAddon[] {
    return (s.addons || []).filter((a) => a.status === 'ACTIVE' && a.remaining_months > 0);
  }

  function getTotalWithAddons(s: SubWithRelations): number {
    const base = s.plan ? Number(s.plan.value) : 0;
    const addonSum = getActiveAddons(s).reduce((sum, a) => sum + Number(a.value), 0);
    return base + addonSum;
  }

  const selectedPlan = plans.find((p) => p.id === form.plan_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assinaturas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {subscriptions.length} assinatura{subscriptions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={openNew} disabled={customers.length === 0 || plans.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Assinatura
          </Button>
        </div>
      </div>

      <Card className="border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-6 py-3">Cliente</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Plano</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Valor Total</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Próx. Cobrança</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right font-medium text-muted-foreground px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhuma assinatura encontrada
                  </td>
                </tr>
              ) : (
                subscriptions.map((s) => {
                  const activeAddons = getActiveAddons(s);
                  const totalValue = getTotalWithAddons(s);
                  return (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3">
                        <div className="font-medium text-foreground">{s.customer?.name || '—'}</div>
                        {activeAddons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {activeAddons.map((a) => (
                              <Badge key={a.id} variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                                <PackagePlus className="w-2.5 h-2.5 mr-1" />
                                {a.name} (+{formatCurrency(Number(a.value))}) • {a.remaining_months}/{a.total_months}m
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-foreground">{s.plan?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{cycleLabels[s.plan?.cycle || '']}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="font-medium">{formatCurrency(totalValue)}</div>
                        {activeAddons.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(Number(s.plan?.value || 0))} + {formatCurrency(totalValue - Number(s.plan?.value || 0))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                        {s.next_billing_date ? formatDate(s.next_billing_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`font-medium border ${statusColors[s.status] || ''}`}>
                          {s.status === 'ACTIVE' ? 'Ativa' : s.status === 'PAUSED' ? 'Pausada' : 'Cancelada'}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === 'ACTIVE' && (
                            <button
                              onClick={() => openAddonDialog(s)}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                              title="Adicionar serviço por X meses"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                          )}
                          {s.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleStatusChange(s, 'PAUSED')}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                              title="Pausar"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {s.status === 'PAUSED' && (
                            <button
                              onClick={() => handleStatusChange(s, 'ACTIVE')}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                              title="Ativar"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {s.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleStatusChange(s, 'CANCELLED')}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                              title="Cancelar"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Subscription dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Editar Assinatura' : 'Nova Assinatura'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plano *</Label>
              <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(Number(p.value))} /{cycleLabels[p.cycle]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sub-start">Data de Início</Label>
                <Input
                  id="sub-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Ativa</SelectItem>
                    <SelectItem value="PAUSED">Pausada</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingSub && selectedPlan?.informar_data_assinatura && (
              <div className="space-y-2">
                <Label htmlFor="sub-sign-date">Data da Assinatura *</Label>
                <Input
                  id="sub-sign-date"
                  type="date"
                  value={form.sign_date}
                  onChange={(e) => setForm({ ...form, sign_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Serão geradas 3 cobranças automáticas (este mês e próximos 2 meses) no dia {selectedPlan?.due_day}.
                </p>
              </div>
            )}
            {!editingSub && !selectedPlan?.informar_data_assinatura && (
              <div className="space-y-2">
                <Label>Primeira Cobrança</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, billing_start: 'this_month' })}
                    className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 text-sm transition-all ${
                      form.billing_start === 'this_month'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Este Mês</span>
                    <span className="text-xs opacity-80">Cobrar já no vencimento deste mês</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, billing_start: 'next_month' })}
                    className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 text-sm transition-all ${
                      form.billing_start === 'next_month'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <CalendarClock className="w-4 h-4" />
                    <span className="font-medium">Próximo Mês</span>
                    <span className="text-xs opacity-80">Começar a cobrar no mês que vem</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={subSaving}>
              {subSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {subSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Addon dialog */}
      <Dialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-primary" />
              Serviço Adicional Temporário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Este serviço será cobrado junto com a mensalidade por um número limitado de meses.
            </p>
            {addonSub && (
              <div className="rounded-lg bg-muted/30 border border-border p-3 text-sm">
                <span className="text-muted-foreground">Cliente: </span>
                <span className="font-medium">{addonSub.customer?.name}</span>
                <br />
                <span className="text-muted-foreground">Plano: </span>
                <span className="font-medium">{addonSub.plan?.name} — {formatCurrency(Number(addonSub.plan?.value || 0))}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="addon-name">Nome do Serviço *</Label>
              <Input
                id="addon-name"
                value={addonForm.name}
                onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                placeholder="Ex: Instalação, Taxa de Setup, Serviço Extra..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addon-value">Valor Mensal *</Label>
                <Input
                  id="addon-value"
                  type="number"
                  step="0.01"
                  value={addonForm.value}
                  onChange={(e) => setAddonForm({ ...addonForm, value: e.target.value })}
                  placeholder="50.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-months">Quantidade de Meses *</Label>
                <Input
                  id="addon-months"
                  type="number"
                  min="1"
                  max="36"
                  value={addonForm.total_months}
                  onChange={(e) => setAddonForm({ ...addonForm, total_months: e.target.value })}
                  placeholder="3"
                />
              </div>
            </div>
            {addonForm.value && addonForm.total_months && Number(addonForm.value) > 0 && Number(addonForm.total_months) > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <Clock className="w-4 h-4" />
                  Resumo
                </div>
                <p className="mt-1 text-muted-foreground">
                  +{formatCurrency(Number(addonForm.value))} por mês durante {addonForm.total_months} {Number(addonForm.total_months) === 1 ? 'mês' : 'meses'}.
                  <br />
                  Total adicional: <span className="font-medium text-foreground">{formatCurrency(Number(addonForm.value) * Number(addonForm.total_months))}</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddAddon} disabled={addonSaving}>
              {addonSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackagePlus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
