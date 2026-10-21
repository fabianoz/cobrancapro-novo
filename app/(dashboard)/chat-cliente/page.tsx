'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Archive,
  ArrowRightLeft,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleUserRound,
  Inbox,
  Info,
  MessageCircle,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  UsersRound,
  X,
} from 'lucide-react';

type View = 'queue' | 'mine' | 'team' | 'closed';
type Team = 'atendimento' | 'financeiro' | 'administrativo' | 'franquia';
type Conversation = {
  id: string;
  cliente_id: string | null;
  nome: string;
  foto: string | null;
  telefone: string;
  email: string | null;
  status: 'aberto' | 'em_atendimento' | 'encerrado';
  equipe: Team;
  responsavel_id: string | null;
  ultima_mensagem: string | null;
  ultimo_visto: string | null;
  transferida: boolean;
  origem: 'whatsapp_suporte' | 'interno' | 'externo';
  nao_lidas: number;
  updated_at: string;
};
type ChatMessage = {
  id: string;
  texto: string;
  remetente: 'cliente' | 'atendente';
  data_hora: string;
  lida: boolean;
  estado_entrega: 'enviando' | 'enviada' | 'entregue' | 'lida' | 'erro';
};

const teams: Array<{ value: Team; label: string; initials: string }> = [
  { value: 'atendimento', label: 'Atendimento', initials: 'AT' },
  { value: 'financeiro', label: 'Financeiro', initials: 'FI' },
  { value: 'administrativo', label: 'Administrativo', initials: 'AD' },
  { value: 'franquia', label: 'Franquia', initials: 'FR' },
];

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CL';
}

