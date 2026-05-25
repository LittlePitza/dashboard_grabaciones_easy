'use client';

import { create } from 'zustand';
import type {
  Location, Checkin, Role, ActiveRoute, HistoryRoute,
  ViewId, Toast, ToastType, Theme,
} from '@/types';
import { today, genId, locStatus, daysUntilDue } from '@/lib/utils';

// ─── SEED ────────────────────────────────────────────────────

const SEED_LOCATIONS: Location[] = [
  { id: 'seed-1', name: 'Ejemplo Obra A', address: 'Calle 1, Zacatepec', responsable: 'Juan', freq_days: 15 },
  { id: 'seed-2', name: 'Ejemplo Obra B', address: 'Calle 2, Jojutla', responsable: 'María', freq_days: 7 },
];

// ─── TYPES ───────────────────────────────────────────────────

interface AppState {
  // Data
  locations: Location[];
  checkins: Checkin[];
  // UI state
  currentView: ViewId;
  currentLocFilter: string;
  currentRegFilter: string;
  currentVideoFilter: string;
  currentVideoLocId: string | null;
  corrienteSearch: string;
  rutaSelected: string[];
  currentRutaTab: string;
  // Route
  activeRoute: ActiveRoute | null;
  routeHistory: HistoryRoute[];
  // Auth
  role: Role;
  // App
  theme: Theme;
  toasts: Toast[];
  syncStatus: 'online' | 'local' | 'offline';
  // Mapa
  mapaFilter: string;

  // Actions — Data
  setLocations: (locs: Location[]) => void;
  setCheckins: (cis: Checkin[]) => void;
  updateLocation: (loc: Location) => void;
  removeLocation: (id: string) => void;
  updateCheckin: (ci: Checkin) => void;
  removeCheckin: (id: string) => void;
  addCheckin: (ci: Checkin) => void;
  updateLastCheckins: () => void;

  // Actions — UI
  setView: (v: ViewId) => void;
  setLocFilter: (f: string) => void;
  setRegFilter: (f: string) => void;
  setVideoFilter: (f: string) => void;
  setVideoLocId: (id: string | null) => void;
  setCorrienteSearch: (q: string) => void;
  setRutaSelected: (ids: string[]) => void;
  addToRuta: (id: string) => void;
  removeFromRuta: (id: string) => void;
  clearRuta: () => void;
  setRutaTab: (tab: string) => void;
  setMapaFilter: (f: string) => void;

  // Actions — Route
  setActiveRoute: (r: ActiveRoute | null) => void;
  setRouteHistory: (h: HistoryRoute[]) => void;
  addRouteHistory: (r: HistoryRoute) => void;

  // Actions — Auth
  setRole: (r: Role) => void;

  // Actions — App
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  setSyncStatus: (s: 'online' | 'local' | 'offline') => void;
  addToast: (msg: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  locations: [],
  checkins: [],
  currentView: 'dashboard',
  currentLocFilter: 'todas',
  currentRegFilter: 'todos',
  currentVideoFilter: 'todas',
  currentVideoLocId: null,
  corrienteSearch: '',
  rutaSelected: [],
  currentRutaTab: 'activa',
  activeRoute: null,
  routeHistory: [],
  role: 'lector',
  theme: 'dark',
  toasts: [],
  syncStatus: 'local',
  mapaFilter: 'todas',

  // Data actions
  setLocations: (locs) => set({ locations: locs.length ? locs : SEED_LOCATIONS }),
  setCheckins: (cis) => set({ checkins: cis }),

  updateLocation: (loc) =>
    set((s) => ({
      locations: s.locations.map((l) => (l.id === loc.id ? loc : l)).concat(
        s.locations.find((l) => l.id === loc.id) ? [] : [loc]
      ),
    })),

  removeLocation: (id) =>
    set((s) => ({
      locations: s.locations.filter((l) => l.id !== id),
      checkins: s.checkins.filter((c) => c.location_id !== id),
    })),

  updateCheckin: (ci) =>
    set((s) => ({
      checkins: s.checkins.map((c) => (c.id === ci.id ? ci : c)),
    })),

  removeCheckin: (id) =>
    set((s) => ({ checkins: s.checkins.filter((c) => c.id !== id) })),

  addCheckin: (ci) =>
    set((s) => ({ checkins: [ci, ...s.checkins] })),

  updateLastCheckins: () => {
    const { locations, checkins } = get();
    const updated = locations.map((loc) => {
      const last = checkins
        .filter((c) => c.location_id === loc.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return { ...loc, last_checkin: last?.date ?? null };
    });
    set({ locations: updated });
  },

  // UI actions
  setView: (v) => set({ currentView: v }),
  setLocFilter: (f) => set({ currentLocFilter: f }),
  setRegFilter: (f) => set({ currentRegFilter: f }),
  setVideoFilter: (f) => set({ currentVideoFilter: f }),
  setVideoLocId: (id) => set({ currentVideoLocId: id }),
  setCorrienteSearch: (q) => set({ corrienteSearch: q }),
  setRutaSelected: (ids) => set({ rutaSelected: ids }),
  addToRuta: (id) =>
    set((s) =>
      s.rutaSelected.includes(id)
        ? s
        : { rutaSelected: [...s.rutaSelected, id] }
    ),
  removeFromRuta: (id) =>
    set((s) => ({ rutaSelected: s.rutaSelected.filter((x) => x !== id) })),
  clearRuta: () => set({ rutaSelected: [] }),
  setRutaTab: (tab) => set({ currentRutaTab: tab }),
  setMapaFilter: (f) => set({ mapaFilter: f }),

  // Route actions
  setActiveRoute: (r) => set({ activeRoute: r }),
  setRouteHistory: (h) => set({ routeHistory: h }),
  addRouteHistory: (r) =>
    set((s) => ({ routeHistory: [r, ...s.routeHistory] })),

  // Auth actions
  setRole: (r) => set({ role: r }),

  // App actions
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTheme: (t) => set({ theme: t }),
  setSyncStatus: (s) => set({ syncStatus: s }),
  addToast: (msg, type = 'info') => {
    const id = genId();
    set((s) => ({ toasts: [...s.toasts, { id, message: msg, type }] }));
    setTimeout(() => get().removeToast(id), 3500);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
