'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Settings } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings as SettingsIcon,
  CreditCard,
  Mail,
  Bell,
  Save,
  Upload,
  Loader2,
  Shield,
  CheckCircle2,
  XCircle,
  Building2,
  Headset,
  Search,
  MessageCircle,
  Landmark,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { WhatsappSection } from '@/components/settings/whatsapp-section';
import { AtendimentoSection } from '@/components/settings/atendimento-section';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    billing_provider: 'EFI',
    email_template: '',
    reminder_rules: 'D-1,D-0,D+1,D+5',
    template_faturar: '',
    template_lembrete_d3: '',
    template_lembrete_d0: '',
    template_lembrete_d1: '',
    template_lembrete_d3_pos: '',
    template_lembrete_d7_pos: '',
    template_pago: '',
  });
  const [issuer, setIssuer] = useState({
    issuer_name: '',
    issuer_trade_name: '',
    issuer_cnpj: '',
    issuer_ie: '',
    issuer_im: '',
    issuer_address: '',
    issuer_city: '',
    issuer_state: '',
    issuer_zip_code: '',
    issuer_phone: '',
    issuer_email: '',
    issuer_logo_url: '',
  });
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    user: '',
    password: '',
    secure: false,
    fromEmail: '',
  });
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [efiConfig, setEfiConfig] = useState({
    clientId: '',
    clientSecret: '',
    pixKey: '',
    certificateBase64: '',
    sandbox: false,
  });
  const [efiClientIdSaved, setEfiClientIdSaved] = useState(false);
  const [efiClientSecretSaved, setEfiClientSecretSaved] = useState(false);
  const [efiCertFileName, setEfiCertFileName] = useState('');
  const [efiCertUploaded, setEfiCertUploaded] = useState(false);
  const [efiCertChanged, setEfiCertChanged] = useState(false);
  const efiCertInputRef = useRef<HTMLInputElement>(null);
  const [testingEfi, setTestingEfi] = useState(false);
  const [efiTestResult, setEfiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [interConfig, setInterConfig] = useState({
    clientId: '',
    clientSecret: '',
    certBase64: '',
    keyBase64: '',
    sandbox: false,
  });
  const [interClientIdSaved, setInterClientIdSaved] = useState(false);
  const [interClientSecretSaved, setInterClientSecretSaved] = useState(false);
  const [interCertFileName, setInterCertFileName] = useState('');
  const [interKeyFileName, setInterKeyFileName] = useState('');
  const [interCertUploaded, setInterCertUploaded] = useState(false);
  const [interKeyUploaded, setInterKeyUploaded] = useState(false);
  const [interCertChanged, setInterCertChanged] = useState(false);
  const [interKeyChanged, setInterKeyChanged] = useState(false);
  const interCertInputRef = useRef<HTMLInputElement>(null);
  const interKeyInputRef = useRef<HTMLInputElement>(null);
  const [testingInter, setTestingInter] = useState(false);
  const [interTestResult, setInterTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [asaasConfig, setAsaasConfig] = useState({ apiKey: '', sandbox: true });
  const [asaasApiKeySaved, setAsaasApiKeySaved] = useState(false);
  const [asaasShowKey, setAsaasShowKey] = useState(false);
  const [testingAsaas, setTestingAsaas] = useState(false);
  const [asaasTestResult, setAsaasTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      setForm({
        billing_provider: data.billing_provider || 'EFI',
        email_template: data.email_template || '',
        reminder_rules: data.reminder_rules || 'D-1,D-0,D+1,D+5',
        template_faturar: data.template_faturar || '',
        template_lembrete_d3: data.template_lembrete_d3 || '',
        template_lembrete_d0: data.template_lembrete_d0 || '',
        template_lembrete_d1: data.template_lembrete_d1 || '',
        template_lembrete_d3_pos: data.template_lembrete_d3_pos || '',
        template_lembrete_d7_pos: data.template_lembrete_d7_pos || '',
        template_pago: data.template_pago || '',
      });
      setIssuer({
        issuer_name: data.issuer_name || '',
        issuer_trade_name: data.issuer_trade_name || '',
        issuer_cnpj: data.issuer_cnpj || '',
        issuer_ie: data.issuer_ie || '',
        issuer_im: data.issuer_im || '',
        issuer_address: data.issuer_address || '',
        issuer_city: data.issuer_city || '',
        issuer_state: data.issuer_state || '',
        issuer_zip_code: data.issuer_zip_code || '',
        issuer_phone: data.issuer_phone || '',
        issuer_email: data.issuer_email || '',
        issuer_logo_url: data.issuer_logo_url || '',
      });
      setSmtpConfig({
        host: data.smtp_host || '',
        port: data.smtp_port || 587,
        user: data.smtp_user || '',
        password: data.smtp_password || '',
        secure: data.smtp_secure ?? false,
        fromEmail: data.smtp_from_email || '',
      });
    }
    try {
      const { data: efiData } = await supabase
        .from('settings')
        .select('efi_client_id, efi_pix_key, efi_certificate_base64, efi_sandbox')
        .eq('id', 1)
        .maybeSingle();
      if (efiData) {
        setEfiClientIdSaved(!!efiData.efi_client_id);
        setEfiClientSecretSaved(true);
        setEfiConfig({
          clientId: '',
          clientSecret: '',
          pixKey: efiData.efi_pix_key || '',
          certificateBase64: efiData.efi_certificate_base64 || '',
          sandbox: efiData.efi_sandbox ?? false,
        });
        if (efiData.efi_certificate_base64) setEfiCertUploaded(true);
      }
    } catch {
      // ignore
    }
    try {
      const { data: interData } = await supabase
        .from('settings')
        .select('inter_client_id, inter_cert_base64, inter_key_base64, inter_sandbox')
        .eq('id', 1)
        .maybeSingle();
      if (interData) {
        setInterClientIdSaved(!!interData.inter_client_id);
        setInterClientSecretSaved(true);
        setInterConfig({
          clientId: '',
          clientSecret: '',
          certBase64: interData.inter_cert_base64 || '',
          keyBase64: interData.inter_key_base64 || '',
          sandbox: interData.inter_sandbox ?? false,
        });
        if (interData.inter_cert_base64) setInterCertUploaded(true);
        if (interData.inter_key_base64) setInterKeyUploaded(true);
      }
    } catch {
      // ignore
    }
    try {
      const { data: asaasData } = await supabase
        .from('settings')
        .select('asaas_api_key, asaas_sandbox')
        .eq('id', 1)
        .maybeSingle();
      if (asaasData) {
        setAsaasApiKeySaved(!!asaasData.asaas_api_key);
        setAsaasConfig({ apiKey: '', sandbox: asaasData.asaas_sandbox ?? true });
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleSaveAll() {
    setSaving(true);
    const { error } = await supabase
      .from('settings')
      .update({
        billing_provider: form.billing_provider,
        email_template: form.email_template,
        reminder_rules: form.reminder_rules,
        template_faturar: form.template_faturar || null,
        template_lembrete_d3: form.template_lembrete_d3 || null,
        template_lembrete_d0: form.template_lembrete_d0 || null,
        template_lembrete_d1: form.template_lembrete_d1 || null,
        template_lembrete_d3_pos: form.template_lembrete_d3_pos || null,
        template_lembrete_d7_pos: form.template_lembrete_d7_pos || null,
        template_pago: form.template_pago || null,
        issuer_name: issuer.issuer_name || null,
        issuer_trade_name: issuer.issuer_trade_name || null,
        issuer_cnpj: issuer.issuer_cnpj || null,
        issuer_ie: issuer.issuer_ie || null,
        issuer_im: issuer.issuer_im || null,
        issuer_address: issuer.issuer_address || null,
        issuer_city: issuer.issuer_city || null,
        issuer_state: issuer.issuer_state || null,
        issuer_zip_code: issuer.issuer_zip_code || null,
        issuer_phone: issuer.issuer_phone || null,
        issuer_email: issuer.issuer_email || null,
        issuer_logo_url: issuer.issuer_logo_url || null,
        smtp_host: smtpConfig.host || null,
        smtp_port: smtpConfig.port || null,
        smtp_user: smtpConfig.user || null,
        smtp_password: smtpConfig.password || null,
        smtp_secure: smtpConfig.secure,
        smtp_from_email: smtpConfig.fromEmail || null,
        asaas_sandbox: asaasConfig.sandbox,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      toast.error('Erro ao salvar configurações');
      setSaving(false);
      return;
    }

    try {
      const efiPayload: Record<string, unknown> = {
        pixKey: efiConfig.pixKey,
        sandbox: efiConfig.sandbox,
      };
      if (efiConfig.clientId && !efiConfig.clientId.includes('•') && efiConfig.clientId.trim().length > 10) {
        efiPayload.clientId = efiConfig.clientId.trim();
      }
      if (efiConfig.clientSecret && !efiConfig.clientSecret.includes('•') && efiConfig.clientSecret.trim().length > 10) {
        efiPayload.clientSecret = efiConfig.clientSecret.trim();
      }
      if (efiCertChanged && efiConfig.certificateBase64 && efiConfig.certificateBase64.length > 200) {
        efiPayload.certificateBase64 = efiConfig.certificateBase64;
      }
      await fetch('/api/efi/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(efiPayload),
      });
      if (efiPayload.clientId) setEfiClientIdSaved(true);
      if (efiPayload.clientSecret) setEfiClientSecretSaved(true);
      if (efiPayload.certificateBase64) setEfiCertChanged(false);
    } catch {
      // non-critical
    }

    try {
      const interPayload: Record<string, unknown> = {
        sandbox: interConfig.sandbox,
      };
      if (interConfig.clientId && !interConfig.clientId.includes('•') && interConfig.clientId.trim().length > 5) {
        interPayload.clientId = interConfig.clientId.trim();
      }
      if (interConfig.clientSecret && !interConfig.clientSecret.includes('•') && interConfig.clientSecret.trim().length > 5) {
        interPayload.clientSecret = interConfig.clientSecret.trim();
      }
      if (interCertChanged && interConfig.certBase64 && interConfig.certBase64.length > 100) {
        interPayload.certBase64 = interConfig.certBase64;
      }
      if (interKeyChanged && interConfig.keyBase64 && interConfig.keyBase64.length > 100) {
        interPayload.keyBase64 = interConfig.keyBase64;
      }
      await fetch('/api/inter/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interPayload),
      });
      if (interPayload.clientId) setInterClientIdSaved(true);
      if (interPayload.clientSecret) setInterClientSecretSaved(true);
      if (interPayload.certBase64) setInterCertChanged(false);
      if (interPayload.keyBase64) setInterKeyChanged(false);
    } catch {
      // non-critical
    }

    try {
      const asaasPayload: Record<string, unknown> = { sandbox: asaasConfig.sandbox };
      if (asaasConfig.apiKey && !asaasConfig.apiKey.includes('•') && asaasConfig.apiKey.trim().length > 5) {
        asaasPayload.apiKey = asaasConfig.apiKey.trim();
      }
      const res = await fetch('/api/asaas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asaasPayload),
      });
      if (res.ok && asaasPayload.apiKey) setAsaasApiKeySaved(true);
    } catch {
      // non-critical
    }

    toast.success('Configurações salvas com sucesso');
    setSaving(false);
  }

  function handleEfiCertUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEfiCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      setEfiConfig({ ...efiConfig, certificateBase64: base64 });
      setEfiCertUploaded(true);
      setEfiCertChanged(true);
      toast.success('Certificado .p12 carregado');
    };
    reader.onerror = () => toast.error('Erro ao ler certificado');
    reader.readAsDataURL(file);
  }

  async function handleTestEfi() {
    setTestingEfi(true);
    setEfiTestResult(null);
    try {
      const res = await fetch('/api/efi/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: efiConfig.clientId,
          clientSecret: efiConfig.clientSecret,
          pixKey: efiConfig.pixKey,
          certificateBase64: efiConfig.certificateBase64,
          sandbox: efiConfig.sandbox,
        }),
      });
      const data = await res.json();
      setEfiTestResult({ success: data.success, message: data.message || data.error });
      if (data.success) {
        toast.success(data.message || 'Conexão Efí OK');
      } else {
        toast.error(data.message || data.error || 'Erro na conexão Efí');
      }
    } catch {
      setEfiTestResult({ success: false, message: 'Erro de conexão' });
      toast.error('Erro de conexão');
    }
    setTestingEfi(false);
  }

  function handleInterCertUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInterCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      setInterConfig({ ...interConfig, certBase64: base64 });
      setInterCertUploaded(true);
      setInterCertChanged(true);
      toast.success('Certificado .crt carregado');
    };
    reader.onerror = () => toast.error('Erro ao ler certificado');
    reader.readAsDataURL(file);
  }

  function handleInterKeyUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInterKeyFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      setInterConfig({ ...interConfig, keyBase64: base64 });
      setInterKeyUploaded(true);
      setInterKeyChanged(true);
      toast.success('Chave .key carregada');
    };
    reader.onerror = () => toast.error('Erro ao ler chave');
    reader.readAsDataURL(file);
  }

  async function handleTestInter() {
    setTestingInter(true);
    setInterTestResult(null);
    try {
      const res = await fetch('/api/inter/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: interConfig.clientId,
          clientSecret: interConfig.clientSecret,
          certBase64: interConfig.certBase64,
          keyBase64: interConfig.keyBase64,
          sandbox: interConfig.sandbox,
        }),
      });
      const data = await res.json();
      setInterTestResult({ success: data.success, message: data.message || data.error });
      if (data.success) {
        toast.success(data.message || 'Conexão Banco Inter OK');
      } else {
        toast.error(data.message || data.error || 'Erro na conexão Inter');
      }
    } catch {
      setInterTestResult({ success: false, message: 'Erro de conexão' });
      toast.error('Erro de conexão');
    }
    setTestingInter(false);
  }

  async function handleTestAsaas() {
    setTestingAsaas(true);
    setAsaasTestResult(null);
    try {
      const payload: Record<string, unknown> = { sandbox: asaasConfig.sandbox };
      if (asaasConfig.apiKey && !asaasConfig.apiKey.includes('•') && asaasConfig.apiKey.trim().length > 5) {
        payload.apiKey = asaasConfig.apiKey.trim();
      }
      const res = await fetch('/api/asaas/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setAsaasTestResult({ success: data.success, message: data.message || data.error });
      if (data.success) {
        toast.success(data.message || 'Conexão Asaas OK');
        if (payload.apiKey) setAsaasApiKeySaved(true);
      } else {
        toast.error(data.message || data.error || 'Erro na conexão Asaas');
      }
    } catch {
      setAsaasTestResult({ success: false, message: 'Erro de conexão' });
      toast.error('Erro de conexão');
    }
    setTestingAsaas(false);
  }

  async function handleBuscarCnpj() {
    const cnpjDigits = issuer.issuer_cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      toast.error('Digite um CNPJ válido com 14 dígitos.');
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`/api/consultar/cnpj/${cnpjDigits}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const d = data.data;
        const fullAddress = [d.street, d.street_number, d.complement, d.neighborhood].filter(Boolean).join(', ');
        setIssuer({
          ...issuer,
          issuer_name: d.name || issuer.issuer_name,
          issuer_trade_name: d.trade_name || issuer.issuer_trade_name,
          issuer_cnpj: cnpjDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
          issuer_address: fullAddress || issuer.issuer_address,
          issuer_city: d.city || issuer.issuer_city,
          issuer_state: d.state || issuer.issuer_state,
          issuer_zip_code: d.zip_code || issuer.issuer_zip_code,
          issuer_phone: d.whatsapp || issuer.issuer_phone,
          issuer_email: d.email || issuer.issuer_email,
        });
        toast.success('Dados do CNPJ preenchidos automaticamente.');
      } else {
        toast.error(data.error || 'Não foi possível consultar o CNPJ.');
      }
    } catch {
      toast.error('Erro ao consultar CNPJ.');
    }
    setCnpjLoading(false);
  }

  async function handleTestEmail() {
    if (!smtpConfig.host || !smtpConfig.user) {
      toast.error('Configure host e usuário SMTP primeiro');
      return;
    }
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: smtpConfig.fromEmail || smtpConfig.user,
          subject: 'Teste de Email — CobrancaPro',
          message: 'Este é um email de teste do CobrancaPro. Se você recebeu, o SMTP está funcionando!',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailTestResult({ success: true, message: 'Email enviado com sucesso! Verifique sua caixa de entrada.' });
        toast.success('Email de teste enviado');
      } else {
        setEmailTestResult({ success: false, message: data.error || 'Erro ao enviar' });
        toast.error(data.error || 'Erro ao enviar email');
      }
    } catch {
      setEmailTestResult({ success: false, message: 'Erro de conexão' });
      toast.error('Erro de conexão');
    }
    setTestingEmail(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure emitente, pagamentos, WhatsApp, atendimento, email e templates de cobrança
        </p>
      </div>

      <Card className="p-6 border-border/60">
        <Accordion type="single" collapsible defaultValue="gerais" className="w-full">
          {/* 1. Configurações Gerais — Dados do Emitente */}
          <AccordionItem value="gerais">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Configurações Gerais (Dados do Emitente)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-muted-foreground mb-4">
                Estes dados aparecem nas cobranças, boletos, relatórios e mensagens enviadas aos clientes.
              </p>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuer-name">Razão Social</Label>
                    <Input
                      id="issuer-name"
                      value={issuer.issuer_name}
                      onChange={(e) => setIssuer({ ...issuer, issuer_name: e.target.value })}
                      placeholder="Sua Empresa LTDA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuer-trade">Nome Fantasia</Label>
                    <Input
                      id="issuer-trade"
                      value={issuer.issuer_trade_name}
                      onChange={(e) => setIssuer({ ...issuer, issuer_trade_name: e.target.value })}
                      placeholder="Nome Fantasia"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuer-cnpj">CNPJ</Label>
                    <div className="flex gap-2">
                      <Input
                        id="issuer-cnpj"
                        value={issuer.issuer_cnpj}
                        onChange={(e) => setIssuer({ ...issuer, issuer_cnpj: e.target.value })}
                        placeholder="12.345.678/0001-90"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={handleBuscarCnpj} disabled={cnpjLoading} className="shrink-0">
                        {cnpjLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
                        Buscar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuer-ie">Inscrição Estadual</Label>
                    <Input
                      id="issuer-ie"
                      value={issuer.issuer_ie}
                      onChange={(e) => setIssuer({ ...issuer, issuer_ie: e.target.value })}
                      placeholder="123.456.789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuer-im">Inscrição Municipal</Label>
                    <Input
                      id="issuer-im"
                      value={issuer.issuer_im}
                      onChange={(e) => setIssuer({ ...issuer, issuer_im: e.target.value })}
                      placeholder="98.765.432-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer-address">Endereço</Label>
                  <Input
                    id="issuer-address"
                    value={issuer.issuer_address}
                    onChange={(e) => setIssuer({ ...issuer, issuer_address: e.target.value })}
                    placeholder="Rua das Flores, 123 - Sala 2"
                  />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuer-city">Cidade</Label>
                    <Input
                      id="issuer-city"
                      value={issuer.issuer_city}
                      onChange={(e) => setIssuer({ ...issuer, issuer_city: e.target.value })}
                      placeholder="São Paulo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuer-state">UF</Label>
                    <Input
                      id="issuer-state"
                      value={issuer.issuer_state}
                      onChange={(e) => setIssuer({ ...issuer, issuer_state: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="SP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuer-zip">CEP</Label>
                    <Input
                      id="issuer-zip"
                      value={issuer.issuer_zip_code}
                      onChange={(e) => setIssuer({ ...issuer, issuer_zip_code: e.target.value })}
                      placeholder="01234-567"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuer-phone">Telefone</Label>
                    <Input
                      id="issuer-phone"
                      value={issuer.issuer_phone}
                      onChange={(e) => setIssuer({ ...issuer, issuer_phone: e.target.value })}
                      placeholder="(11) 3456-7890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuer-email">Email</Label>
                    <Input
                      id="issuer-email"
                      type="email"
                      value={issuer.issuer_email}
                      onChange={(e) => setIssuer({ ...issuer, issuer_email: e.target.value })}
                      placeholder="contato@suaempresa.com.br"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer-logo">URL do Logotipo</Label>
                  <Input
                    id="issuer-logo"
                    value={issuer.issuer_logo_url}
                    onChange={(e) => setIssuer({ ...issuer, issuer_logo_url: e.target.value })}
                    placeholder="https://seudominio.com/logo.png"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Configurações de Atendimento */}
          <AccordionItem value="atendimento">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <Headset className="w-5 h-5 text-primary" />
                Configurações de Atendimento
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <AtendimentoSection />
            </AccordionContent>
          </AccordionItem>

          {/* 3. Configurações WhatsApp */}
          <AccordionItem value="whatsapp">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Configurações WhatsApp (Evolution API)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <WhatsappSection />
            </AccordionContent>
          </AccordionItem>

          {/* 4. Configurações Efí / Financeiro */}
          <AccordionItem value="efi">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Configurações Efí / Financeiro
                {form.billing_provider === 'EFI' && (
                  <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200">Padrão</Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5">
                <div className={`rounded-xl border-2 p-4 transition-all ${
                  form.billing_provider === 'EFI'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-border bg-card'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium">Efí Bank (Gerencianet)</span>
                      {form.billing_provider === 'EFI' && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Banco Padrão</Badge>
                      )}
                    </div>
                    {form.billing_provider !== 'EFI' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setForm({ ...form, billing_provider: 'EFI' })}
                      >
                        Definir como Padrão
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Este é o banco usado quando você clica em "Faturar" nas cobranças e assinaturas. A emissão manual na aba "Venda Avulsa" permite escolher o banco a cada cobrança.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Provedor de Pagamento — Efí Bank (Gerencianet)</p>
                  <Button variant="outline" size="sm" onClick={handleTestEfi} disabled={testingEfi}>
                    {testingEfi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                    Testar Conexão
                  </Button>
                </div>

                {efiTestResult && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    efiTestResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {efiTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {efiTestResult.message}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="efi-client-id">Client ID</Label>
                      <Input
                        id="efi-client-id"
                        type="password"
                        value={efiConfig.clientId}
                        onChange={(e) => { setEfiConfig({ ...efiConfig, clientId: e.target.value }); setEfiClientIdSaved(false); }}
                        placeholder={efiClientIdSaved ? '•••••••• (já salvo — digite para alterar)' : 'Seu Client ID Efí'}
                      />
                      {efiClientIdSaved && !efiConfig.clientId && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Client ID já configurado
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="efi-client-secret">Client Secret</Label>
                      <Input
                        id="efi-client-secret"
                        type="password"
                        value={efiConfig.clientSecret}
                        onChange={(e) => { setEfiConfig({ ...efiConfig, clientSecret: e.target.value }); setEfiClientSecretSaved(false); }}
                        placeholder={efiClientSecretSaved ? '•••••••• (já salvo — digite para alterar)' : 'Seu Client Secret Efí'}
                      />
                      {efiClientSecretSaved && !efiConfig.clientSecret && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Client Secret já configurado
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="efi-pix-key">Chave Pix</Label>
                    <Input
                      id="efi-pix-key"
                      value={efiConfig.pixKey}
                      onChange={(e) => setEfiConfig({ ...efiConfig, pixKey: e.target.value })}
                      placeholder="Sua chave Pix cadastrada na Efí"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Certificado .p12</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => efiCertInputRef.current?.click()} className="w-full">
                        <Upload className="w-4 h-4 mr-2" />
                        {efiCertFileName || (efiCertUploaded ? 'Certificado carregado — trocar arquivo' : 'Selecionar certificado .p12...')}
                      </Button>
                      <input
                        ref={efiCertInputRef}
                        type="file"
                        accept=".p12,.pfx,application/x-pkcs12"
                        onChange={handleEfiCertUpload}
                        className="hidden"
                      />
                    </div>
                    {efiCertUploaded && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Certificado armazenado no sistema
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="efi-sandbox"
                      checked={efiConfig.sandbox}
                      onChange={(e) => setEfiConfig({ ...efiConfig, sandbox: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="efi-sandbox" className="text-sm cursor-pointer">
                      Modo Homologação (Sandbox)
                    </Label>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                    <p className="font-medium mb-1">Como configurar:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Crie sua conta na Efí Bank e obtenha Client ID e Client Secret</li>
                      <li>Gere o certificado .p12 no painel da Efí e faça upload acima</li>
                      <li>Cadastre sua chave Pix para receber pagamentos via Pix</li>
                      <li>Clique em "Testar Conexão" para validar</li>
                    </ol>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs">
                    <p className="font-medium mb-1">Webhooks Efí:</p>
                    <p className="text-muted-foreground mb-1">Notificação de boleto pago:</p>
                    <code className="text-xs break-all block mb-2">
                      {process.env.NEXT_PUBLIC_APP_URL || 'https://seu-dominio.com'}/api/webhooks/efi
                    </code>
                    <p className="text-muted-foreground mb-1">Notificação de Pix pago:</p>
                    <code className="text-xs break-all block">
                      {process.env.NEXT_PUBLIC_APP_URL || 'https://seu-dominio.com'}/api/webhooks/efi/pix
                    </code>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4b. Configurações Banco Inter */}
          <AccordionItem value="inter">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                Configurações Banco Inter (Boleto + PIX + DDA)
                {form.billing_provider === 'INTER' && (
                  <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200">Padrão</Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5">
                <div className={`rounded-xl border-2 p-4 transition-all ${
                  form.billing_provider === 'INTER'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-border bg-card'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">Banco Inter</span>
                      {form.billing_provider === 'INTER' && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Banco Padrão</Badge>
                      )}
                    </div>
                    {form.billing_provider !== 'INTER' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setForm({ ...form, billing_provider: 'INTER' })}
                      >
                        Definir como Padrão
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quando definido como padrão, todas as cobranças geradas pelo "Faturar" usarão o Banco Inter. A emissão manual na aba "Venda Avulsa" permite escolher o banco a cada cobrança.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Segundo provedor de pagamentos — Banco Inter</p>
                  <Button variant="outline" size="sm" onClick={handleTestInter} disabled={testingInter}>
                    {testingInter ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                    Testar Conexão
                  </Button>
                </div>

                {interTestResult && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    interTestResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {interTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {interTestResult.message}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inter-client-id">Client ID</Label>
                      <Input
                        id="inter-client-id"
                        type="password"
                        value={interConfig.clientId}
                        onChange={(e) => { setInterConfig({ ...interConfig, clientId: e.target.value }); setInterClientIdSaved(false); }}
                        placeholder={interClientIdSaved ? '•••••••• (já salvo — digite para alterar)' : 'Seu Client ID do Inter'}
                      />
                      {interClientIdSaved && !interConfig.clientId && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Client ID já configurado
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inter-client-secret">Client Secret</Label>
                      <Input
                        id="inter-client-secret"
                        type="password"
                        value={interConfig.clientSecret}
                        onChange={(e) => { setInterConfig({ ...interConfig, clientSecret: e.target.value }); setInterClientSecretSaved(false); }}
                        placeholder={interClientSecretSaved ? '•••••••• (já salvo — digite para alterar)' : 'Seu Client Secret do Inter'}
                      />
                      {interClientSecretSaved && !interConfig.clientSecret && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Client Secret já configurado
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Certificado .crt</Label>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => interCertInputRef.current?.click()} className="w-full">
                          <Upload className="w-4 h-4 mr-2" />
                          {interCertFileName || (interCertUploaded ? 'Certificado carregado — trocar' : 'Selecionar .crt...')}
                        </Button>
                        <input
                          ref={interCertInputRef}
                          type="file"
                          accept=".crt,.pem,application/x-x509-ca-cert"
                          onChange={handleInterCertUpload}
                          className="hidden"
                        />
                      </div>
                      {interCertUploaded && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Certificado .crt armazenado
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Chave .key</Label>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => interKeyInputRef.current?.click()} className="w-full">
                          <Upload className="w-4 h-4 mr-2" />
                          {interKeyFileName || (interKeyUploaded ? 'Chave carregada — trocar' : 'Selecionar .key...')}
                        </Button>
                        <input
                          ref={interKeyInputRef}
                          type="file"
                          accept=".key,.pem,application/pkcs8"
                          onChange={handleInterKeyUpload}
                          className="hidden"
                        />
                      </div>
                      {interKeyUploaded && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Chave .key armazenada
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="inter-sandbox"
                      checked={interConfig.sandbox}
                      onChange={(e) => setInterConfig({ ...interConfig, sandbox: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="inter-sandbox" className="text-sm cursor-pointer">
                      Modo Sandbox (Homologação)
                    </Label>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                    <p className="font-medium mb-1">Como configurar o Banco Inter:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Acesse o Portal do Desenvolvedor do Banco Inter e crie sua aplicação</li>
                      <li>Obtenha o Client ID e Client Secret com escopo boleto-cobranca</li>
                      <li>Baixe o certificado .crt e a chave .key (mTLS) e faça upload acima</li>
                      <li>Clique em "Testar Conexão" para validar</li>
                      <li>No painel do Inter, configure o webhook para receber notificações de pagamento</li>
                    </ol>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs">
                    <p className="font-medium mb-1">Webhook Banco Inter:</p>
                    <p className="text-muted-foreground mb-1">Notificação de pagamento:</p>
                    <code className="text-xs break-all block">
                      {process.env.NEXT_PUBLIC_APP_URL || 'https://seu-dominio.com'}/api/webhooks/inter
                    </code>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4c. Configurações Asaas */}
          <AccordionItem value="asaas">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Configurações Asaas
                {form.billing_provider === 'ASAAS' && <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200">Padrão</Badge>}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className={`rounded-xl border-2 p-4 transition-all ${form.billing_provider === 'ASAAS' ? 'border-emerald-300 bg-emerald-50/50' : 'border-border bg-card'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium">Asaas — boleto e cobrança recorrente</span>
                      {form.billing_provider === 'ASAAS' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Banco Padrão</Badge>}
                    </div>
                    {form.billing_provider !== 'ASAAS' && <Button size="sm" variant="outline" onClick={() => setForm({ ...form, billing_provider: 'ASAAS' })}>Definir como Padrão</Button>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Plataforma de cobrança com boleto, PIX e cobrança recorrente sem mensalidade.</p>
                </div>

                <div className="space-y-4">
                  {/* anti-password-manager honeypot inputs */}
                  <input type="text" style={{ display: 'none' }} autoComplete="off" tabIndex={-1} aria-hidden="true" />
                  <input type="password" style={{ display: 'none' }} autoComplete="off" tabIndex={-1} aria-hidden="true" />

                  <div className="space-y-2">
                    <Label htmlFor="asaas-api-key">API Key do Asaas</Label>
                    <div className="relative">
                      <Input
                        id="asaas-api-key"
                        type={asaasShowKey ? 'text' : 'text'}
                        inputMode="text"
                        autoComplete="off"
                        data-lpignore="true"
                        data-form-type="other"
                        data-1p-ignore="true"
                        spellCheck={false}
                        name="asaas_api_key_field"
                        value={asaasConfig.apiKey}
                        onChange={(e) => { setAsaasConfig({ ...asaasConfig, apiKey: e.target.value }); setAsaasApiKeySaved(false); }}
                        placeholder={asaasApiKeySaved ? '•••••••• (já salvo — digite para alterar)' : '$aact_prod_... (sua chave da API Asaas, ~180 caracteres)'}
                        className="font-mono text-xs pr-10"
                        style={{ fontFamily: 'monospace' }}
                      />
                      <button
                        type="button"
                        onClick={() => setAsaasShowKey(!asaasShowKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {asaasShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {asaasApiKeySaved && !asaasConfig.apiKey && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        API Key já configurada
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="asaas-sandbox"
                      checked={asaasConfig.sandbox}
                      onChange={(e) => setAsaasConfig({ ...asaasConfig, sandbox: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="asaas-sandbox" className="text-sm cursor-pointer">
                      Modo Sandbox (Homologação)
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleTestAsaas} disabled={testingAsaas}>
                      {testingAsaas ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                      Testar Comunicação Asaas
                    </Button>
                  </div>
                  {asaasTestResult && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                      asaasTestResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      {asaasTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {asaasTestResult.message}
                    </div>
                  )}

                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                    <p className="font-medium mb-1">Como configurar o Asaas:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Crie sua conta no Asaas e acesse o painel</li>
                      <li>Vá em "Minha Conta" &gt; "API" e gere sua chave de API</li>
                      <li>Cole a chave completa no campo acima (começa com $aact_prod_ e tem ~180 caracteres)</li>
                      <li>Marque "Modo Sandbox" se estiver testando</li>
                      <li>Clique em "Salvar Configurações" para finalizar</li>
                    </ol>
                    <p className="mt-2 pt-2 border-t border-blue-200">
                      <strong>Webhook de pagamento:</strong> Configure no painel do Asaas a URL:
                      <code className="text-xs break-all block mt-1">
                        {process.env.NEXT_PUBLIC_APP_URL || 'https://seu-dominio.com'}/api/webhooks/asaas
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 5. Configurações de Email (SMTP) */}
          <AccordionItem value="email">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Configurações de Email (SMTP)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Servidor de email para envio de cobranças</p>
                  <Button variant="outline" size="sm" onClick={handleTestEmail} disabled={testingEmail}>
                    {testingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                    Testar Email
                  </Button>
                </div>

                {emailTestResult && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    emailTestResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {emailTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {emailTestResult.message}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">Servidor SMTP</Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.hostinger.com"
                        value={smtpConfig.host}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Porta</Label>
                      <Select
                        value={String(smtpConfig.port)}
                        onValueChange={(v) => setSmtpConfig({ ...smtpConfig, port: parseInt(v, 10), secure: v === '465' })}
                      >
                        <SelectTrigger id="smtp-port"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="587">587 (STARTTLS)</SelectItem>
                          <SelectItem value="465">465 (SSL/TLS)</SelectItem>
                          <SelectItem value="25">25 (sem criptografia)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-user">Usuário (Email)</Label>
                      <Input
                        id="smtp-user"
                        type="email"
                        placeholder="contato@suaempresa.com.br"
                        value={smtpConfig.user}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-pass">Senha</Label>
                      <Input
                        id="smtp-pass"
                        type="password"
                        placeholder="Senha do email"
                        value={smtpConfig.password}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from">Email Remetente (From)</Label>
                    <Input
                      id="smtp-from"
                      type="email"
                      placeholder="contato@suaempresa.com.br"
                      value={smtpConfig.fromEmail}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                    />
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                    Configure com os dados do seu provedor de email (Hostinger, Gmail, Outlook, etc).
                    Para Gmail, use App Password (não a senha normal). Porta 465 = SSL, 587 = STARTTLS.
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 6. Configurações de Cobrança — Templates */}
          <AccordionItem value="cobranca">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Configurações de Cobrança (Templates e Lembretes)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  Variáveis: {'{NOME_CLIENTE}'}/{'{nome}'}, {'{NOME_EMPRESA}'}, {'{MES_REFERENCIA}'}/{'{mes}'}, {'{DATA_VENCIMENTO}'}/{'{data_vencimento}'}, {'{VALOR}'}/{'{valor}'}, {'{link_fatura_publica}'}/{'{link}'}, {'{boleto_url}'}, {'{linha_digitavel}'}/{'{boleto}'}, {'{pix_copia_e_cola}'}/{'{pix}'}, {'{plano}'}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="tpl-faturar">Mensagem ao Faturar (enviada automaticamente via WhatsApp)</Label>
                  <Textarea
                    id="tpl-faturar"
                    rows={12}
                    value={form.template_faturar}
                    onChange={(e) => setForm({ ...form, template_faturar: e.target.value })}
                    placeholder={`Olá, {NOME_CLIENTE},\n\nSua Fatura já se encontra Disponível\n{NOME_EMPRESA}\n\nSua Mensalidade referente ao mês de: {MES_REFERENCIA} vence no dia: {DATA_VENCIMENTO}\nNo Valor: R$ {VALOR}\n\nClique no Link da fatura abaixo para Efetuar o Pagamento:\n(PIX E BOLETO)\n{link_fatura_publica}\n\nPara acessar seu Boleto Clique Aqui:\n{boleto_url}\n\nLinha digitável do boleto:\n{linha_digitavel}\n\nPIX Copia e Cola:\n{pix_copia_e_cola}\n\nQualquer dúvida, entre em contato.`}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-d1-pre">Lembrete D-1 (1 dia antes do vencimento)</Label>
                    <Textarea
                      id="tpl-d1-pre"
                      rows={8}
                      value={form.template_lembrete_d3}
                      onChange={(e) => setForm({ ...form, template_lembrete_d3: e.target.value })}
                      placeholder={`Olá, {NOME_CLIENTE}!\n\nLembrete da {RAZAO_SOCIAL}: sua cobrança vence amanhã.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nPague pela fatura:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl-d0">Lembrete D-0 (dia do vencimento)</Label>
                    <Textarea
                      id="tpl-d0"
                      rows={8}
                      value={form.template_lembrete_d0}
                      onChange={(e) => setForm({ ...form, template_lembrete_d0: e.target.value })}
                      placeholder={`Olá, {NOME_CLIENTE}!\n\nHoje é o vencimento da sua cobrança com a {RAZAO_SOCIAL}.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nFatura e opções de pagamento:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}`}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-d1">Lembrete D+1 (1 dia após — atrasada leve)</Label>
                    <Textarea
                      id="tpl-d1"
                      rows={8}
                      value={form.template_lembrete_d1}
                      onChange={(e) => setForm({ ...form, template_lembrete_d1: e.target.value })}
                      placeholder={`Olá, {NOME_CLIENTE}!\n\nIdentificamos que a cobrança da {RAZAO_SOCIAL} venceu ontem e ainda está pendente.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nRegularize pela fatura:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}\n\nSe já realizou o pagamento, desconsidere esta mensagem.`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl-d5p">Lembrete D+5 (5 dias após — atrasada)</Label>
                    <Textarea
                      id="tpl-d5p"
                      rows={8}
                      value={form.template_lembrete_d7_pos}
                      onChange={(e) => setForm({ ...form, template_lembrete_d7_pos: e.target.value })}
                      placeholder={`Olá, {NOME_CLIENTE}!\n\nSua cobrança da {RAZAO_SOCIAL} está há 5 dias vencida. Evite a continuidade da pendência e regularize hoje.\n\nValor: {VALOR}\nVencimento: {DATA_VENCIMENTO}\n\nPIX Copia e Cola:\n{PIX_COPIA_E_COLA}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nAcesse a fatura para pagar:\n{LINK_FATURA_PUBLICA}\n\nBoleto em PDF:\n{BOLETO_URL}\n\nSe já realizou o pagamento, desconsidere esta mensagem.`}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-pago">Confirmação de Pagamento</Label>
                  <Textarea
                    id="tpl-pago"
                    rows={3}
                    value={form.template_pago}
                    onChange={(e) => setForm({ ...form, template_pago: e.target.value })}
                    placeholder="Pagamento confirmado! Recebemos {valor}. Obrigado, {nome}!"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder-rules">Regras de Lembrete</Label>
                  <Input
                    id="reminder-rules"
                    value={form.reminder_rules}
                    onChange={(e) => setForm({ ...form, reminder_rules: e.target.value })}
                    placeholder="D-1,D-0,D+1,D+5"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.reminder_rules.split(',').map((rule) => {
                      const r = rule.trim().toUpperCase();
                      const isBefore = r.startsWith('D-');
                      const isDay = r === 'D-0' || r === 'D0';
                      return (
                        <Badge
                          key={r}
                          variant="outline"
                          className={
                            isDay
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isBefore
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {r}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>D-N</strong> = N dias antes do vencimento, <strong>D+N</strong> = N dias após
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Save button — outside accordion, always visible */}
        <div className="flex justify-end mt-6 pt-4 border-t border-border">
          <Button onClick={handleSaveAll} disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
