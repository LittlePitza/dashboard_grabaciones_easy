// ─── DOMAIN TYPES ────────────────────────────────────────────

export type LocStatus = 'ok' | 'soon' | 'overdue' | 'never';

export interface Location {
  id: string;
  name: string;
  address?: string | null;
  responsable?: string | null;
  freq_days: number;
  last_checkin?: string | null;
  lat?: number | null;
  lng?: number | null;
  notion_url?: string | null;
  playlist_url?: string | null;
  created_at?: string;
}

export type CheckinEstado = 'grabado' | 'en_edicion' | 'editado' | 'publicado';

export interface EstadoHistoryEntry {
  estado: CheckinEstado;
  timestamp: string;
  estado_anterior?: CheckinEstado | null;
}

export interface Checkin {
  id: string;
  location_id: string;
  date: string;
  estado: CheckinEstado;
  foto_url?: string | null;
  link?: string | null;
  notes?: string | null;
  created_at?: string;
  estado_history?: EstadoHistoryEntry[];
}

export type Role = 'admin' | 'lector';

// ─── RUTA ────────────────────────────────────────────────────

export type StopStatus = 'pending' | 'done' | 'skipped';

export interface RouteStop {
  id: string;
  location_id: string;
  order: number;
  status: StopStatus;
  started_at?: string | null;
  ended_at?: string | null;
  visit_note?: string | null;
  checkin_id?: string | null;
}

export interface ActiveRoute {
  id: string;
  name: string;
  started_at: string;
  ended_at?: string | null;
  stops: RouteStop[];
}

export interface HistoryRoute {
  id: string;
  name: string;
  started_at: string;
  ended_at: string;
  stops: RouteStop[];
}

// ─── UI ──────────────────────────────────────────────────────

export type ViewId =
  | 'dashboard'
  | 'locaciones'
  | 'vencer'
  | 'registro'
  | 'ruta'
  | 'corriente'
  | 'videos'
  | 'mapa';

export type ToastType = 'info' | 'success' | 'error' | 'warn';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export type Theme = 'dark' | 'light';
