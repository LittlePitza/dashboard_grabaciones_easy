'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { createClient } from '@/lib/supabase/client';
import {
  locStatus, daysUntilDue, fmtDate, mapsUrl,
  today, getPlannedDate, startOfWeek, formatWeekLabel,
  nowISO, fmtTime, fmtDuration, genId,
} from '@/lib/utils';
import type { Location, ActiveRoute, RouteStop, HistoryRoute } from '@/types';

// ─── Helpers locales ─────────────────────────────────────────
function fmtDurationShort(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}`;
  return `${m}m`;
}
function buildScore(loc: Location): number {
  const st = locStatus(loc);
  const due = daysUntilDue(loc) ?? 0;
  if (st === 'overdue') return 10000 + Math.abs(due) * 10;
  if (st === 'soon')    return 5000 + (3 - due) * 100;
  if (st === 'never')   return 3000;
  return Math.max(0, 100 - due);
}

// ─── TYPES ───────────────────────────────────────────────────
type StopState = 'pending' | 'current' | 'done' | 'skipped';
interface Stop {
  id: string; loc_id: string; state: StopState;
  arrived_at: string | null; done_at: string | null;
  checkin_id: string | null; visit_note: string | null;
}
interface Route { id: string; started_at: string; stops: Stop[]; }
interface HistEntry {
  id: string; started_at: string; ended_at: string;
  stops: (Stop & { loc_name: string })[];
}

// ─── TABS CONFIG ─────────────────────────────────────────────
const TABS = [
  { key: 'activa',    label: 'En curso' },
  { key: 'sugerida',  label: 'Sugerida' },
  { key: 'crear',     label: 'Crear ruta' },
  { key: 'semanas',   label: 'Por semana' },
  { key: 'historial', label: 'Historial' },
];

export function RutaView() {
  const { locations, role } = useAppStore() as any;
  const { can } = useAuth();
  const [tab, setTab] = useState<string>('activa');
  const [route, setRoute] = useState<Route | null>(null);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState('0m');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [summary, setSummary] = useState<HistEntry | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const r = localStorage.getItem('go_active_route_v1');
      const h = localStorage.getItem('go_route_history_v1');
      if (r) setRoute(JSON.parse(r));
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  // Timer
  useEffect(() => {
    if (!route) { if (timerRef.current) clearInterval(timerRef.current); return; }
    const tick = () => {
      const ms = Date.now() - new Date(route.started_at).getTime();
      setElapsed(fmtDurationShort(ms));
    };
    tick();
    timerRef.current = setInterval(tick, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [route?.started_at]);

  const saveRoute = useCallback((r: Route | null) => {
    setRoute(r);
    if (r) localStorage.setItem('go_active_route_v1', JSON.stringify(r));
    else localStorage.removeItem('go_active_route_v1');
  }, []);

  const saveHistory = useCallback((h: HistEntry[]) => {
    setHistory(h);
    localStorage.setItem('go_route_history_v1', JSON.stringify(h));
  }, []);

  const startRoute = useCallback((ids: string[]) => {
    if (route) return;
    const now = nowISO();
    const r: Route = {
      id: genId(), started_at: now,
      stops: ids.map((id, i) => ({
        id: genId(), loc_id: id,
        state: (i === 0 ? 'current' : 'pending') as StopState,
        arrived_at: i === 0 ? now : null,
        done_at: null, checkin_id: null, visit_note: null,
      })),
    };
    saveRoute(r);
    setTab('activa');
  }, [route, saveRoute]);

  const updateStop = useCallback((stopId: string, patch: Partial<Stop>) => {
    setRoute(prev => {
      if (!prev) return prev;
      const updated = { ...prev, stops: prev.stops.map(s => s.id === stopId ? { ...s, ...patch } : s) };
      localStorage.setItem('go_active_route_v1', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const advanceNext = useCallback((fromIdx: number, r: Route) => {
    const next = r.stops.findIndex((s, i) => i > fromIdx && s.state === 'pending');
    if (next >= 0) {
      r.stops[next].state = 'current';
      r.stops[next].arrived_at = nowISO();
    }
  }, []);

  const markDone = useCallback((stopId: string) => {
    if (!route) return;
    const idx = route.stops.findIndex(s => s.id === stopId);
    if (idx < 0) return;
    const updated = { ...route, stops: route.stops.map((s, i) => i === idx ? { ...s, state: 'done' as StopState, done_at: nowISO() } : s) };
    advanceNext(idx, updated);
    saveRoute(updated);
  }, [route, saveRoute, advanceNext]);

  const skipStop = useCallback((stopId: string) => {
    if (!route) return;
    const idx = route.stops.findIndex(s => s.id === stopId);
    if (idx < 0) return;
    const updated = { ...route, stops: route.stops.map((s, i) => i === idx ? { ...s, state: 'skipped' as StopState, done_at: nowISO() } : s) };
    advanceNext(idx, updated);
    saveRoute(updated);
  }, [route, saveRoute, advanceNext]);

  const cancelRoute = useCallback(() => {
    if (!confirm('¿Descartar la ruta? Se perderá el progreso.')) return;
    saveRoute(null);
  }, [saveRoute]);

  const finishRoute = useCallback(() => {
    if (!route) return;
    const pending = route.stops.filter(s => s.state === 'current' || s.state === 'pending');
    if (pending.length > 0 && !confirm(`Terminar con ${pending.length} parada(s) pendiente(s)? Se marcarán como omitidas.`)) return;
    const now = nowISO();
    const finalStops = route.stops.map(s =>
      (s.state === 'current' || s.state === 'pending')
        ? { ...s, state: 'skipped' as StopState, done_at: now }
        : s
    );
    const entry: HistEntry = {
      id: route.id, started_at: route.started_at, ended_at: now,
      stops: finalStops.map(s => ({
        ...s, loc_name: (locations as Location[]).find(l => l.id === s.loc_id)?.name ?? s.loc_id,
      })),
    };
    const newHist = [entry, ...history].slice(0, 50);
    saveHistory(newHist);
    saveRoute(null);
    setSummary(entry);
  }, [route, history, locations, saveRoute, saveHistory]);

  if (role === 'lector') {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3>Sección protegida</h3>
        <p>La planificación de rutas solo está disponible para administradores.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Ruta</h1>
          <p className="page-subtitle">Planea y ejecuta tus visitas de grabación</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap', borderBottom:'1px solid var(--color-divider)', paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.key}
            style={{ padding:'8px 16px', border:'none', background:'transparent', cursor:'pointer',
              fontWeight: tab === t.key ? 700 : 500, fontFamily:'inherit', fontSize:'var(--text-sm)',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              display:'flex', alignItems:'center', gap:6, transition:'all .15s',
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'activa' && route && (
              <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--color-success)',
                boxShadow:'0 0 0 3px oklch(from var(--color-success) l c h / .25)',
                animation:'pulseDot 2s ease-in-out infinite', flexShrink:0 }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'activa'   && <TabActiva route={route} elapsed={elapsed} onMarkDone={markDone} onSkip={skipStop} onCancel={cancelRoute} onFinish={finishRoute} onUpdateNote={(id: string, v: string) => updateStop(id, { visit_note: v })} onGoSugerida={() => setTab('sugerida')} onGoCrear={() => setTab('crear')} locations={locations} />}
      {tab === 'sugerida' && <TabSugerida locations={locations} onStart={(ids: string[]) => startRoute(ids)} onAddToCrear={(id: string) => setSelected((s: string[]) => s.includes(id) ? s : [...s, id])} hasActive={!!route} />}
      {tab === 'crear'    && <TabCrear locations={locations} selected={selected} setSelected={setSelected} onStart={() => startRoute(selected)} hasActive={!!route} />}
      {tab === 'semanas'  && <TabSemanas locations={locations} />}
      {tab === 'historial'&& <TabHistorial history={history} onClear={() => { if(confirm('¿Borrar todo el historial?')) saveHistory([]); }} />}

      {summary && <SummaryModal entry={summary} onClose={() => setSummary(null)} onGoHistorial={() => { setSummary(null); setTab('historial'); }} />}
    </div>
  );
}

// ─── TAB: ACTIVA ─────────────────────────────────────────────
function TabActiva({ route, elapsed, onMarkDone, onSkip, onCancel, onFinish, onUpdateNote, onGoSugerida, onGoCrear, locations }: any) {
  if (!route) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'60px 24px', background:'var(--color-surface)', border:'1px dashed var(--color-border)', borderRadius:'var(--radius-xl)', gap:12 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color:'var(--color-text-faint)' }}><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M14 18H8.5a3.5 3.5 0 0 1 0-7H19a3.5 3.5 0 0 0 0-7H10"/></svg>
        <h3 style={{ fontWeight:700, fontSize:'var(--text-lg)', margin:0 }}>Sin ruta en curso</h3>
        <p style={{ color:'var(--color-text-muted)', fontSize:'var(--text-sm)', maxWidth:'38ch', margin:0 }}>
          Inicia desde <strong>Sugerida</strong> para comenzar con las obras más urgentes, o crea tu propia ruta en <strong>Crear ruta</strong>.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onGoSugerida}>Ver sugerida</button>
          <button className="btn btn-primary btn-sm" onClick={onGoCrear}>Crear ruta</button>
        </div>
      </div>
    );
  }

  const done    = route.stops.filter((s: Stop) => s.state === 'done').length;
  const skipped = route.stops.filter((s: Stop) => s.state === 'skipped').length;
  const total   = route.stops.length;
  const pending = total - done - skipped;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Header */}
      <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:20, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'var(--color-primary)' }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', color:'var(--color-primary)', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-primary)', display:'inline-block' }} />
            EN CURSO
          </div>
          <div style={{ fontSize:'var(--text-lg)', fontWeight:700 }}>
            Ruta del {new Date(route.started_at).toLocaleDateString('es-MX', { day:'2-digit', month:'long' })}
          </div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginTop:2 }}>
            Iniciada a las {fmtTime(route.started_at)} · {total} parada{total !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display:'flex', gap:20, flexShrink:0, flexWrap:'wrap' }}>
          {[
            { label:'Progreso', val:`${done}/${total}` },
            { label:'Tiempo',   val:elapsed },
            { label:'Pendientes', val:String(pending) },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', flexDirection:'column' }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--color-text-muted)' }}>{s.label}</span>
              <span style={{ fontSize:'var(--text-base)', fontWeight:700, fontFamily:'var(--font-mono)', marginTop:2 }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:6, background:'var(--color-surface-offset)', borderRadius:99, overflow:'hidden', border:'1px solid var(--color-divider)' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,var(--color-primary),var(--color-success))', borderRadius:99, transition:'width .4s' }} />
      </div>

      {/* Timeline */}
      <div style={{ position:'relative', padding:'8px 0' }}>
        <div style={{ position:'absolute', left:23, top:32, bottom:32, width:2, background:'var(--color-divider)', borderRadius:1 }} />
        {route.stops.map((stop: Stop, i: number) => {
          const loc = (locations as Location[]).find(l => l.id === stop.loc_id) ?? { name: stop.loc_id, freq_days: 15 } as Location;
          return <StopCard key={stop.id} stop={stop} idx={i} loc={loc} isLast={i === route.stops.length - 1}
            nextStop={i < route.stops.length - 1 ? route.stops[i + 1] : null}
            onMarkDone={onMarkDone} onSkip={onSkip} onUpdateNote={onUpdateNote} />;
        })}
      </div>

      {/* Global actions */}
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', paddingTop:8 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Descartar</button>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const lines = route.stops.map((s: Stop, i: number) => {
              const n = (locations as Location[]).find(l => l.id === s.loc_id)?.name ?? s.loc_id;
              const m = s.state === 'done' ? '✓' : s.state === 'skipped' ? '✗' : s.state === 'current' ? '→' : '·';
              return `${m} ${i+1}. ${n}`;
            });
            const txt = `Ruta del día — ${fmtTime(route.started_at)}\n\n${lines.join('\n')}`;
            navigator.share ? navigator.share({ title:'Mi ruta', text:txt }) : navigator.clipboard.writeText(txt);
          }}>Compartir</button>
          <button className="btn btn-primary btn-sm" onClick={onFinish}>Terminar ruta</button>
        </div>
      </div>
    </div>
  );
}

function StopCard({ stop, idx, loc, isLast, nextStop, onMarkDone, onSkip, onUpdateNote }: any) {
  const st  = locStatus(loc);
  const due = daysUntilDue(loc);
  const stateColors: Record<string, string> = {
    done:    'var(--color-success)',
    current: 'var(--color-primary)',
    skipped: 'var(--color-text-faint)',
    pending: 'var(--color-text-muted)',
  };
  const color = stateColors[stop.state];

  const nodeStyle: React.CSSProperties = {
    width:48, height:48, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:800, fontSize:'var(--text-base)', fontFamily:'var(--font-mono)',
    flexShrink:0, position:'relative', zIndex:2,
    background: stop.state === 'done' ? 'var(--color-success)' : stop.state === 'current' ? 'var(--color-primary)' : 'var(--color-surface)',
    color: (stop.state === 'done' || stop.state === 'current') ? '#fff' : 'var(--color-text-muted)',
    boxShadow: stop.state === 'current' ? `0 0 0 2px var(--color-primary), 0 0 0 7px oklch(from var(--color-primary) l c h / .18)` : `0 0 0 2px ${stop.state === 'done' ? 'var(--color-success)' : 'var(--color-border)'}`,
    border: '3px solid var(--color-bg)',
  };

  const cardStyle: React.CSSProperties = {
    flex:1, minWidth:0,
    background: (stop.state === 'done' || stop.state === 'skipped') ? 'var(--color-surface-offset)' : 'var(--color-surface)',
    border:`1px solid ${stop.state === 'current' ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius:'var(--radius-lg)', padding:16, display:'flex', flexDirection:'column', gap:8,
    boxShadow: stop.state === 'current' ? '0 0 0 1px var(--color-primary), var(--shadow-md)' : 'none',
    opacity: stop.state === 'skipped' ? .55 : stop.state === 'done' ? .85 : 1,
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'stretch', gap:16, position:'relative', padding:'12px 0', zIndex:1 }}>
        <div style={nodeStyle}>
          {stop.state === 'done'
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
            : <span>{idx + 1}</span>
          }
        </div>
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:'var(--text-base)', textDecoration: stop.state === 'done' ? 'line-through' : 'none', color: stop.state === 'done' ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{loc.name}</div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginTop:2 }}>
                {loc.address && <span>📍 {loc.address}</span>}
                <span>⏱ Cada {loc.freq_days}d</span>
                {loc.last_checkin && <span>Últ: {fmtDate(loc.last_checkin)}</span>}
                {loc.lat && loc.lng && (
                  <a href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer" style={{ color:'var(--color-primary)', fontWeight:600 }}>↗ Navegar</a>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
              {st === 'overdue' && <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background:'var(--color-error-highlight)', color:'var(--color-error)' }}>Vencida {Math.abs(due!)}d</span>}
              <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700,
                background: `color-mix(in srgb,${color} 15%,transparent)`, color }}>
                {stop.state === 'done' ? 'Completada' : stop.state === 'current' ? 'En curso' : stop.state === 'skipped' ? 'Omitida' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Tiempos */}
          {(stop.arrived_at || stop.done_at) && (
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', borderTop:'1px dashed var(--color-divider)', paddingTop:8, fontSize:11, color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>
              {stop.arrived_at && <span>▶ Llegada {fmtTime(stop.arrived_at)}</span>}
              {stop.done_at && <span>✓ {stop.state === 'skipped' ? 'Omitida' : 'Hecho'} {fmtTime(stop.done_at)}</span>}
              {stop.arrived_at && stop.done_at && <span>⏱ {fmtDurationShort(new Date(stop.done_at).getTime() - new Date(stop.arrived_at).getTime())}</span>}
            </div>
          )}

          {/* Nota */}
          {(stop.state === 'current' || stop.visit_note) && (
            <NoteField stopId={stop.id} value={stop.visit_note ?? ''} onSave={(v) => onUpdateNote(stop.id, v)} />
          )}

          {/* Acciones */}
          {stop.state === 'current' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
              <button className="btn btn-primary btn-sm" onClick={() => onMarkDone(stop.id)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
                Hecho
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onSkip(stop.id)}>Omitir</button>
            </div>
          )}
          {stop.state === 'pending' && (
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onSkip(stop.id)}>Omitir</button>
            </div>
          )}
        </div>
      </div>

      {/* Leg */}
      {!isLast && (
        <div style={{ padding:'2px 0 2px 60px', fontSize:10, color:'var(--color-text-faint)', fontFamily:'var(--font-mono)' }}>
          {stop.done_at && nextStop?.arrived_at
            ? `↓ ${fmtDurationShort(new Date(nextStop.arrived_at).getTime() - new Date(stop.done_at).getTime())} de traslado`
            : '↓'}
        </div>
      )}
    </>
  );
}

