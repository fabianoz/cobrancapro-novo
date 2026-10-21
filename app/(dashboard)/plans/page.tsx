'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, cycleLabels } from '@/lib/format';
import type { Plan } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, CreditCard, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';

const emptyForm = {
  name: '',
  value: '',
  cycle: 'MONTHLY',
  due_day: '10',
  informar_data_assinatura: false,
  fine: '2',
  interest: '1',
  trial_days: '0',
};

export default function PlansPage() {
  const { empresaId, isSuperAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (empresaId === null && !isSuperAdmin) return;
    loadPlans();
  }, [empresaId, isSuperAdmin]);

  async function loadPlans() {
    setLoading(true);
    let query = supabase.from('plans').select('*').order('created_at', { ascending: false });
    if (!isSuperAdmin && empresaId) query = query.eq('empresa_id', empresaId);
    const { data } = await query;
    setPlans((data as Plan[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Plan) {
    setEditingPlan(p);
    setForm({
      name: p.name,
      value: String(p.value),
      cycle: p.cycle,
      due_day: String(p.due_day),
      informar_data_assinatura: (p as any).informar_data_assinatura ?? false,
      fine: String(p.fine),
      interest: String(p.interest),
      trial_days: String(p.trial_days),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.value) {
      toast.error('Nome e valor são obrigatórios');
      return;
    }

    const dueDay = parseInt(form.due_day, 10);
    if (dueDay < 1 || dueDay > 31) {
      toast.error('Dia de vencimento deve estar entre 1 e 31');
      return;
    }

    const payload = {
      name: form.name,
      value: parseFloat(form.value),
      cycle: form.cycle,
      due_day: dueDay,
      tipo_vencimento: 'DIA_FIXO',
      dia_vencimento: dueDay,
      informar_data_assinatura: form.informar_data_assinatura,
      fine: parseFloat(form.fine) || 0,
      interest: parseFloat(form.interest) || 0,
      trial_days: parseInt(form.trial_days, 10) || 0,
    };

    if (editingPlan) {
      const { error } = await supabase.from('plans').update(payload).eq('id', editingPlan.id);
      if (error) {
        toast.error('Erro ao atualizar plano');
        return;
      }
      toast.success('Plano atualizado');
    } else {
      const { error } = await supabase.from('plans').insert(payload);
      if (error) {
        toast.error('Erro ao criar plano');
        return;
      }
      toast.success('Plano criado');
    }

    setDialogOpen(false);
    loadPlans();
  }

  async function handleDelete(p: Plan) {
    if (!confirm(`Excluir plano ${p.name}?`)) return;
    const { error } = await supabase.from('plans').delete().eq('id', p.id);
    if (error) {
      toast.error('Erro ao excluir — verifique assinaturas vinculadas');
      return;
    }
    toast.success('Plano excluído');
    loadPlans();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plans.length} plano{plans.length !== 1 ? 's' : ''} cadastrado{plans.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center border-border/60">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Nenhum plano cadastrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="p-5 border-border/60 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{p.name}</h3>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {cycleLabels[p.cycle] || p.cycle}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-4">
                {formatCurrency(Number(p.value))}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  /{p.cycle === 'WEEKLY' ? 'sem' : p.cycle === 'MONTHLY' ? 'mês' : 'ano'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Vencimento
                  </span>
                  <span className="font-medium text-foreground">
                    Dia {p.dia_vencimento || p.due_day}
                  </span>
                </div>
                {(p as any).informar_data_assinatura && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Data personalizada</span>
                    <span className="font-medium text-foreground text-xs">Sim (na assinatura)</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Multa</span>
                  <span className="font-medium text-foreground">{p.fine}%</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Juros</span>
                  <span className="font-medium text-foreground">{p.interest}%/mês</span>
                </div>
                {p.trial_days > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Período de teste</span>
                    <span className="font-medium text-foreground">{p.trial_days} dias</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Nome do Plano *</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Plano Profissional Mensal"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-value">Valor (R$) *</Label>
                <Input
                  id="plan-value"
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="99.90"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-cycle">Ciclo</Label>
                <Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v })}>
                  <SelectTrigger id="plan-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-due-day">Dia Fixo de Vencimento (1 a 31) *</Label>
              <Select value={form.due_day} onValueChange={(v) => setForm({ ...form, due_day: v })}>
                <SelectTrigger id="plan-due-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Checkbox
                id="informar-data"
                checked={form.informar_data_assinatura}
                onCheckedChange={(checked) => setForm({ ...form, informar_data_assinatura: checked === true })}
              />
              <div>
                <Label htmlFor="informar-data" className="text-sm cursor-pointer font-medium">
                  Informar data na assinatura?
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se marcado, ao criar assinatura o sistema pergunta qual data usar (para contratos personalizados)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-fine">Multa (%)</Label>
                <Input
                  id="plan-fine"
                  type="number"
                  step="0.01"
                  value={form.fine}
                  onChange={(e) => setForm({ ...form, fine: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-interest">Juros (%)</Label>
                <Input
                  id="plan-interest"
                  type="number"
                  step="0.01"
                  value={form.interest}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-trial">Dias de Teste</Label>
              <Input
                id="plan-trial"
                type="number"
                min="0"
                value={form.trial_days}
                onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}