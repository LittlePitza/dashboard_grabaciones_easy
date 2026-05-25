'use client';

import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { AdminLoginModal } from '../modals/AdminLoginModal';
import { useState } from 'react';

export function Topbar() {
  const { theme, setTheme, syncStatus } = useAppStore() as any;
  const { role, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <>
      <header className="app-topbar">
        {/* Mobile hamburger */}
        <button
          className="icon-btn mobile-menu-btn"
          style={{ display: 'none' }}
          onClick={() => useAppStore.getState().setSidebarOpen?.(true)}
          aria-label="Abrir menú"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div style={{ flex: 1 }} />

        {/* Sync status */}
        <span className={`sync-indicator sync-${syncStatus}`}>
          ⬤ {syncStatus}
        </span>

        {/* Chip de rol */}
        {role === 'admin' && (
          <span style={{
            padding: '2px 10px', borderRadius: 99,
            fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
            background: 'var(--color-primary-highlight)',
            color: 'var(--color-primary)',
          }}>
            ADMIN
          </span>
        )}

        {/* Theme toggle */}
        <button className="icon-btn" onClick={toggleTheme} aria-label="Cambiar tema">
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Admin / Logout */}
        {role === 'lector' ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowLogin(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={logout}>Salir</button>
        )}
      </header>

      {showLogin && <AdminLoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