function NoteField({ stopId, value, onSave }: { stopId: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = (val: string) => {
    setV(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(val), 800);
  };
  return (
    <textarea
      value={v}
      onChange={e => handleChange(e.target.value)}
      placeholder="Nota rápida sobre esta visita…"
      style={{ resize:'vertical', minHeight:60, width:'100%', background:'var(--color-surface-offset)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'8px 12px', color:'var(--color-text)', fontSize:'var(--text-xs)', fontFamily:'inherit' }}
    />
  );
}

// ─── TAB: SUGERIDA ───────────────────────────────────────────
function TabSugerida({ locations, onStart, onAddToCrear, hasActive }: any) {
  const [sel, setSel] = useState<string[]>([]);
  const suggested = [...(locations as Location[])].sort((a, b) => buildScore(b) - buildScore(a));

  const toggle = (id: string) =>
    setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const selectGroup = (ids: string[]) =>
    setSel(s => {
      const allIn = ids.every(id => s.includes(id));
      return allIn ? s.filter(x => !ids.includes(x)) : [...new Set([...s, ...ids])];
    });

  const groups = [
    { key:'overdue', label:'Vencidas',       color:'var(--color-error)',   items: suggested.filter((l: Location) => locStatus(l) === 'overdue') },
    { key:'soon',    label:'Por vencer',      color:'var(--color-gold)',    items: suggested.filter((l: Location) => locStatus(l) === 'soon') },
    { key:'never',   label:'Sin grabar',      color:'var(--color-text-faint)', items: suggested.filter((l: Location) => locStatus(l) === 'never') },
    { key:'ok',      label:'Al corriente',    color:'var(--color-success)', items: suggested.filter((l: Location) => locStatus(l) === 'ok') },
  ].filter(g => g.items.length > 0);

  const handleStart = () => {
    const ids = sel.length > 0 ? sel : suggested.slice(0, 5).map((l: Location) => l.id);
    onStart(ids);
    setSel([]);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header con acciones */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
        background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)',
        padding:'14px 18px', boxShadow:'var(--shadow-sm)' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:'var(--text-xs)', fontWeight:700,
            color:'var(--color-primary)', background:'var(--color-primary-highlight)', padding:'2px 10px', borderRadius:99, marginBottom:4 }}>
            ⚡ Generada automáticamente
          </div>
          <p style={{ fontSize:'var(--text-sm)', color:'var(--color-text-muted)', margin:0 }}>
            {sel.length > 0
              ? <><strong style={{ color:'var(--color-text)' }}>{sel.length} seleccionada{sel.length > 1 ? 's' : ''}</strong> · haz clic en obras para seleccionar o deseleccionar</>
              : 'Selecciona obras o inicia directamente con el top 5 más urgente.'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {sel.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSel([])}>Limpiar</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const ids = (sel.length > 0 ? sel : suggested.slice(0,10).map((l: Location) => l.id));
            const text = ids.map((id: string, i: number) => `${i+1}. ${(locations as Location[]).find((l: Location) => l.id === id)?.name}`).join('\n');
            navigator.share ? navigator.share({ title:'Mi ruta', text }) : navigator.clipboard.writeText(text);
          }}>Exportar</button>
          <button className="btn btn-primary btn-sm" disabled={hasActive} onClick={handleStart}>
            {sel.length > 0 ? `Iniciar ${sel.length} seleccionadas` : 'Iniciar top 5'}
          </button>
        </div>
      </div>

      {/* Grupos por urgencia */}
      {groups.map(group => (
        <div key={group.key}>
          {/* Header del grupo */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:group.color, flexShrink:0 }} />
            <span style={{ fontSize:'var(--text-xs)', fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:group.color }}>
              {group.label}
            </span>
            <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-faint)', fontFamily:'var(--font-mono)' }}>
              {group.items.length}
            </span>
            <div style={{ flex:1, height:1, background:'var(--color-divider)' }} />
            <button
              style={{ fontSize:10, fontWeight:700, color:group.color, background:`color-mix(in srgb,${group.color} 10%,transparent)`,
                border:`1px solid color-mix(in srgb,${group.color} 25%,transparent)`, borderRadius:99,
                padding:'2px 10px', cursor:'pointer', fontFamily:'inherit' }}
              onClick={() => selectGroup(group.items.map((l: Location) => l.id))}
            >
              {group.items.every((l: Location) => sel.includes(l.id)) ? 'Deseleccionar grupo' : 'Seleccionar grupo'}
            </button>
          </div>

          {/* Items del grupo */}
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {group.items.map((loc: Location, i: number) => {
              const due      = daysUntilDue(loc);
              const st       = locStatus(loc);
              const isSelected = sel.includes(loc.id);
              const globalIdx  = suggested.indexOf(loc);
              const urgText  = st === 'overdue' ? `Vencida hace ${Math.abs(due!)}d`
                             : st === 'soon'    ? `Vence en ${due}d`
                             : st === 'never'   ? 'Primera visita'
                             : `${due}d restantes`;
              return (
                <div key={loc.id}
                  onClick={() => toggle(loc.id)}
                  style={{ display:'flex', alignItems:'center', gap:12,
                    background: isSelected ? `color-mix(in srgb,${group.color} 8%,var(--color-surface))` : 'var(--color-surface)',
                    border: `1px solid ${isSelected ? group.color : 'var(--color-border)'}`,
                    borderRadius:'var(--radius-lg)', padding:'10px 14px',
                    cursor:'pointer', transition:'all .15s',
                    boxShadow: isSelected ? `0 0 0 1px ${group.color}33` : 'var(--shadow-sm)' }}>
                  {/* Checkbox */}
                  <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${isSelected ? group.color : 'var(--color-border)'}`,
                    background: isSelected ? group.color : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  {/* Rank */}
                  <span style={{ fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--color-text-faint)', minWidth:16 }}>
                    #{globalIdx + 1}
                  </span>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'var(--text-sm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {loc.name}
                    </div>
                    <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginTop:1 }}>
                      <span style={{ color:group.color, fontWeight:600 }}>{urgText}</span>
                      {' · '}Cada {loc.freq_days}d
                      {loc.last_checkin ? ` · Últ. ${fmtDate(loc.last_checkin)}` : ''}
                      {loc.responsable ? ` · ${loc.responsable}` : ''}
                    </div>
                  </div>
                  {/* Acción rápida Maps */}
                  {loc.lat && loc.lng && (
                    <a href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color:'var(--color-text-faint)', flexShrink:0, display:'flex', alignItems:'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {suggested.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="20 6 9 17 4 12"/></svg>
          <h3>Todo al día</h3>
          <p>No hay obras urgentes en este momento.</p>
        </div>
      )}
    </div>
  );
}

// ─── TAB: CREAR ──────────────────────────────────────────────
function TabCrear({ locations, selected, setSelected, onStart, hasActive }: any) {
  const [search, setSearch] = useState('');
  const sorted = [...(locations as Location[])]
    .filter((l: Location) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.address ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a: Location, b: Location) => {
      const o: Record<string, number> = { overdue:0, soon:1, never:2, ok:3 };
      return (o[locStatus(a)] ?? 9) - (o[locStatus(b)] ?? 9) || a.name.localeCompare(b.name);
    });

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      {/* Pool */}
      <div>
        <div style={{ marginBottom:10 }}>
          <input type="search" className="search-input" style={{ width:'100%' }} placeholder="Buscar locación…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:480, overflowY:'auto' }}>
          {sorted.map((loc: Location) => {
            const st = locStatus(loc);
            const due = daysUntilDue(loc);
            const inRuta = selected.includes(loc.id);
            const colors: Record<string, string> = { overdue:'var(--color-error)', soon:'var(--color-gold)', never:'var(--color-text-faint)', ok:'var(--color-success)' };
            const txts: Record<string, string> = { overdue:`Vencida ${Math.abs(due!)}d`, soon:`${due}d p/vencer`, never:'Primera visita', ok:`${due}d rest.` };
            return (
              <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:'var(--radius-md)', cursor: inRuta ? 'default' : 'pointer', opacity: inRuta ? .4 : 1, background:'var(--color-surface)', border:'1px solid var(--color-border)', marginBottom:2 }}
                onClick={() => !inRuta && setSelected((s: string[]) => [...s, loc.id])}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:500, fontSize:'var(--text-sm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-faint)' }}>
                    <span style={{ color:colors[st] }}>{txts[st]}</span>{loc.address ? ' · ' + loc.address : ''}
                  </div>
                </div>
                {inRuta
                  ? <span style={{ fontSize:'var(--text-xs)', color:'var(--color-success)' }}>✓</span>
                  : <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11 }}>+ Agregar</button>
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Order */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <h3 style={{ margin:0, fontSize:'var(--text-base)', fontWeight:700 }}>Ruta del día <span style={{ fontFamily:'var(--font-mono)', color:'var(--color-text-muted)', fontSize:'var(--text-sm)' }}>({selected.length})</span></h3>
          <div style={{ display:'flex', gap:6 }}>
            {selected.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Limpiar</button>}
            <button className="btn btn-primary btn-sm" disabled={selected.length === 0 || hasActive} onClick={onStart}>Iniciar ruta</button>
          </div>
        </div>
        {selected.length === 0
          ? <div style={{ textAlign:'center', padding:'40px 20px', background:'var(--color-surface)', borderRadius:'var(--radius-lg)', border:'1px dashed var(--color-border)', color:'var(--color-text-muted)', fontSize:'var(--text-sm)' }}>Agrega locaciones desde la lista</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {selected.map((id: string, i: number) => {
                const loc = (locations as Location[]).find((l: Location) => l.id === id);
                return (
                  <div key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)' }}>
                    <span style={{ width:24, height:24, borderRadius:'50%', background:'var(--color-primary-highlight)', color:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, fontFamily:'var(--font-mono)', flexShrink:0 }}>{i+1}</span>
                    <span style={{ flex:1, fontSize:'var(--text-sm)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc?.name ?? id}</span>
                    <button className="icon-btn" onClick={() => setSelected((s: string[]) => s.filter((x: string) => x !== id))}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

// ─── TAB: SEMANAS ────────────────────────────────────────────
function TabSemanas({ locations }: any) {
  const [search, setSearch] = useState('');
  const locs = (locations as Location[]).filter((l: Location) => !search || l.name.toLowerCase().includes(search.toLowerCase()));
  const groups: Record<string, (Location & { planDate: string })[]> = {};
  locs.forEach((loc: Location) => {
    const planDate = getPlannedDate(loc);
    const week = startOfWeek(planDate).toISOString().slice(0, 10);
    if (!groups[week]) groups[week] = [];
    groups[week].push({ ...loc, planDate });
  });
  const weeks = Object.keys(groups).sort();
  const curWeek = startOfWeek(today()).toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <input type="search" className="search-input" placeholder="Buscar locación…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>Semanas: {weeks.length}</span>
      </div>
      <div style={{ position:'relative', paddingLeft:36 }}>
        <div style={{ position:'absolute', left:5, top:18, bottom:18, width:2, background:'var(--color-divider)', borderRadius:1 }} />
        {weeks.map(week => {
          const items = groups[week].sort((a, b) => a.planDate.localeCompare(b.planDate));
          const due = daysUntilDue(items[0]);
          const isCurrent = week === curWeek;
          const dotColor = isCurrent ? 'var(--color-primary)' : due !== null && due < 0 ? 'var(--color-error)' : due !== null && due <= 3 ? 'var(--color-gold)' : 'var(--color-success)';
          return (
            <div key={week} style={{ position:'relative', marginBottom:16 }}>
              <div style={{ position:'absolute', left:-31, top:18, width:12, height:12, borderRadius:'50%', background:dotColor, border:'2px solid var(--color-bg)', boxShadow:`0 0 0 3px var(--color-surface)${isCurrent ? `, 0 0 0 4px oklch(from var(--color-primary) l c h / .24)` : ''}` }} />
              <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:20, boxShadow:'var(--shadow-sm)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:12, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--color-primary)' }}>{isCurrent ? 'Esta semana' : formatWeekLabel(new Date(week + 'T00:00:00')).toUpperCase()}</div>
                    <div style={{ fontSize:'var(--text-lg)', fontWeight:700, marginTop:2 }}>{items.length === 1 ? items[0].name : `${items.length} locaciones`}</div>
                  </div>
                  <div style={{ fontSize:'var(--text-sm)', color: due !== null && due < 0 ? 'var(--color-error)' : due !== null && due <= 3 ? 'var(--color-gold)' : 'var(--color-success)' }}>
                    {isCurrent ? 'Esta semana' : due !== null && due < 0 ? `Venció hace ${Math.abs(due)}d` : due !== null && due <= 3 ? `Vence en ${due}d` : `Próximo: ${fmtDate(items[0].planDate)}`}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {items.map(loc => {
                    const st = locStatus(loc);
                    const stTxt = { never:'Primera visita', overdue:'Vencida', soon:'Por vencer', ok:'Al corriente' }[st];
                    return (
                      <div key={loc.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'8px 0', borderTop:'1px solid var(--color-divider)', flexWrap:'wrap' }}>
                        <div>
                          <div style={{ fontWeight:500, fontSize:'var(--text-sm)' }}>{loc.name}</div>
                          <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginTop:2 }}>{loc.address ? loc.address + ' · ' : ''}{stTxt} · {fmtDate(loc.planDate)}</div>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-ghost btn-sm">+ Ruta</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {weeks.length === 0 && <div style={{ textAlign:'center', padding:40, color:'var(--color-text-faint)', fontSize:'var(--text-sm)' }}>Sin resultados</div>}
      </div>
    </div>
  );
}

// ─── TAB: HISTORIAL ──────────────────────────────────────────
function TabHistorial({ history, onClear }: any) {
  if (!history.length) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 14"/></svg>
        <h3>Sin rutas completadas</h3>
        <p>Cuando termines una ruta aparecerá aquí con todos sus tiempos.</p>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <p style={{ margin:0, fontSize:'var(--text-sm)', color:'var(--color-text-muted)' }}>Rutas completadas anteriormente.</p>
        <button className="btn btn-ghost btn-sm" onClick={onClear}>Limpiar</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {(history as HistEntry[]).map(r => {
          const totalMs = new Date(r.ended_at).getTime() - new Date(r.started_at).getTime();
          const done    = r.stops.filter(s => s.state === 'done').length;
          const skipped = r.stops.filter(s => s.state === 'skipped').length;
          const dateLabel = new Date(r.started_at).toLocaleDateString('es-MX', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
          return (
            <div key={r.id} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'16px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:'var(--text-base)' }}>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                    {fmtTime(r.started_at)} → {fmtTime(r.ended_at)} · {fmtDurationShort(totalMs)}
                  </div>
                </div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  {[
                    { label:'Paradas', val:`${done}/${r.stops.length}` },
                    { label:'Check-ins', val:String(r.stops.filter(s => s.checkin_id).length) },
                    { label:'Omitidas', val:String(skipped) },
                  ].map(s => (
                    <div key={s.label} style={{ display:'flex', flexDirection:'column' }}>
                      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--color-text-muted)' }}>{s.label}</span>
                      <span style={{ fontWeight:700, fontFamily:'var(--font-mono)', fontSize:'var(--text-sm)' }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop:'1px dashed var(--color-divider)', paddingTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                {r.stops.map((s, i) => (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:'var(--text-xs)' }}>
                    <span style={{ width:22, height:22, borderRadius:'50%', background: s.state === 'done' ? 'var(--color-success-highlight)' : 'var(--color-surface-dynamic)', color: s.state === 'done' ? 'var(--color-success)' : 'var(--color-text-faint)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', flexShrink:0 }}>{i+1}</span>
                    <span style={{ flex:1, fontWeight:500, textDecoration: s.state === 'skipped' ? 'line-through' : 'none', color: s.state === 'skipped' ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{s.loc_name}</span>
                    {s.arrived_at && s.done_at && <span style={{ color:'var(--color-text-faint)', fontFamily:'var(--font-mono)', fontSize:10 }}>{fmtDurationShort(new Date(s.done_at).getTime() - new Date(s.arrived_at).getTime())}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SUMMARY MODAL ───────────────────────────────────────────
function SummaryModal({ entry, onClose, onGoHistorial }: { entry: HistEntry; onClose: () => void; onGoHistorial: () => void }) {
  const totalMs = new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
  const done    = entry.stops.filter(s => s.state === 'done').length;
  const skipped = entry.stops.filter(s => s.state === 'skipped').length;
  const total   = entry.stops.length;
  const doneStops = entry.stops.filter(s => s.state === 'done' && s.arrived_at && s.done_at);
  const avgMs = doneStops.length > 0 ? doneStops.reduce((sum, s) => sum + new Date(s.done_at!).getTime() - new Date(s.arrived_at!).getTime(), 0) / doneStops.length : null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Resumen de ruta</h2>
          <button className="icon-btn" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="modal-body">
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:16, background:'var(--color-success-highlight)', color:'var(--color-success)', borderRadius:'var(--radius-lg)' }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--color-success)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontWeight:700 }}>¡Buen trabajo!</div>
              <div style={{ fontSize:'var(--text-xs)' }}>{done} de {total} parada{total !== 1 ? 's' : ''} completada{done !== 1 ? 's' : ''}{skipped > 0 ? ` · ${skipped} omitida${skipped !== 1 ? 's' : ''}` : ''}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:12 }}>
            {[
              { label:'Duración', val:fmtDurationShort(totalMs), sub:`${fmtTime(entry.started_at)} → ${fmtTime(entry.ended_at)}` },
              { label:'Promedio', val:avgMs != null ? fmtDurationShort(avgMs) : '—', sub:'por parada' },
              { label:'Check-ins', val:String(entry.stops.filter(s => s.checkin_id).length), sub:'registrados' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--color-surface-offset)', borderRadius:'var(--radius-lg)', padding:12 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--color-text-muted)' }}>{s.label}</div>
                <div style={{ fontSize:'1.4rem', fontWeight:700, fontFamily:'var(--font-mono)', lineHeight:1.2, margin:'4px 0 2px' }}>{s.val}</div>
                <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontWeight:700, fontSize:'var(--text-sm)', marginBottom:4 }}>Paradas</div>
            {entry.stops.map((s, i) => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:'var(--text-xs)' }}>
                <span style={{ width:22, height:22, borderRadius:'50%', background: s.state === 'done' ? 'var(--color-success-highlight)' : 'var(--color-surface-dynamic)', color: s.state === 'done' ? 'var(--color-success)' : 'var(--color-text-faint)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', flexShrink:0 }}>{i+1}</span>
                <span style={{ flex:1, fontWeight:500 }}>{s.loc_name}</span>
                {s.arrived_at && s.done_at && <span style={{ color:'var(--color-text-faint)', fontFamily:'var(--font-mono)' }}>{fmtDurationShort(new Date(s.done_at).getTime() - new Date(s.arrived_at).getTime())}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onGoHistorial}>Ver historial</button>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
