'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn, UserPlus, KeyRound, Search, Building2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadSystemUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/footer';
import Image from 'next/image';

type Mode = 'login' | 'signup' | 'recover';

type IssuerForm = {
  name: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  im: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [userName, setUserName] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [issuer, setIssuer] = useState<IssuerForm>({
    name: '', tradeName: '', cnpj: '', ie: '', im: '',
    address: '', city: '', state: '', zipCode: '', phone: '', email: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/');
    });
  }, [router]);

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError('');
    setSuccess('');
  }

  async function handleBuscarCnpj() {
    const cnpjDigits = issuer.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      setError('Digite um CNPJ válido com 14 dígitos.');
      return;
    }
    setCnpjLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/consultar/cnpj/${cnpjDigits}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const d = data.data;
        const fullAddress = [d.street, d.street_number, d.complement, d.neighborhood].filter(Boolean).join(', ');
        setIssuer((prev) => ({
          ...prev,
          name: d.name || prev.name,
          tradeName: d.trade_name || prev.tradeName,
          cnpj: cnpjDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
          address: fullAddress || prev.address,
          city: d.city || prev.city,
          state: d.state || prev.state,
          zipCode: d.zip_code || prev.zipCode,
          phone: d.whatsapp || prev.phone,
          email: d.email || prev.email,
        }));
      } else {
        setError(data.error || 'Não foi possível consultar o CNPJ.');
      }
    } catch {
      setError('Erro ao consultar CNPJ.');
    }
    setCnpjLoading(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    const result = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (result.error || !result.data.user) {
      setError('Email ou senha inválidos.');
      setLoading(false);
      return;
    }
    let profile;
    try {
      profile = await loadSystemUser(result.data.user.id);
    } catch {
      setError('Não foi possível carregar seu perfil de acesso.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    if (!profile.user) {
      setError('Perfil de usuário não encontrado. Fale com o administrador.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    if (!profile.user.ativo) {
      setError('Usuário desativado. Fale com o administrador.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    await supabase.from('usuarios_sistema').update({ ultimo_acesso: new Date().toISOString() }).eq('id', result.data.user.id);
    if (!remember) window.sessionStorage.setItem('zm_session', '1');
    router.replace('/');
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    if (!userName.trim()) { setError('Digite seu nome completo.'); setLoading(false); return; }
    if (!issuer.name.trim() || !issuer.cnpj.trim()) { setError('Preencha os dados do emitente (razão social e CNPJ).'); setLoading(false); return; }
    if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); setLoading(false); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); setLoading(false); return; }
    const trimmedEmail = email.trim().toLowerCase();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: trimmedEmail, password });
    if (signUpError) {
      setError(signUpError.message.includes('already') || signUpError.message.includes('registered')
        ? 'Este email já está cadastrado. Faça login ou recupere sua senha.'
        : signUpError.message);
      setLoading(false);
      return;
    }
    const userId = signUpData.user?.id;
    if (!userId) {
      setSuccess('Conta criada! Verifique seu email para confirmar o cadastro antes de fazer login.');
      setLoading(false);
      return;
    }
    try {
      await supabase.rpc('bootstrap_admin', { p_email: trimmedEmail, p_password: password });
    } catch {
      // non-critical if it already exists
    }
    try {
      await supabase.from('usuarios_sistema').update({ nome: userName.trim(), cargo: 'admin' }).eq('id', userId);
      await supabase.from('settings').update({
        issuer_name: issuer.name,
        issuer_trade_name: issuer.tradeName,
        issuer_cnpj: issuer.cnpj,
        issuer_ie: issuer.ie || null,
        issuer_im: issuer.im || null,
        issuer_address: issuer.address || null,
        issuer_city: issuer.city || null,
        issuer_state: issuer.state || null,
        issuer_zip_code: issuer.zipCode || null,
        issuer_phone: issuer.phone || null,
        issuer_email: issuer.email || null,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
    } catch {
      // non-critical
    }
    setSuccess('Cadastro realizado! Você já pode fazer login com seus dados.');
    setMode('login');
    setLoading(false);
  }

  async function handleRecover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const trimmedEmail = email.trim().toLowerCase();
    const { error: recoverError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (recoverError) {
      setError('Não foi possível enviar o email de recuperação. Verifique o endereço digitado.');
    } else {
      setSuccess('Se o email estiver cadastrado, você receberá um link para redefinir sua senha.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Image src="/cobrancapro-logo-transparent.png" alt="CobrancaPro" width={280} height={168} className="h-auto w-56 rounded-2xl object-cover shadow-lg" />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8 [&_input]:bg-white [&_input]:text-slate-900 [&_input]:border-slate-300 [&_input]:placeholder:text-slate-400 [&_input:focus]:border-blue-500">
            {mode === 'login' && (
              <>
                <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Acesse sua conta</h1><p className="text-sm text-slate-500 mt-1">Entre no CobrancaPro para continuar.</p></div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
                  <div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" placeholder="••••••••" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" />Lembrar-me</label>
                  {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
                  <Button className="w-full" disabled={loading} size="lg">{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}{loading ? 'Entrando...' : 'Entrar'}</Button>
                </form>
                <div className="mt-6 space-y-2 text-center">
                  <button onClick={() => switchMode('recover')} className="text-sm text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-1.5 w-full"><KeyRound className="w-3.5 h-3.5" />Esqueci minha senha</button>
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-sm text-slate-600">Não tem conta?</p>
                    <button onClick={() => switchMode('signup')} className="mt-1 text-sm font-medium text-primary hover:underline flex items-center justify-center gap-1.5 w-full"><UserPlus className="w-3.5 h-3.5" />Cadastrar-se gratuitamente</button>
                  </div>
                </div>
              </>
            )}
            {mode === 'signup' && (
              <>
                <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Cadastrar-se</h1><p className="text-sm text-slate-500 mt-1">Preencha os dados da sua empresa e crie seu acesso.</p></div>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3"><div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-blue-800">Dados do Emitente</span></div></div>
                  <div className="space-y-2"><Label htmlFor="signup-cnpj">CNPJ</Label><div className="flex gap-2"><Input id="signup-cnpj" value={issuer.cnpj} onChange={(e) => setIssuer({ ...issuer, cnpj: e.target.value })} placeholder="12.345.678/0001-90" /><Button type="button" variant="outline" size="sm" onClick={handleBuscarCnpj} disabled={cnpjLoading} className="shrink-0">{cnpjLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}Buscar</Button></div></div>
                  <div className="space-y-2"><Label htmlFor="signup-name">Razão Social</Label><Input id="signup-name" value={issuer.name} onChange={(e) => setIssuer({ ...issuer, name: e.target.value })} placeholder="Sua Empresa LTDA" /></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="signup-trade">Nome Fantasia</Label><Input id="signup-trade" value={issuer.tradeName} onChange={(e) => setIssuer({ ...issuer, tradeName: e.target.value })} placeholder="Nome Fantasia" /></div><div className="space-y-2"><Label htmlFor="signup-phone">Telefone</Label><Input id="signup-phone" value={issuer.phone} onChange={(e) => setIssuer({ ...issuer, phone: e.target.value })} placeholder="(11) 3456-7890" /></div></div>
                  <div className="grid grid-cols-3 gap-3"><div className="col-span-2 space-y-2"><Label htmlFor="signup-address">Endereço</Label><Input id="signup-address" value={issuer.address} onChange={(e) => setIssuer({ ...issuer, address: e.target.value })} placeholder="Rua, número, bairro" /></div><div className="space-y-2"><Label htmlFor="signup-state">UF</Label><Input id="signup-state" value={issuer.state} onChange={(e) => setIssuer({ ...issuer, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" /></div></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="signup-city">Cidade</Label><Input id="signup-city" value={issuer.city} onChange={(e) => setIssuer({ ...issuer, city: e.target.value })} placeholder="São Paulo" /></div><div className="space-y-2"><Label htmlFor="signup-zip">CEP</Label><Input id="signup-zip" value={issuer.zipCode} onChange={(e) => setIssuer({ ...issuer, zipCode: e.target.value })} placeholder="01234-567" /></div></div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3"><div className="flex items-center gap-2 mb-2"><UserPlus className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-800">Dados do Usuário</span></div></div>
                  <div className="space-y-2"><Label htmlFor="signup-user-name">Nome completo</Label><Input id="signup-user-name" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Seu nome" /></div>
                  <div className="space-y-2"><Label htmlFor="signup-email">Email</Label><Input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="signup-password">Senha</Label><Input id="signup-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div><div className="space-y-2"><Label htmlFor="signup-confirm">Confirmar senha</Label><Input id="signup-confirm" type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" /></div></div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="rounded" />Mostrar senhas</label>
                  {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
                  <Button className="w-full" disabled={loading} size="lg">{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}{loading ? 'Cadastrando...' : 'Criar conta'}</Button>
                </form>
                <div className="mt-4 text-center"><button onClick={() => switchMode('login')} className="text-sm text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-1.5 w-full"><ArrowLeft className="w-3.5 h-3.5" />Voltar para o login</button></div>
              </>
            )}
            {mode === 'recover' && (
              <>
                <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Recuperar Senha</h1><p className="text-sm text-slate-500 mt-1">Informe seu email para receber um link de redefinição.</p></div>
                <form onSubmit={handleRecover} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="recover-email">Email</Label><Input id="recover-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
                  {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
                  {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{success}</div>}
                  <Button className="w-full" disabled={loading} size="lg">{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}{loading ? 'Enviando...' : 'Enviar link de recuperação'}</Button>
                </form>
                <div className="mt-4 text-center"><button onClick={() => switchMode('login')} className="text-sm text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-1.5 w-full"><ArrowLeft className="w-3.5 h-3.5" />Voltar para o login</button></div>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
