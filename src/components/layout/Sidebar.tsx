'use client';

import { useAppStore } from '@/lib/store';
import type { ViewId } from '@/types';

interface NavItem {
  view: ViewId;
  label: string;
  icon: React.ReactNode;
  badge?: 'vencer' | 'ruta' | 'videos';
}

const navPrincipal: NavItem[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="9" rx="1"/>
        <rect x="14" y="3" width="7" height="5" rx="1"/>
        <rect x="14" y="12" width="7" height="9" rx="1"/>
        <rect x="3" y="16" width="7" height="5" rx="1"/>
      </svg>
    ),
  },
  {
    view: 'locaciones',
    label: 'Locaciones',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    view: 'vencer',
    label: 'Por vencer',
    badge: 'vencer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    view: 'registro',
    label: 'Registro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
];

const navPlanificacion: NavItem[] = [
  {
    view: 'ruta',
    label: 'Mi Ruta',
    badge: 'ruta',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/>
        <circle cx="12" cy="18" r="2"/>
        <path d="M7 6h10M14 18H8.5a3.5 3.5 0 0 1 0-7H19a3.5 3.5 0 0 0 0-7H10"/>
      </svg>
    ),
  },
  {
    view: 'corriente',
    label: 'Al corriente',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    view: 'mapa',
    label: 'Mapa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    ),
  },
];

const navProduccion: NavItem[] = [
  {
    view: 'videos',
    label: 'Videos',
    badge: 'videos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
  },
];

export function Sidebar() {
  const {
    currentView, setView,
    locations, checkins,
    rutaSelected,
    sidebarOpen,
    setSidebarOpen,
  } = useAppStore() as any;

  const vencerCount = locations.filter((l: any) =>
    ['overdue','soon'].includes(
      !l.last_checkin ? 'never' :
      (() => {
        const d = Math.floor((new Date(new Date().toISOString().slice(0,10)).getTime() - new Date(l.last_checkin).getTime()) / 86400000);
        const due = l.freq_days - d;
        return due < 0 ? 'overdue' : due <= 3 ? 'soon' : 'ok';
      })()
    )
  ).length;

  const pendingVideos = checkins.filter((c: any) => c.estado !== 'publicado').length;

  const badges: Record<string, number> = {
    vencer: vencerCount,
    ruta: rutaSelected.length,
    videos: pendingVideos,
  };

  const badgeClass: Record<string, string> = {
    vencer: '',
    ruta: 'nav-badge-blue',
    videos: 'nav-badge-purple',
  };

  const handleNav = (view: ViewId) => {
    setView(view);
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      useAppStore.getState().setSidebarOpen?.(false);
    }
  };

  const renderItems = (items: NavItem[]) =>
    items.map(item => {
      const count = item.badge ? badges[item.badge] ?? 0 : 0;
      return (
        <button
          key={item.view}
          className={`nav-item${currentView === item.view ? ' active' : ''}`}
          onClick={() => handleNav(item.view)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
          {item.badge && (
            <span className={`nav-badge ${badgeClass[item.badge] ?? ''} ${count === 0 ? 'zero' : ''}`}>
              {count}
            </span>
          )}
        </button>
      );
    });

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => useAppStore.getState().setSidebarOpen?.(false)}
      />

      <nav className={`app-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">Grabación Obras</div>
          <div className="sidebar-brand-sub">Seguimiento de grabaciones</div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">Principal</span>
          {renderItems(navPrincipal)}
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <span className="sidebar-label">Planificación</span>
          {renderItems(navPlanificacion)}
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <span className="sidebar-label">Producción</span>
          {renderItems(navProduccion)}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-stat">
            <span>Locaciones</span>
            <span className="sidebar-stat-val">{locations.length}</span>
          </div>
          <div className="sidebar-stat">
            <span>Versión</span>
            <span className="sidebar-stat-val">2.0</span>
          </div>
        </div>
      </nav>
    </>
  );
}
