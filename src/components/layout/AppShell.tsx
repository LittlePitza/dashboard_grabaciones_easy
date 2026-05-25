'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useData } from '@/hooks/useData';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../ui/ToastContainer';
import { DashboardView }  from '../views/DashboardView';
import { LocationsView }  from '../views/LocationsView';
import { VencerView }     from '../views/VencerView';
import { RegistroView }   from '../views/RegistroView';
import { RutaView }       from '../views/RutaView';
import { CorrienteView }  from '../views/CorrienteView';
import { VideosView }     from '../views/VideosView';
import { MapaView }       from '../views/MapaView';

const VIEW_MAP = {
  dashboard:  DashboardView,
  locaciones: LocationsView,
  vencer:     VencerView,
  registro:   RegistroView,
  ruta:       RutaView,
  corriente:  CorrienteView,
  videos:     VideosView,
  mapa:       MapaView,
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loadAll } = useData();
  const { checkSession } = useAuth();
  const { currentView, theme, setTheme, addToast } = useAppStore();

  // ── Inicialización ──────────────────────────────────────────
  useEffect(() => {
    // Restaurar tema
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }

    // Verificar sesión Supabase
    checkSession().then(() => loadAll());

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          reg.update();
          setInterval(() => reg.update().catch(() => {}), 60_000);
          reg.addEventListener('updatefound', () => {
            const w = reg.installing!;
            w.addEventListener('statechange', () => {
              if (w.state === 'installed' && navigator.serviceWorker.controller) {
                addToast('Actualizando a nueva versión…', 'info');
                setTimeout(() => w.postMessage({ type: 'SKIP_WAITING' }), 400);
              }
            });
          });
        })
        .catch(() => {});

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; location.reload(); }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ActiveView = VIEW_MAP[currentView] ?? DashboardView;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <div className="app-content">
          <ActiveView />
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
