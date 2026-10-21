'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Archive,
  Check,
  CheckCheck,
  Headphones,
  Inbox,
  RotateCcw,
  Search,
  Send,
  UserPlus,
} from 'lucide-react';

type Atendimento = {
  id: string;
  telefone: string;
  nome_contato: string;
  cliente_id: string | null;
  status: 'aberto' | 'em_atendimento' | 'encerrado';
  origem: string;
  ultima_mensagem: string | null;
  tem_mensagem_nova: boolean;
  atendente_id: string | null;
  created_at: string;
  updated_at: string;
};

type Mensagem = {
  id: string;
  atendimento_id: string;
  mensagem: string;
  tipo: 'cliente' | 'atendente';
  telefone: string | null;
  nome_contato: string | null;
  atendente_id: string | null;
  created_at: string;
};

type Filtro = 'fila' | 'meus' | 'todos' | 'encerrados';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'CL';
}

function timeLabel(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function phoneLabel(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^55/, '');
  return digits.length >= 10
    ? `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : value;
}

export default function AtendimentoPage() {
  const { user, empresaId, isSuperAdmin } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>('fila');
  const [busca, setBusca] = useState('');
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [selecionado, setSelecionado] = useState<Atendimento | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMsgCount = useRef(0);

  const realtimeClient = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  }, []);

  const loadAtendimentos = useCallback(async () => {
    const params = new URLSearchParams({ filtro, busca });
    if (filtro === 'meus' && user?.id) params.set('atendente_id', user.id);
    if (!isSuperAdmin && empresaId) params.set('empresa_id', empresaId);
    const res = await fetch(`/api/atendimento/mensagens?${params}&list=atendimentos`);
    if (!res.ok) return;
    const data = await res.json() as Atendimento[];
    setAtendimentos(data);
    setSelecionado((cur) => data.find((a) => a.id === cur?.id) || data[0] || null);
    setLoading(false);
  }, [busca, filtro, user?.id, empresaId, isSuperAdmin]);

  const loadMensagens = useCallback(async (atendimentoId: string) => {
    const res = await fetch(`/api/atendimento/mensagens?atendimento_id=${atendimentoId}`);
    if (!res.ok) return;
    const data = await res.json() as Mensagem[];
    setMensagens(data);
  }, []);

  // Initial load + polling fallback
  useEffect(() => {
    loadAtendimentos();
    const interval = window.setInterval(loadAtendimentos, 10000);
    return () => window.clearInterval(interval);
  }, [loadAtendimentos]);

  // Load messages when selection changes
  useEffect(() => {
    if (!selecionado) {
      setMensagens([]);
      return;
    }
    loadMensagens(selecionado.id);
    prevMsgCount.current = 0;
  }, [loadMensagens, selecionado]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Realtime subscription
  useEffect(() => {
    if (!realtimeClient) return;

    const channel = realtimeClient
      .channel('atendimento-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_atendimento' }, (payload) => {
        const novaMsg = payload.new as Mensagem;
        if (selecionado?.id === novaMsg.atendimento_id) {
          setMensagens((prev) => {
            if (prev.some((m) => m.id === novaMsg.id)) return prev;
            return [...prev, novaMsg];
          });
        }
        if (novaMsg.tipo === 'cliente') {
          loadAtendimentos();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'atendimentos' }, () => {
        loadAtendimentos();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atendimentos' }, () => {
        loadAtendimentos();
      })
      .subscribe();

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [realtimeClient, selecionado, loadAtendimentos]);

  // Notification sound when new client message arrives
  useEffect(() => {
    if (mensagens.length > prevMsgCount.current) {
      const lastMsg = mensagens[mensagens.length - 1];
      if (lastMsg?.tipo === 'cliente') {
        playNotificationSound();
      }
    }
    prevMsgCount.current = mensagens.length;
  }, [mensagens]);

  function playNotificationSound() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFUFmwABAAAAAEAAQBAAQAAUQAAACBHT0xPRU9QUgAAAE9QUk9HUkFNRQAAAEcAAABHT0xPRU9QUgAAAAAAAAAAAEcAAABNT0QAAAAAAAAAAABNT0QAAABNT0QAAAAAAAAAAABNT0QAAABNT0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFB' +
          'NT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0QAAABNT0Q'
        );
      }
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    } catch {
      // Audio not available
    }
  }

  const filaCount = useMemo(
    () => atendimentos.filter((a) => a.status === 'aberto' && !a.atendente_id).length,
    [atendimentos]
  );
  const novosCount = useMemo(
    () => atendimentos.filter((a) => a.tem_mensagem_nova).length,
    [atendimentos]
  );

  async function assumir(atendimento: Atendimento) {
    if (!user?.id) return;
    const res = await fetch('/api/atendimento/mensagens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assumir', atendimento_id: atendimento.id, atendente_id: user.id }),
    });
    if (res.ok) {
      toast.success('Atendimento assumido.');
      await loadAtendimentos();
    } else {
      toast.error('Nao foi possivel assumir.');
    }
  }

  async function encerrar(atendimento: Atendimento, reabrir = false) {
    const res = await fetch('/api/atendimento/mensagens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: reabrir ? 'reabrir' : 'encerrar', atendimento_id: atendimento.id }),
    });
    if (res.ok) {
      toast.success(reabrir ? 'Atendimento reaberto.' : 'Atendimento encerrado.');
      await loadAtendimentos();
    } else {
      toast.error('Nao foi possivel atualizar.');
    }
  }

  async function marcarLido(atendimento: Atendimento) {
    if (!atendimento.tem_mensagem_nova) return;
    await fetch('/api/atendimento/mensagens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'marcar_lido', atendimento_id: atendimento.id }),
    });
    await loadAtendimentos();
  }

  async function enviarMensagem() {
    const text = draft.trim();
    if (!selecionado || !text || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/atendimento/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atendimento_id: selecionado.id,
          mensagem: text,
          atendente_id: user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao enviar.');
        return;
      }
      setDraft('');
      await loadMensagens(selecionado.id);
      await loadAtendimentos();
    } catch {
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[600px] -m-4 overflow-hidden rounded-xl border border-[#dbe5f5] bg-[#f5f7fb] text-[#1a2b4c] sm:-m-6 lg:-m-8">
      {/* Sidebar - lista de atendimentos */}
      <aside className="flex w-[330px] shrink-0 flex-col border-r border-[#dbe5f5] bg-white max-md:w-[280px] max-sm:hidden">
        <div className="border-b border-[#e6edf7] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Headphones className="h-5 w-5 text-[#0a3d8f]" />
            <div>
              <h1 className="font-semibold text-[#0a3d8f]">Atendimento</h1>
              <p className="text-xs text-slate-500">WhatsApp em tempo real</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#e8f0ff] p-1 text-[11px] font-medium text-[#0a3d8f]">
            <button
              onClick={() => setFiltro('fila')}
              className={`rounded-lg px-1 py-2 text-center ${filtro === 'fila' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}
            >
              Fila {filaCount > 0 && <span className="ml-0.5">{filaCount}</span>}
            </button>
            <button
              onClick={() => setFiltro('meus')}
              className={`rounded-lg px-1 py-2 text-center ${filtro === 'meus' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}
            >
              Meus
            </button>
            <button
              onClick={() => setFiltro('todos')}
              className={`rounded-lg px-1 py-2 text-center ${filtro === 'todos' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltro('encerrados')}
              className={`rounded-lg px-1 py-2 text-center ${filtro === 'encerrados' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}
            >
              Fim
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="rounded-full border-0 bg-slate-100 pl-9 text-sm focus-visible:ring-[#1e5bff]"
            />
          </div>

          {novosCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#1e5bff]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1e5bff]" />
              {novosCount} nova(s) mensagem(s)
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">Carregando atendimentos...</div>
          ) : atendimentos.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              <Inbox className="mx-auto mb-2 h-8 w-8 text-[#9bb7e8]" />
              Nenhum atendimento nesta fila.
            </div>
          ) : (
            atendimentos.map((at) => (
              <button
                key={at.id}
                onClick={() => {
                  setSelecionado(at);
                  marcarLido(at);
                }}
                className={`w-full border-b border-[#edf2f8] p-4 text-left transition hover:bg-[#f1f6ff] ${
                  selecionado?.id === at.id ? 'border-l-4 border-l-[#1e5bff] bg-[#e8f0ff]' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a3d8f] text-xs font-semibold text-white">
                    {initials(at.nome_contato || at.telefone)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">{at.nome_contato || phoneLabel(at.telefone)}</strong>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeLabel(at.updated_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {at.ultima_mensagem || 'Nova conversa'}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge
                        className={`border-0 px-2 py-0.5 text-[10px] ${
                          at.status === 'encerrado'
                            ? 'bg-slate-100 text-slate-600'
                            : at.status === 'em_atendimento'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {at.status === 'em_atendimento' ? 'Em atendimento' : at.status === 'encerrado' ? 'Encerrado' : 'Fila'}
                      </Badge>
                      {at.tem_mensagem_nova && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1e5bff] px-1 text-[10px] font-semibold text-white">
                          Nova
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat area */}
      <section className="flex min-w-0 flex-1 flex-col bg-[#e9eef5]">
        {!selecionado ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-500">
            <Headphones className="mb-3 h-12 w-12 text-[#9bb7e8]" />
            <h2 className="font-semibold text-[#0a3d8f]">Selecione um atendimento</h2>
            <p className="mt-1 text-sm">As mensagens recebidas pelo WhatsApp aparecem aqui em tempo real.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-[#dbe5f5] bg-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a3d8f] text-xs font-semibold text-white">
                  {initials(selecionado.nome_contato || selecionado.telefone)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    {selecionado.nome_contato || phoneLabel(selecionado.telefone)}
                  </h2>
                  <p className="text-xs text-slate-500">{phoneLabel(selecionado.telefone)}</p>
                </div>
                <Badge
                  className={`hidden border-0 sm:inline-flex ${
                    selecionado.status === 'encerrado'
                      ? 'bg-slate-100 text-slate-600'
                      : selecionado.status === 'em_atendimento'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {selecionado.status === 'em_atendimento' ? 'Em atendimento' : selecionado.status === 'encerrado' ? 'Encerrado' : 'Fila'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {selecionado.status !== 'encerrado' && !selecionado.atendente_id && (
                  <Button variant="outline" size="sm" onClick={() => assumir(selecionado)}>
                    <UserPlus className="mr-2 h-4 w-4" />Assumir
                  </Button>
                )}
                {selecionado.status === 'encerrado' ? (
                  <Button variant="outline" size="sm" onClick={() => encerrar(selecionado, true)}>
                    <RotateCcw className="mr-2 h-4 w-4" />Reabrir
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => encerrar(selecionado)}>
                    <Archive className="mr-2 h-4 w-4" />Encerrar
                  </Button>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {mensagens.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Nenhuma mensagem ainda.
                </div>
              ) : (
                mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.tipo === 'atendente' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.tipo === 'atendente'
                          ? 'rounded-br-sm bg-[#1e5bff] text-white'
                          : 'rounded-bl-sm bg-white text-[#1a2b4c]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.mensagem}</p>
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          msg.tipo === 'atendente' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {timeLabel(msg.created_at)}
                        {msg.tipo === 'atendente' && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-[#dbe5f5] bg-white p-4">
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviarMensagem();
                    }
                  }}
                  placeholder="Digite uma mensagem..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  disabled={selecionado.status === 'encerrado'}
                />
                <Button
                  onClick={enviarMensagem}
                  disabled={!draft.trim() || sending || selecionado.status === 'encerrado'}
                  size="icon"
                  className="h-9 w-9 rounded-full bg-[#1e5bff] hover:bg-[#0a3d8f]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                Enter envia · mensagens sao enviadas via WhatsApp de atendimento
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
