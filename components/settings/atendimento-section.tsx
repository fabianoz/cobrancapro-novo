'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Users2,
  Building2,
  GripVertical,
  Loader2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

type Setor = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
};

type Atendente = {
  id: string;
  nome: string;
  email: string | null;
  foto: string | null;
  status: string;
};

function getInitials(nome: string): string {
  const parts = nome.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AtendimentoSection() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [setorDialogOpen, setSetorDialogOpen] = useState(false);
  const [novoSetorNome, setNovoSetorNome] = useState('');
  const [atendenteDialogOpen, setAtendenteDialogOpen] = useState(false);
  const [novoAtendenteNome, setNovoAtendenteNome] = useState('');
  const [novoAtendenteEmail, setNovoAtendenteEmail] = useState('');
  const [editSetorId, setEditSetorId] = useState<string | null>(null);
  const [editSetorNome, setEditSetorNome] = useState('');

  const loadData = useCallback(async () => {
    const [resSetores, resAtendentes] = await Promise.all([
      fetch('/api/atendimento/setores'),
      fetch('/api/atendimento/atendentes'),
    ]);
    if (resSetores.ok) setSetores(await resSetores.json());
    if (resAtendentes.ok) setAtendentes(await resAtendentes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleSetor(setor: Setor, ativo: boolean) {
    setSetores((prev) => prev.map((s) => (s.id === setor.id ? { ...s, ativo } : s)));
    const res = await fetch(`/api/atendimento/setores/${setor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo }),
    });
    if (!res.ok) {
      toast.error('Erro ao atualizar setor');
      setSetores((prev) => prev.map((s) => (s.id === setor.id ? { ...s, ativo: !ativo } : s)));
    }
  }

  async function criarSetor() {
    if (!novoSetorNome.trim()) {
      toast.error('Informe o nome do setor');
      return;
    }
    const res = await fetch('/api/atendimento/setores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoSetorNome.trim() }),
    });
    if (res.ok) {
      const novo = await res.json();
      setSetores((prev) => [...prev, novo]);
      toast.success('Setor criado');
      setNovoSetorNome('');
      setSetorDialogOpen(false);
    } else {
      toast.error('Erro ao criar setor');
    }
  }

  async function salvarEditSetor() {
    if (!editSetorId || !editSetorNome.trim()) return;
    const res = await fetch(`/api/atendimento/setores/${editSetorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: editSetorNome.trim() }),
    });
    if (res.ok) {
      setSetores((prev) =>
        prev.map((s) => (s.id === editSetorId ? { ...s, nome: editSetorNome.trim() } : s))
      );
      toast.success('Setor atualizado');
      setEditSetorId(null);
      setEditSetorNome('');
    } else {
      toast.error('Erro ao atualizar setor');
    }
  }

  async function excluirSetor(id: string) {
    const res = await fetch(`/api/atendimento/setores/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSetores((prev) => prev.filter((s) => s.id !== id));
      toast.success('Setor removido');
    } else {
      toast.error('Erro ao remover setor');
    }
  }

  async function criarAtendente() {
    if (!novoAtendenteNome.trim()) {
      toast.error('Informe o nome do atendente');
      return;
    }
    const res = await fetch('/api/atendimento/atendentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: novoAtendenteNome.trim(),
        email: novoAtendenteEmail.trim() || null,
      }),
    });
    if (res.ok) {
      const novo = await res.json();
      setAtendentes((prev) => [...prev, novo]);
      toast.success('Atendente adicionado');
      setNovoAtendenteNome('');
      setNovoAtendenteEmail('');
      setAtendenteDialogOpen(false);
    } else {
      toast.error('Erro ao adicionar atendente');
    }
  }

  async function excluirAtendente(id: string) {
    const res = await fetch(`/api/atendimento/atendentes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAtendentes((prev) => prev.filter((a) => a.id !== id));
      toast.success('Atendente removido');
    } else {
      toast.error('Erro ao remover atendente');
    }
  }

  async function toggleAtendenteStatus(atendente: Atendente) {
    const novoStatus = atendente.status === 'online' ? 'offline' : 'online';
    setAtendentes((prev) =>
      prev.map((a) => (a.id === atendente.id ? { ...a, status: novoStatus } : a))
    );
    await fetch(`/api/atendimento/atendentes/${atendente.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Setores</h3>
          </div>
          <Dialog open={setorDialogOpen} onOpenChange={setSetorDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Novo Setor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Setor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="setor-nome">Nome do Setor</Label>
                  <Input
                    id="setor-nome"
                    placeholder="Ex: Suporte, Financeiro, Vendas..."
                    value={novoSetorNome}
                    onChange={(e) => setNovoSetorNome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && criarSetor()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={criarSetor}>Criar Setor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {setores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum setor cadastrado. Clique em "Novo Setor" para começar.
            </p>
          ) : (
            setores.map((setor) => (
              <div
                key={setor.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/40 transition-colors"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                {editSetorId === setor.id ? (
                  <Input
                    value={editSetorNome}
                    onChange={(e) => setEditSetorNome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && salvarEditSetor()}
                    className="max-w-xs"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 font-medium">{setor.nome}</span>
                )}
                <div className="flex items-center gap-2">
                  {editSetorId === setor.id ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={salvarEditSetor}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditSetorId(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Badge variant={setor.ativo ? 'default' : 'secondary'}>
                        {setor.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Switch checked={setor.ativo} onCheckedChange={(v) => toggleSetor(setor, v)} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => { setEditSetorId(setor.id); setEditSetorNome(setor.nome); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => excluirSetor(setor.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Atendentes */}
      <div className="border-t border-border pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Atendentes</h3>
          </div>
          <Dialog open={atendenteDialogOpen} onOpenChange={setAtendenteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Novo Atendente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Atendente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="atendente-nome">Nome</Label>
                  <Input
                    id="atendente-nome"
                    placeholder="Ex: Fabiano, Funcionário 1..."
                    value={novoAtendenteNome}
                    onChange={(e) => setNovoAtendenteNome(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="atendente-email">Email (opcional)</Label>
                  <Input
                    id="atendente-email"
                    type="email"
                    placeholder="email@empresa.com"
                    value={novoAtendenteEmail}
                    onChange={(e) => setNovoAtendenteEmail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={criarAtendente}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 col-span-full">
              Nenhum atendente cadastrado. Clique em "Novo Atendente" para começar.
            </p>
          ) : (
            atendentes.map((atendente) => (
              <div
                key={atendente.id}
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-secondary/40 transition-colors"
              >
                <div className="relative shrink-0">
                  {atendente.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={atendente.foto} alt={atendente.nome} className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm">
                      {getInitials(atendente.nome)}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                      atendente.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{atendente.nome}</p>
                  {atendente.email && <p className="text-xs text-muted-foreground truncate">{atendente.email}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => toggleAtendenteStatus(atendente)}
                  >
                    {atendente.status === 'online' ? 'Online' : 'Offline'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => excluirAtendente(atendente.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
