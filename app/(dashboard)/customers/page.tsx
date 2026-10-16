'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPhone, formatCPF_CNPJ } from '@/lib/format';
import type { Customer } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  Users,
  Mail,
  Phone,
  Building2,
  Loader2,
  Store,
  Contact as ContactIcon,
} from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  name: '',
  trade_name: '',
  cpf_cnpj: '',
  email: '',
  whatsapp: '',
  state_registration: '',
  municipal_registration: '',
  zip_code: '',
  street: '',
  street_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  contact_person: '',
  notes: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [consulting, setConsulting] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingCustomer(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setEditingCustomer(c);
    setForm({
      name: c.name || '',
      trade_name: c.trade_name || '',
      cpf_cnpj: c.cpf_cnpj || '',
      email: c.email || '',
      whatsapp: c.whatsapp || '',
      state_registration: c.state_registration || '',
      municipal_registration: c.municipal_registration || '',
      zip_code: c.zip_code || '',
      street: c.street || '',
      street_number: c.street_number || '',
      complement: c.complement || '',
      neighborhood: c.neighborhood || '',
      city: c.city || '',
      state: c.state || '',
      contact_person: c.contact_person || '',
      notes: c.notes || '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.cpf_cnpj) {
      toast.error('Nome e CPF/CNPJ são obrigatórios');
      return;
    }

    // Build full address from parts if individual fields exist
    const fullAddress = [form.street, form.street_number, form.complement, form.neighborhood, form.city, form.state, form.zip_code]
      .filter(Boolean)
      .join(', ');

    const payload = { ...form, address: fullAddress || null };

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', editingCustomer.id);
      if (error) {
        toast.error('Erro ao atualizar cliente');
        return;
      }
      toast.success('Cliente atualizado com sucesso');
    } else {
      const { error } = await supabase.from('customers').insert(payload);
      if (error) {
        toast.error('Erro ao criar cliente');
        return;
      }
      toast.success('Cliente criado com sucesso');
    }

    setDialogOpen(false);
    loadCustomers();
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Excluir cliente ${c.name}?`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) {
      toast.error('Erro ao excluir cliente');
      return;
    }
    toast.success('Cliente excluído');
    loadCustomers();
  }

  function handleCSVImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      const imported: Record<string, string>[] = [];

      const startIndex = /nome|name/i.test(lines[0]) ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 2) {
          imported.push({
            name: cols[0] || '',
            cpf_cnpj: cols[1] || '',
            email: cols[2] || '',
            whatsapp: cols[3] || '',
            address: cols[4] || '',
          });
        }
      }

      if (imported.length === 0) {
        toast.error('Nenhum cliente válido encontrado no CSV');
        return;
      }

      const { error } = await supabase.from('customers').insert(imported);
      if (error) {
        toast.error('Erro ao importar clientes');
        return;
      }
      toast.success(`${imported.length} clientes importados`);
      loadCustomers();
    };
    input.click();
  }

  async function handleConsultarCNPJ() {
    const cnpj = form.cpf_cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      toast.error('Digite um CNPJ valido (14 digitos) para consultar');
      return;
    }
    setConsulting(true);
    try {
      const res = await fetch(`/api/consultar/cnpj/${cnpj}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Erro ao consultar CNPJ');
        setConsulting(false);
        return;
      }
      const d = json.data;
      setForm((prev) => ({
        ...prev,
        name: d.name || prev.name,
        trade_name: d.trade_name || prev.trade_name,
        cpf_cnpj: cnpj,
        email: d.email || prev.email,
        whatsapp: d.whatsapp || prev.whatsapp,
        zip_code: d.zip_code || prev.zip_code,
        street: d.street || prev.street,
        street_number: d.street_number || prev.street_number,
        complement: d.complement || prev.complement,
        neighborhood: d.neighborhood || prev.neighborhood,
        city: d.city || prev.city,
        state: d.state || prev.state,
        state_registration: d.state_registration || 'ISENTO',
      }));
      toast.success(`Dados carregados: ${d.name}`);
      if (d.situacao) {
        toast.info(`Situacao cadastral: ${d.situacao}`);
      }
    } catch {
      toast.error('Erro de conexao ao consultar Sintegra');
    }
    setConsulting(false);
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.trade_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.cpf_cnpj.includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {customers.length} cliente{customers.length !== 1 ? 's' : ''} cadastrado{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSVImport}>
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, fantasia, CPF/CNPJ ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-6 py-3">Nome</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">CPF/CNPJ</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Contato</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Cidade/UF</th>
                <th className="text-right font-medium text-muted-foreground px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3">
                      <div className="font-medium text-foreground">{c.name}</div>
                      {c.trade_name && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          {c.trade_name}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground md:hidden">
                        {formatCPF_CNPJ(c.cpf_cnpj)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {formatCPF_CNPJ(c.cpf_cnpj)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {c.email}
                          </span>
                        )}
                      </div>
                      {c.whatsapp && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="w-3 h-3" /> {formatPhone(c.whatsapp)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                      {c.city || c.state ? `${c.city || ''}${c.city && c.state ? ' / ' : ''}${c.state || ''}` : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                          title="Excluir"
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Section: Dados Principais */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Dados da Empresa
              </h3>
              <div className="space-y-2">
                <Label htmlFor="name">Razão Social / Nome *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="João Silva Santos ME"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade_name">Nome Fantasia</Label>
                <Input
                  id="trade_name"
                  value={form.trade_name}
                  onChange={(e) => setField('trade_name', e.target.value)}
                  placeholder="Mercado do João"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
                <div className="flex gap-2">
                  <Input
                    id="cpf_cnpj"
                    value={form.cpf_cnpj}
                    onChange={(e) => setField('cpf_cnpj', e.target.value)}
                    placeholder="12.345.678/0001-90"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConsultarCNPJ}
                    disabled={consulting}
                    className="shrink-0"
                    title="Consultar dados do CNPJ no Sintegra"
                  >
                    {consulting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Sintegra</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o CNPJ e clique em Sintegra para preencher automaticamente os dados da empresa.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state_registration">Inscrição Estadual (IE)</Label>
                  <Input
                    id="state_registration"
                    value={form.state_registration}
                    onChange={(e) => setField('state_registration', e.target.value)}
                    placeholder="123.456.789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipal_registration">Inscrição Municipal (IM)</Label>
                  <Input
                    id="municipal_registration"
                    value={form.municipal_registration}
                    onChange={(e) => setField('municipal_registration', e.target.value)}
                    placeholder="98.765.432-1"
                  />
                </div>
              </div>
            </div>

            {/* Section: Contato */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <ContactIcon className="w-3.5 h-3.5" />
                Contato
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="joao@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setField('whatsapp', e.target.value)}
                    placeholder="11987654321"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Pessoa de Contato / Responsável</Label>
                <Input
                  id="contact_person"
                  value={form.contact_person}
                  onChange={(e) => setField('contact_person', e.target.value)}
                  placeholder="Maria Silva ( Financeiro )"
                />
              </div>
            </div>

            {/* Section: Endereço */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                Endereço
              </h3>
              <div className="grid grid-cols-[1fr_100px_120px] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="street">Logradouro</Label>
                  <Input
                    id="street"
                    value={form.street}
                    onChange={(e) => setField('street', e.target.value)}
                    placeholder="Rua das Flores"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street_number">Número</Label>
                  <Input
                    id="street_number"
                    value={form.street_number}
                    onChange={(e) => setField('street_number', e.target.value)}
                    placeholder="123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={form.complement}
                    onChange={(e) => setField('complement', e.target.value)}
                    placeholder="Sala 2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={(e) => setField('neighborhood', e.target.value)}
                    placeholder="Centro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP</Label>
                  <Input
                    id="zip_code"
                    value={form.zip_code}
                    onChange={(e) => setField('zip_code', e.target.value)}
                    placeholder="01234-567"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setField('city', e.target.value)}
                    placeholder="São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => setField('state', e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                  />
                </div>
              </div>
            </div>

            {/* Section: Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Anotações gerais sobre o cliente..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
