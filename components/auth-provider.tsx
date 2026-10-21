'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { can, loadSystemUser, type SystemUser, type UserPermission } from '@/lib/auth';

type AuthContextValue = {
  user: SystemUser | null;
  permissions: UserPermission[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasPermission: (modulo: string, action?: keyof Omit<UserPermission, 'modulo'>) => boolean;
  isSuperAdmin: boolean;
  empresaId: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SystemUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function hydrateSession(userId: string) {
      try {
        const result = await loadSystemUser(userId);
        if (!mounted) return;
        setUser(result.user);
        setPermissions(result.permissions ?? []);
      } catch {
        if (mounted) {
          setUser(null);
          setPermissions([]);
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        hydrateSession(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (!session?.user) {
          setUser(null);
          setPermissions([]);
          if (event === 'SIGNED_OUT') router.replace('/login');
          return;
        }
        await hydrateSession(session.user.id);
      })();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        setUser(null);
        setPermissions([]);
        router.replace('/login');
      },
      hasPermission: (modulo, action = 'pode_ver') =>
        can(permissions.find((item) => item.modulo === modulo), action),
      isSuperAdmin: user?.cargo === 'super_admin',
      empresaId: user?.empresa_id ?? null,
    }),
    [user, permissions, loading, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
