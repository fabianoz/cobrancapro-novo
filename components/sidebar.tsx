'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Wallet,
  Menu,
  X,
  ShoppingBag,
  Settings,
  MessageCircle,
  BarChart3,
  UserCog,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/components/auth-provider';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/customers', label: 'Clientes', icon: Users, module: 'clientes' },
  { href: '/plans', label: 'Planos', icon: CreditCard, module: 'planos' },
  { href: '/subscriptions', label: 'Assinaturas', icon: Receipt, module: 'assinaturas' },
  { href: '/charges', label: 'Cobranças', icon: Wallet, module: 'cobrancas' },
  { href: '/emitir', label: 'Venda Avulsa', icon: ShoppingBag, module: 'venda_avulsa' },
  { href: '/chat-cliente', label: 'Chat Cliente', icon: MessageCircle, module: 'atendimento' },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3, module: 'relatorios' },
  { href: '/settings', label: 'Configurações', icon: Settings, module: 'configuracoes' },
  { href: '/settings/users', label: 'Usuários', icon: UserCog, module: 'configuracoes_usuarios' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, hasPermission, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-14 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src="/cobrancapro-logo-transparent.png"
            alt="CobrancaPro"
            width={112}
            height={64}
            className="h-10 w-[70px] shrink-0 rounded-md object-cover"
          />
          <span className="truncate font-bold text-base">CobrancaPro</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
          <Image
            src="/cobrancapro-logo-transparent.png"
            alt="CobrancaPro"
            width={112}
            height={64}
            className="h-10 w-[70px] shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0">
            <div className="truncate font-bold text-base leading-tight">CobrancaPro</div>
            <div className="text-[11px] text-muted-foreground">Cobrança Recorrente</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.filter((item) => !item.module || hasPermission(item.module)).map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border space-y-3">
          {user && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {user.nome.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{user.nome}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user.cargo}</p>
              </div>
              <button onClick={signOut} className="p-1.5 text-muted-foreground hover:text-destructive" title="Sair">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistema online
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
