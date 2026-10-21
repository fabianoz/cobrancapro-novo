'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Empresa } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  nome: '',
  razao_social: '',
  cnpj: '',
  email: '',
  whatsapp: '',
  plano: 'PRO',
  status: 'ATIVO',
  max_users: 5,
};

const planoLabels: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const statusColors: Record<string, string> = {
  ATIVO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENSO: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELADO: 'bg-red-50 text-red-700 border-red-200',
};

export default function EmpresasPage() {
  const { isSuperAdmin } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadEmpresas();
  }, [isSuperAdmin]);

  async function loadEmpresas() {
    setLoading(true);
    const { data } = await supabase
      .from('empresas')
      .select('*')
      .order('created_at', { ascending: false });
    setEmpresas((data as Empresa[]) || []);

    const counts: Record<string, number> = {};
    for (const emp of (data as Empresa[]) || []) {
      const { count } = await supabase
        .from('usuarios_sistema')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', emp.id);
      counts[emp.id] = count || 0;
    }
    setUserCounts(counts);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(emp: Empresa) {
    setEditing(emp);
    setForm({
      nome: emp.nome || '',
      razao_social: emp.razao_social || '',
      cnpj: emp.cnpj || '',
      email: emp.email || '',
      whatsapp: emp.whatsapp || '',
      plano: emp.plano || 'PRO',
      status: emp.status || 'ATIVO',
      max_users: emp.max_users || 5,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    const payload = {
      nome: form.nome,
      razao_social: form.razao_social || null,
      cnpj: form.cnpj || null,
      email: form.email || null,
      whatsapp: form.whatsapp || null,
      plano: form.plano,
      status: form.status,
      max_users: Number(form.max_users) || 5,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase
        .from('empresas')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        toast.error('Erro ao atualizar empresa');
        return;
      }
      toast.success('Empresa atualizada');
    } else {
      const { error } = await supabase.from('empresas').insert(payload);
      if (error) {
        toast.error('Erro ao criar empresa');
        return;
      }
      toast.success('Empresa criada com sucesso');
    }

    setDialogOpen(false);
    loadEmpresas();
  }

  async function handleDelete(emp: Empresa) {
    if (emp.nome === 'Matriz') {
      toast.error('A empresa Matriz não pode ser excluída');
      return;
    }
    if (!confirm(`Excluir empresa ${emp.nome}? Todos os dados vinculados serão desassociados.`)) return;
    const { error } = await supabase.from('empresas').delete().eq('id', emp.id);
    if (error) {
      toast.error('Erro ao excluir empresa');
      return;
    }
    toast.success('Empresa excluída');
    loadEmpresas();
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Apenas super administradores podem gerenciar empresas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas (Revendas)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="p-8 col-span-full text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Carregando empresas...
          </Card>
        ) : empresas.length === 0 ? (
          <Card className="p-8 col-span-full text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nenhuma empresa encontrada
          </Card>
        ) : (
          empresas.map((emp) => (
            <Card key={emp.id} className="p-5 border-border/60 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate">{emp.nome}</h3>
                  {emp.razao_social && (
                    <p className="text-xs text-muted-foreground truncate">{emp.razao_social}</p>
                  )}
                </div>
                <Badge variant="outline" className={`shrink-0 ${statusColors[emp.status] || ''}`}>
                  {emp.status}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                {emp.cnpj && <p>CNPJ: {emp.cnpj}</p>}
                {emp.email && <p>{emp.email}</p>}
                {emp.whatsapp && <p>{emp.whatsapp}</p>}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {planoLabels[emp.plano] || emp.plano}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {userCounts[emp.id] || 0}/{emp.max_users} usuários
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(emp)}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(emp)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empresa' : 'Nova Empresa (Revenda)'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="emp-nome">Nome *</Label>
              <Input
                id="emp-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Empresa Cliente Ltda"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-razao">Razão Social</Label>
              <Input
                id="emp-razao"
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                placeholder="Empresa Cliente Ltda ME"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-cnpj">CNPJ</Label>
                <Input
                  id="emp-cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="12.345.678/0001-90"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-max-users">Máx. Usuários</Label>
                <Input
                  id="emp-max-users"
                  type="number"
                  min={1}
                  value={form.max_users}
                  onChange={(e) => setForm({ ...form, max_users: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-whatsapp">WhatsApp</Label>
                <Input
                  id="emp-whatsapp"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="11987654321"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={form.plano}
                  onValueChange={(v) => setForm({ ...form, plano: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
