'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Loader2, Receipt, CalendarDays, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

 type Customer = {
  id: string;
  name: string;
};

export default function EmitirPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState('2');
  const [installmentStart, setInstallmentStart] = useState<'this_month' | 'next_month'>('this_month');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ count: number; message: string } | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      const { data } = await supabase.from('customers').select('id, name').order('name');
      setCustomers((data as Customer[]) || []);
      setLoading(false);
    }
    loadCustomers();
  }, []);

  async function handleCreateSale() {
    const numericValue = Number(value);
    if (!customerId) {
      toast.error('Selecione um cliente.');
      return;
    }
    if (!numericValue || numericValue <= 0) {
      toast.error('Digite um valor válido.');
      return;
    }
    if (!dueDate) {
      toast.error('Informe o vencimento.');
      return;
    }
    if (isInstallment && (Number(installments) < 2 || Number(installments) > 36)) {
      toast.error('Escolha entre 2 e 36 parcelas.');
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const response = await fetch('/api/charges/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          saleValue: numericValue,
          saleDescription: description.trim() || 'Venda avulsa',
          dueDate,
          installments: isInstallment ? Number(installments) : 1,
          installmentStart,
        }),
      });
      const data = await response.json() as { success?: boolean; charges?: unknown[]; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error || 'Não foi possível criar a venda.');
        return;
      }
      const count = data.charges?.length || 1;
      setResult({ count, message: count > 1 ? `${count} cobranças foram geradas.` : 'A cobrança foi gerada.' });
      toast.success('Venda avulsa criada com sucesso.');
      setValue('');
      setDescription('');
      setIsInstallment(false);
    } catch {
      toast.error('Não foi possível conectar ao servidor.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShoppingCart className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold tracking-tight">Venda Avulsa</h1><p className="mt-1 text-sm text-muted-foreground">Gere uma cobrança única ou venda parcelada sem criar uma assinatura.</p></div></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-border pb-4"><Receipt className="h-4 w-4 text-primary" /><h2 className="font-semibold">Dados da venda</h2></div>
          <div className="space-y-5">
            <div className="space-y-2"><Label>Cliente *</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sale-value">Valor total *</Label><Input id="sale-value" type="number" min="0.01" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} placeholder="199,90" /></div><div className="space-y-2"><Label htmlFor="sale-due">Vencimento</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="sale-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="pl-9" /></div></div></div>
            <div className="space-y-2"><Label htmlFor="sale-description">Descrição</Label><div className="relative"><FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><textarea id="sale-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: instalação, consultoria ou serviço extra" className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-9 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" /></div></div>
            <div className="rounded-xl border border-border p-4"><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={isInstallment} onChange={(event) => setIsInstallment(event.target.checked)} className="h-4 w-4 rounded border-border text-primary" /><span className="text-sm font-medium">Parcelar esta venda</span></label>{isInstallment && <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sale-installments">Número de parcelas</Label><Input id="sale-installments" type="number" min="2" max="36" value={installments} onChange={(event) => setInstallments(event.target.value)} /></div><div className="space-y-2"><Label>Início das parcelas</Label><div className="grid grid-cols-2 gap-2"><Button type="button" variant={installmentStart === 'this_month' ? 'default' : 'outline'} onClick={() => setInstallmentStart('this_month')} className="text-xs">Este mês</Button><Button type="button" variant={installmentStart === 'next_month' ? 'default' : 'outline'} onClick={() => setInstallmentStart('next_month')} className="text-xs">Próximo mês</Button></div></div></div>}</div>
            <Button onClick={handleCreateSale} disabled={saving || customers.length === 0} className="w-full"><ShoppingCart className="mr-2 h-4 w-4" />{saving ? 'Gerando cobrança...' : 'Gerar Venda Avulsa'}</Button>
            {customers.length === 0 && <p className="text-center text-xs text-muted-foreground">Cadastre um cliente antes de gerar uma venda.</p>}
          </div>
        </Card>

        <Card className="h-fit border-primary/20 bg-primary/[0.03] p-6"><h2 className="font-semibold text-primary">Resumo</h2><div className="mt-5 space-y-4 text-sm"><div className="flex items-start gap-3"><Receipt className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-medium">Cobrança independente</p><p className="mt-1 text-muted-foreground">Esta venda não cria uma assinatura nem cobranças recorrentes.</p></div></div><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-medium">Pix, boleto ou cobrança configurada</p><p className="mt-1 text-muted-foreground">A cobrança seguirá o fluxo de pagamento configurado para o sistema.</p></div></div>{isInstallment && Number(value) > 0 && Number(installments) >= 2 && <div className="rounded-lg border border-primary/20 bg-background p-3"><p className="font-medium text-primary">Parcelamento</p><p className="mt-1 text-muted-foreground">{installments}x de <span className="font-medium text-foreground">R$ {(Number(value) / Number(installments)).toFixed(2).replace('.', ',')}</span></p><p className="text-muted-foreground">Total: <span className="font-medium text-foreground">R$ {Number(value).toFixed(2).replace('.', ',')}</span></p></div>}</div>{result && <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><p className="font-medium">Venda criada</p><p className="mt-1">{result.message}</p></div>}</Card>
      </div>
    </div>
  );
}
