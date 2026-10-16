'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando acesso...
      </div>
    );
  }

  if (!user) {
    // useEffect will redirect; show nothing to avoid flash
    return null;
  }

  const moduleByPath: Record<string, string> = {
    '/configuracoes/usuarios': 'configuracoes_usuarios',
    '/settings/users': 'configuracoes_usuarios',
    '/': 'dashboard',
    '/customers': 'clientes',
    '/plans': 'planos',
    '/subscriptions': 'assinaturas',
    '/charges': 'cobrancas',
    '/emitir': 'venda_avulsa',
    '/atendimento': 'atendimento',
    '/settings': 'configuracoes',
  };

  const moduleEntry = Object.entries(moduleByPath).find(([path]) =>
    path === '/' ? pathname === path : pathname.startsWith(path),
  );
  const moduleName = moduleEntry?.[1];

  if (moduleName && !hasPermission(moduleName)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="mt-2 text-muted-foreground">
            Você não tem permissão para acessar este módulo. Fale com seu administrador.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