function time(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function phone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^55/, '');
  return digits.length >= 10 ? `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : value;
}

export default function ChatClientePage() {
  const { user, empresaId, isSuperAdmin } = useAuth();
  const [view, setView] = useState<View>('queue');
  const [team, setTeam] = useState<Team>('atendimento');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

  const loadConversations = useCallback(async () => {
    const params = new URLSearchParams({ view, search });
    if (view === 'mine') params.set('user_id', user?.id || '');
    if (view === 'team') params.set('team', team);
    if (!isSuperAdmin && empresaId) params.set('empresa_id', empresaId);
    const response = await fetch(`/api/chat-cliente?${params}`);
    if (!response.ok) return;
    const data = await response.json() as Conversation[];
    setConversations(data);
    setSelected((current) => data.find((item) => item.id === current?.id) || data[0] || null);
    setLoading(false);
  }, [search, team, user?.id, view, empresaId, isSuperAdmin]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/chat-cliente/mensagens?conversa_id=${conversationId}`);
    if (!response.ok) return;
    setMessages(await response.json() as ChatMessage[]);
    await fetch('/api/chat-cliente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', conversationId }) });
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = window.setInterval(loadConversations, 5000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    loadMessages(selected.id);
    const interval = window.setInterval(() => loadMessages(selected.id), 3500);
    return () => window.clearInterval(interval);
  }, [loadMessages, selected]);

  const queueCount = useMemo(() => conversations.filter((item) => item.status !== 'encerrado' && !item.responsavel_id).length, [conversations]);

  async function action(actionName: string, extra: Record<string, string> = {}) {
    if (!selected) return;
    const response = await fetch('/api/chat-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName, conversationId: selected.id, userId: user?.id, ...extra }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      toast.error(data.error || 'Não foi possível atualizar a conversa.');
      return;
    }
    toast.success(actionName === 'assume' ? 'Conversa assumida.' : actionName === 'close' ? 'Conversa encerrada.' : actionName === 'reopen' ? 'Conversa reaberta.' : 'Conversa atualizada.');
    await loadConversations();
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!selected || !text || sending) return;
    setSending(true);
    const response = await fetch('/api/chat-cliente/mensagens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected.id, text, attendantId: user?.id }),
    });
    const data = await response.json() as { error?: string };
    setSending(false);
    if (!response.ok) {
      toast.error(data.error || 'Não foi possível enviar a mensagem.');
      return;
    }
    setDraft('');
    await loadMessages(selected.id);
    await loadConversations();
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[620px] -m-4 overflow-hidden rounded-xl border border-[#dbe5f5] bg-[#f5f7fb] text-[#1a2b4c] sm:-m-6 lg:-m-8">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-[#dbe5f5] bg-white max-md:w-[280px] max-sm:hidden">
        <div className="border-b border-[#e6edf7] p-4">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#0a3d8f]" />
            <div><h1 className="font-semibold text-[#0a3d8f]">Chat Cliente</h1><p className="text-xs text-slate-500">Suporte via WhatsApp</p></div>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#e8f0ff] p-1 text-[11px] font-medium text-[#0a3d8f]">
            <button onClick={() => setView('queue')} className={`rounded-lg px-2 py-2 ${view === 'queue' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}>Fila {queueCount > 0 && <span className="ml-1">{queueCount}</span>}</button>
            <button onClick={() => setView('mine')} className={`rounded-lg px-2 py-2 ${view === 'mine' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}>Minhas</button>
            <button onClick={() => setView('team')} className={`rounded-lg px-2 py-2 ${view === 'team' ? 'bg-[#0a3d8f] text-white shadow-sm' : ''}`}>Equipes</button>
          </div>
          <div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar conversas..." className="rounded-full border-0 bg-slate-100 pl-9 text-sm focus-visible:ring-[#1e5bff]" /></div>
          {view === 'team' && <Select value={team} onValueChange={(value: Team) => setTeam(value)}><SelectTrigger className="mt-3 h-9 rounded-full border-[#dbe5f5] text-xs"><SelectValue /></SelectTrigger><SelectContent>{teams.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1"><Badge className="shrink-0 border-0 bg-[#e8f0ff] text-[#0a3d8f]">Externas</Badge><Badge variant="outline" className="shrink-0">Transferidas</Badge><Badge variant="outline" className="shrink-0">Não lidas</Badge></div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-6 text-center text-sm text-slate-400">Carregando conversas...</div> : conversations.length === 0 ? <div className="p-8 text-center text-sm text-slate-400"><Inbox className="mx-auto mb-2 h-8 w-8 text-[#9bb7e8]" />Nenhuma conversa nesta fila.</div> : conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelected(conversation)} className={`w-full border-b border-[#edf2f8] p-4 text-left transition hover:bg-[#f1f6ff] ${selected?.id === conversation.id ? 'border-l-4 border-l-[#1e5bff] bg-[#e8f0ff]' : ''}`}><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a3d8f] text-xs font-semibold text-white">{initials(conversation.nome)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{conversation.nome}</strong><span className="shrink-0 text-[11px] text-slate-400">{time(conversation.updated_at)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{conversation.ultima_mensagem || 'Nova conversa'}</p><div className="mt-2 flex items-center gap-1.5"><Badge className={`border-0 px-2 py-0.5 text-[10px] ${conversation.status === 'encerrado' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{conversation.status === 'em_atendimento' ? 'Em atendimento' : conversation.status === 'encerrado' ? 'Encerrado' : 'Fila de espera'}</Badge>{conversation.nao_lidas > 0 && <span className="rounded-full bg-[#1e5bff] px-1.5 text-[10px] text-white">{conversation.nao_lidas}</span>}</div></div></div></button>)}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[#e9eef5]">
        {!selected ? <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-500"><MessageCircle className="mb-3 h-12 w-12 text-[#9bb7e8]" /><h2 className="font-semibold text-[#0a3d8f]">Selecione uma conversa</h2><p className="mt-1 text-sm">As novas mensagens aparecerão na fila de espera.</p></div> : <>
          <header className="flex items-center justify-between border-b border-[#dbe5f5] bg-white px-5 py-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a3d8f] text-xs font-semibold text-white">{initials(selected.nome)}</div><div className="min-w-0"><h2 className="truncate font-semibold">{selected.nome}</h2><p className="text-xs text-slate-500">{phone(selected.telefone)} · visto por último {time(selected.ultimo_visto)}</p></div><Badge className="hidden border-0 bg-emerald-100 text-emerald-700 sm:inline-flex">{selected.status === 'encerrado' ? 'Encerrado' : selected.status === 'em_atendimento' ? 'Em atendimento' : 'Fila de espera'}</Badge></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => selected.status === 'encerrado' ? action('reopen') : selected.responsavel_id ? action('close') : action('assume')}>{selected.status === 'encerrado' ? <><RotateCcw className="mr-2 h-4 w-4" />Reabrir</> : selected.responsavel_id ? <><Archive className="mr-2 h-4 w-4" />Encerrar</> : <><Check className="mr-2 h-4 w-4" />Assumir</>}</Button><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDetailsOpen(!detailsOpen)}><Info className="h-4 w-4" /></Button></div></header>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-slate-400">Nenhuma mensagem carregada.</div> : messages.map((message) => <div key={message.id} className={`flex gap-2 ${message.remetente === 'atendente' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.remetente === 'atendente' ? 'rounded-br-sm bg-[#1e5bff] text-white' : 'rounded-bl-sm bg-white text-[#1a2b4c]'}`}><p className="whitespace-pre-wrap">{message.texto}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.remetente === 'atendente' ? 'text-blue-100' : 'text-slate-400'}`}>{time(message.data_hora)} {message.remetente === 'atendente' && (message.estado_entrega === 'lida' || message.estado_entrega === 'entregue' ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}</div></div></div>)}</div>
          <div className="border-t border-[#dbe5f5] bg-white p-4"><div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><Paperclip className="h-4 w-4" /></Button><Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Digite uma mensagem..." className="border-0 bg-transparent shadow-none focus-visible:ring-0" disabled={selected.status === 'encerrado'} /><Button onClick={sendMessage} disabled={!draft.trim() || sending || selected.status === 'encerrado'} size="icon" className="h-9 w-9 rounded-full bg-[#1e5bff] hover:bg-[#0a3d8f]"><Send className="h-4 w-4" /></Button></div><p className="mt-2 text-center text-[11px] text-slate-400">Enter envia · mensagens são encaminhadas pelo WhatsApp do suporte</p></div>
        </>}
      </section>

      {selected && <aside className={`${detailsOpen ? 'flex' : 'hidden'} w-[290px] shrink-0 flex-col border-l border-[#dbe5f5] bg-white p-5 xl:flex`}><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><Info className="h-4 w-4 text-[#0a3d8f]" /><h3 className="font-semibold text-[#0a3d8f]">Informações</h3></div><Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setDetailsOpen(false)}><X className="h-4 w-4" /></Button></div><div className="mb-6 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#0a3d8f] text-xl font-semibold text-white">{initials(selected.nome)}</div><Link href={selected.cliente_id ? `/customers?cliente=${selected.cliente_id}` : '/customers'} className="mt-3 block font-semibold text-[#0a3d8f] hover:underline">{selected.nome}</Link><p className="mt-1 text-xs text-slate-500">{selected.origem === 'whatsapp_suporte' ? 'WhatsApp do suporte' : 'Conversa interna'}</p></div><div className="space-y-3"><InfoRow label="Telefone" value={phone(selected.telefone)} /><InfoRow label="E-mail" value={selected.email || 'Não informado'} /></div><div className="mt-7"><h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-[#1e5bff]" />Equipes</h4><div className="grid grid-cols-2 gap-2">{teams.map((item) => <button key={item.value} onClick={() => action('transfer', { team: item.value })} className={`rounded-lg border p-3 text-center text-xs transition ${selected.equipe === item.value ? 'border-[#1e5bff] bg-[#e8f0ff] text-[#0a3d8f]' : 'border-slate-200 hover:border-[#9bb7e8]'}`}><span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#0a3d8f] text-[10px] font-semibold text-white">{item.initials}</span><span className="mt-1 block">{item.label}</span></button>)}</div></div><div className="mt-auto space-y-2 pt-6"><Button className="w-full bg-[#1e5bff] hover:bg-[#0a3d8f]" onClick={() => selected.status === 'encerrado' ? action('reopen') : action('close')}>{selected.status === 'encerrado' ? <><RotateCcw className="mr-2 h-4 w-4" />Reabrir conversa</> : <><Archive className="mr-2 h-4 w-4" />Encerrar conversa</>}</Button><Button variant="outline" className="w-full" onClick={() => action('assume')} disabled={Boolean(selected.responsavel_id)}><Check className="mr-2 h-4 w-4" />Assumir conversa</Button></div></aside>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm text-[#1a2b4c]">{value}</p></div>;
}
