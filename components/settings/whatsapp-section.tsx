'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  QrCode,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Phone,
  Send,
  Shield,
  Zap,
  MessageCircle,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

type ConnState = {
  status: string;
  base64?: string;
  phoneNumber?: string;
  instanceName?: string;
  error?: string;
};

const POLL_INTERVAL = 5000;

function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 12) {
    const withCC = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    const ddd = withCC.slice(2, 4);
    const rest = withCC.slice(4);
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `+${cleaned}`;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Conectado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  connected: { label: 'Conectado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  connecting: { label: 'Conectando', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  close: { label: 'Desconectado', color: 'bg-red-100 text-red-700 border-red-200' },
  loading: { label: 'Verificando', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function WhatsappSection() {
  // --- Cobrança (bot-ia) ---
  const [cobState, setCobState] = useState<ConnState>({ status: 'loading' });
  const [cobLoading, setCobLoading] = useState(true);

  // --- Atendimento (bot-atendimento) ---
  const [attState, setAttState] = useState<ConnState>({ status: 'loading' });
  const [attQr, setAttQr] = useState('');
  const [attLoading, setAttLoading] = useState(true);

  // --- Config compartilhada ---
  const [evoConfig, setEvoConfig] = useState({ url: '', apiKey: '', instance: 'cobrancapro' });
  const [attConfig, setAttConfig] = useState({
    instance: 'bot-atendimento',
    routingMode: 'single' as 'single' | 'multi',
    triageMessage: 'Digite 1-Financeiro 2-Suporte 3-Vendas',
    instanceSuporte: '',
    instanceFinanceiro: '',
    instanceVendas: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // --- Teste de envio ---
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do CobrancaPro.');
  const [testing, setTesting] = useState(false);

  const cobConnected = cobState.status === 'open' || cobState.status === 'connected';
  const attConnected = attState.status === 'open' || attState.status === 'connected';

  const checkCobStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      setCobState(await response.json() as ConnState);
    } catch { setCobState({ status: 'close' }); }
    setCobLoading(false);
  }, []);

  const checkAttStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/atendimento/status');
      setAttState(await response.json() as ConnState);
      if (attState.status === 'open' || attState.status === 'connected') setAttQr('');
    } catch { setAttState({ status: 'close' }); }
    setAttLoading(false);
  }, []);

  useEffect(() => {
    checkCobStatus();
    checkAttStatus();
    const interval = setInterval(() => { checkCobStatus(); checkAttStatus(); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkCobStatus, checkAttStatus]);

  useEffect(() => {
    fetch('/api/whatsapp/config').then((r) => r.ok ? r.json() : null).then((evo) => {
      if (evo) setEvoConfig({ url: evo.url || '', apiKey: evo.apiKey || '', instance: evo.instance || 'cobrancapro' });
    }).catch(() => {});
    fetch('/api/whatsapp/atendimento/config').then((r) => r.ok ? r.json() : null).then((cfg) => {
      if (cfg) setAttConfig({
        instance: cfg.instance || 'bot-atendimento',
        routingMode: cfg.routingMode === 'multi' ? 'multi' : 'single',
        triageMessage: cfg.triageMessage || 'Digite 1-Financeiro 2-Suporte 3-Vendas',
        instanceSuporte: cfg.instanceSuporte || '',
        instanceFinanceiro: cfg.instanceFinanceiro || '',
        instanceVendas: cfg.instanceVendas || '',
      });
    }).catch(() => {});
  }, []);

  async function handleSaveEvo() {
    try {
      await fetch('/api/whatsapp/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evoConfig) });
      toast.success('Configurações Evolution API salvas');
    } catch { toast.error('Erro ao salvar Evolution API'); }
  }

  async function handleSaveAttConfig() {
    setSavingConfig(true);
    try {
      await fetch('/api/whatsapp/atendimento/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attConfig) });
      toast.success('Configurações de atendimento salvas');
    } catch { toast.error('Erro ao salvar configurações de atendimento'); }
    setSavingConfig(false);
  }

  async function fetchAttQR() {
    setAttLoading(true);
    try {
      const response = await fetch('/api/whatsapp/atendimento/qrcode');
      const data = await response.json() as ConnState;
      if (data.status === 'open' || data.status === 'connected') {
        setAttState(data); setAttQr(''); toast.success('WhatsApp de atendimento já está conectado!');
        return;
      }
      if (data.base64) {
        const formatted = data.base64.startsWith('data:image') ? data.base64 : `data:image/png;base64,${data.base64}`;
        setAttQr(formatted); setAttState({ status: 'connecting' });
        toast.success('QR Code gerado. Escaneie com seu WhatsApp.');
      } else {
        setAttState({ status: data.status || 'close' });
        toast.error(data.error || 'Não foi possível obter o QR Code.');
      }
    } catch { toast.error('Erro ao buscar QR Code'); }
    setAttLoading(false);
  }

  async function handleAttDisconnect() {
    if (!confirm('Desconectar WhatsApp de atendimento?')) return;
    try {
      const response = await fetch('/api/whatsapp/atendimento/disconnect', { method: 'POST' });
      if (response.ok) { toast.success('WhatsApp de atendimento desconectado'); setAttState({ status: 'close' }); setAttQr(''); }
      else { const data = await response.json(); toast.error(data.error || 'Erro ao desconectar'); }
    } catch { toast.error('Erro de conexão'); }
  }

  async function handleCobDisconnect() {
    if (!confirm('Desconectar WhatsApp de cobranças? Os envios automáticos serão pausados.')) return;
    try {
      const response = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      if (response.ok) { toast.success('WhatsApp de cobranças desconectado'); setCobState({ status: 'close' }); }
      else toast.error('Erro ao desconectar');
    } catch { toast.error('Erro de conexão'); }
  }

  async function handleTestSend() {
    if (!testPhone) { toast.error('Informe um número de telefone'); return; }
    setTesting(true);
    try {
      const response = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: testPhone, message: testMessage }) });
      const data = await response.json();
      if (response.ok && data.success) toast.success('Mensagem de teste enviada!');
      else toast.error(data.error || 'Erro ao enviar mensagem');
    } catch { toast.error('Erro de conexão'); }
    setTesting(false);
  }

  const cobStatus = statusConfig[cobState.status] || statusConfig.close;
  const attStatusInfo = statusConfig[attState.status] || statusConfig.close;

  return (
    <div className="space-y-6">
      {/* ===== CARD A: COBRANÇAS ===== */}
      <div className={`rounded-xl border-2 p-5 ${cobConnected ? 'border-emerald-200 bg-emerald-50/50' : 'border-border'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Zap className="h-5 w-5" /></div>
          <div><h3 className="font-semibold">WhatsApp de Cobranças (Automático)</h3><p className="text-xs text-muted-foreground">Instância bot-ia · envio automático de templates de cobrança</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cobStatus.color}`}>
            {cobConnected ? <CheckCircle2 className="h-5 w-5" /> : cobState.status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{cobStatus.label}</span>
              <Badge variant="outline" className={cobStatus.color}>{cobState.status}</Badge>
              {cobConnected && cobState.phoneNumber && <Badge className="bg-emerald-600 text-white border-0 gap-1"><Phone className="w-3 h-3" />{formatPhoneDisplay(cobState.phoneNumber)}</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{cobConnected ? 'WhatsApp conectado e enviando cobranças automaticamente' : 'WhatsApp de cobranças desconectado'}</p>
          </div>
          {cobConnected && <Button variant="outline" size="sm" onClick={handleCobDisconnect} className="text-red-600 hover:bg-red-50"><LogOut className="mr-2 h-4 w-4" />Desconectar</Button>}
        </div>
      </div>

      {/* ===== CARD B: ATENDIMENTO ===== */}
      <div className={`rounded-xl border-2 p-5 ${attConnected ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/30'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><MessageCircle className="h-5 w-5" /></div>
          <div><h3 className="font-semibold">WhatsApp de Atendimento (Chat Cliente)</h3><p className="text-xs text-muted-foreground">Recebe mensagens de clientes e faz triagem por setores</p></div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${attStatusInfo.color}`}>
            {attConnected ? <CheckCircle2 className="h-5 w-5" /> : attState.status === 'connecting' || attState.status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{attStatusInfo.label}</span>
              <Badge variant="outline" className={attStatusInfo.color}>{attState.status}</Badge>
              {attConnected && attState.phoneNumber && <Badge className="bg-blue-600 text-white border-0 gap-1"><Phone className="w-3 h-3" />{formatPhoneDisplay(attState.phoneNumber)}</Badge>}
              <Badge variant="outline" className="text-xs">Instância: {attConfig.instance}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{attConnected ? 'WhatsApp de atendimento conectado e pronto para receber mensagens' : 'Gere o QR Code para conectar o WhatsApp de atendimento'}</p>
          </div>
          {attConnected ? (
            <Button variant="outline" size="sm" onClick={handleAttDisconnect} className="text-red-600 hover:bg-red-50"><LogOut className="mr-2 h-4 w-4" />Desconectar</Button>
          ) : (
            <Button size="sm" onClick={fetchAttQR} disabled={attLoading}>
              {attLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              Conectar WhatsApp
            </Button>
          )}
        </div>

        {attQr && !attConnected && (
          <div className="mt-4 flex flex-col items-center gap-3 border-t border-border pt-4">
            <div className="relative rounded-xl border-2 border-border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attQr} alt="QR Code Atendimento" className="h-52 w-52" />
              <div className="absolute -right-2 -top-2"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
            </div>
            <p className="max-w-xs text-center text-sm text-muted-foreground">Abra o WhatsApp, vá em Configurações → Aparelhos conectados → Conectar aparelho</p>
          </div>
        )}
      </div>

      {/* ===== ROTEAMENTO ===== */}
      <div className="rounded-xl border border-border p-5">
        <div className="mb-4 flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><h3 className="font-medium text-sm">Roteamento de Atendimento</h3></div>
        <p className="mb-3 text-xs text-muted-foreground">Escolha se um número recebe todos os setores ou se cada setor terá seu próprio WhatsApp.</p>
        <div className="mb-4 flex gap-2">
          <Button type="button" size="sm" variant={attConfig.routingMode === 'single' ? 'default' : 'outline'} onClick={() => setAttConfig({ ...attConfig, routingMode: 'single' })}>1 número (triagem)</Button>
          <Button type="button" size="sm" variant={attConfig.routingMode === 'multi' ? 'default' : 'outline'} onClick={() => setAttConfig({ ...attConfig, routingMode: 'multi' })}>Números por setor</Button>
        </div>
        {attConfig.routingMode === 'single' ? (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="triage-msg" className="text-xs">Mensagem de triagem</Label><Textarea id="triage-msg" rows={2} value={attConfig.triageMessage} onChange={(e) => setAttConfig({ ...attConfig, triageMessage: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Todo chat entra no número principal. O cliente recebe a mensagem de triagem e digita o número do setor desejado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="inst-suporte" className="text-xs">Instância Suporte</Label><Input id="inst-suporte" value={attConfig.instanceSuporte} onChange={(e) => setAttConfig({ ...attConfig, instanceSuporte: e.target.value })} placeholder="suporte-bot" /></div>
              <div className="space-y-1.5"><Label htmlFor="inst-fin" className="text-xs">Instância Financeiro</Label><Input id="inst-fin" value={attConfig.instanceFinanceiro} onChange={(e) => setAttConfig({ ...attConfig, instanceFinanceiro: e.target.value })} placeholder="financeiro-bot" /></div>
              <div className="space-y-1.5"><Label htmlFor="inst-vendas" className="text-xs">Instância Vendas</Label><Input id="inst-vendas" value={attConfig.instanceVendas} onChange={(e) => setAttConfig({ ...attConfig, instanceVendas: e.target.value })} placeholder="vendas-bot" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Cada setor tem sua própria instância de WhatsApp. Mensagens chegam direto no setor correspondente.</p>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 space-y-1.5"><Label htmlFor="att-instance" className="text-xs">Nome da instância de atendimento</Label><Input id="att-instance" value={attConfig.instance} onChange={(e) => setAttConfig({ ...attConfig, instance: e.target.value })} className="max-w-xs" /></div>
          <Button type="button" onClick={handleSaveAttConfig} disabled={savingConfig} className="mt-5">
            {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Salvar Roteamento
          </Button>
        </div>
      </div>

      {/* ===== EVOLUTION API CONFIG ===== */}
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-medium text-sm">Configuração Evolution API (compartilhada)</h3>
        <div className="space-y-2"><Label htmlFor="evo-url">URL da API</Label><Input id="evo-url" placeholder="https://evolution-api.seudominio.com" value={evoConfig.url} onChange={(e) => setEvoConfig({ ...evoConfig, url: e.target.value })} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="evo-key">API Key</Label><Input id="evo-key" type="password" placeholder="Sua chave de API" value={evoConfig.apiKey} onChange={(e) => setEvoConfig({ ...evoConfig, apiKey: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="evo-instance">Instância de Cobrança</Label><Input id="evo-instance" placeholder="bot-ia" value={evoConfig.instance} onChange={(e) => setEvoConfig({ ...evoConfig, instance: e.target.value })} /></div>
        </div>
        <Button size="sm" onClick={handleSaveEvo} variant="secondary"><RefreshCw className="mr-2 h-4 w-4" />Salvar Evolution API</Button>
      </div>

      {/* ===== TESTE DE ENVIO ===== */}
      <div className="rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /><h3 className="font-medium text-sm">Testar Envio (Cobranças)</h3></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="test-phone" className="text-xs">Número de Telefone</Label><Input id="test-phone" placeholder="5511987654321" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="test-msg" className="text-xs">Mensagem</Label><Textarea id="test-msg" rows={2} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} /></div>
        </div>
        <Button onClick={handleTestSend} disabled={testing} size="sm">{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{testing ? 'Enviando...' : 'Enviar Teste'}</Button>
      </div>
    </div>
  );
}