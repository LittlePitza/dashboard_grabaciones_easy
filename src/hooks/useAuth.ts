'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/store';

export function useAuth() {
  const { role, setRole, addToast } = useAppStore();

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      addToast('Credenciales incorrectas', 'error');
      return false;
    }
    setRole('admin');
    sessionStorage.setItem('role', 'admin');
    addToast('Sesión admin iniciada', 'success');
    return true;
  }, [setRole, addToast]);

  const logout = useCallback(async () => {
    const sb = createClient();
    await sb.auth.signOut();
    sessionStorage.removeItem('role');
    setRole('lector');
    addToast('Sesión cerrada', 'info');
  }, [setRole, addToast]);

  const checkSession = useCallback(async () => {
    const sb = createClient();
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        setRole('admin');
        sessionStorage.setItem('role', 'admin');
      } else {
        setRole('lector');
      }
    } catch {
      setRole('lector');
    }
  }, [setRole]);

  const can = useCallback((action: string): boolean => {
    const perms: Record<string, string[]> = {
      lector: ['view'],
      admin: ['view', 'checkin', 'edit_loc', 'delete_loc', 'change_estado'],
    };
    return (perms[role] ?? []).includes(action);
  }, [role]);

  return { role, login, logout, checkSession, can };
}
