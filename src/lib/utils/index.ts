import type { Location, LocStatus, CheckinEstado } from '@/types';

// ─── FECHAS ──────────────────────────────────────────────────

export const today = (): string => new Date().toISOString().slice(0, 10);

export const daysAgo = (d: string | null | undefined): number | null => {
  if (!d) return null;
  return Math.floor(
    (new Date(today()).getTime() - new Date(d).getTime()) / 86_400_000
  );
};

export const daysUntilDue = (loc: Location): number | null => {
  if (!loc.last_checkin) return null;
  const elapsed = daysAgo(loc.last_checkin);
  if (elapsed === null) return null;
  return loc.freq_days - elapsed;
};

export const locStatus = (loc: Location): LocStatus => {
  if (!loc.last_checkin) return 'never';
  const due = daysUntilDue(loc);
  if (due === null) return 'never';
  if (due < 0) return 'overdue';
  if (due <= 3) return 'soon';
  return 'ok';
};

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

export const fmtDuration = (ms: number): string => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const nowISO = (): string => new Date().toISOString();

// ─── IDs ─────────────────────────────────────────────────────

export const genId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ─── STRINGS ─────────────────────────────────────────────────

export const esc = (str: unknown): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─── YOUTUBE ─────────────────────────────────────────────────

export const ytVideoId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

export const ytThumb = (url: string | null | undefined): string | null => {
  const id = ytVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
};

// ─── MAPS ────────────────────────────────────────────────────

export const mapsUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps?q=${lat},${lng}`;

// ─── ESTADOS ─────────────────────────────────────────────────

export const ESTADOS: { key: CheckinEstado; label: string }[] = [
  { key: 'grabado',    label: 'Grabado' },
  { key: 'en_edicion', label: 'En edición' },
  { key: 'editado',    label: 'Editado' },
  { key: 'publicado',  label: 'Publicado' },
];

export const FREQ_LABELS: Record<number, string> = {
  7: 'Semanal',
  15: 'Quincenal',
  30: 'Mensual',
};

export const freqLabel = (days: number): string =>
  FREQ_LABELS[days] ?? `${days}d`;

// ─── RUTA ────────────────────────────────────────────────────

export const getPlannedDate = (loc: Location): string => {
  if (!loc.last_checkin) return today();
  const d = new Date(`${loc.last_checkin}T00:00:00`);
  d.setDate(d.getDate() + (loc.freq_days || 15));
  return d.toISOString().slice(0, 10);
};

export const startOfWeek = (dateStr: string): Date => {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
};

export const formatWeekLabel = (d: Date): string => {
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `Semana ${String(d.getDate()).padStart(2, '0')} ${m[d.getMonth()]}`;
};

// ─── CSV ─────────────────────────────────────────────────────

export const toCSV = (rows: (string | number | null | undefined)[][]): string =>
  rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
