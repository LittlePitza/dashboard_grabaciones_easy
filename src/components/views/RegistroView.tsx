'use client';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { fmtDate, toCSV, downloadCSV, today } from '@/lib/utils';
import { CheckinModal } from '@/components/modals/CheckinModal';
import type { Location, Checkin, EstadoHistoryEntry } from '@/types';

const ESTADO_COLOR: Record<string, string> = {
  grabado:    'var(--color-primary)',
  en_edicion: 'var(--color-gold)',
  editado:    'var(--color-orange)',
  publicado:  'var(--color-success)',
};

const ESTADO_LABEL: Record<string, string> = {
  grabado: 'Grabado', en_edicion: 'En edición', editado: 'Editado', publicado: 'Publicado',
};

function fmtTimestamp(iso: string): { fecha: string; hora: string; esHoy: boolean; esAyer: boolean } {
  const d    = new Date(iso);
  const now  = new Date();
  const esHoy  = d.toDateString() === now.toDateString();
  const ayer   = new Date(now); ayer.setDate(ayer.getDate() - 1);
  const esAyer = d.toDateString() === ayer.toDateString();
  const hora   = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  const fecha  = esHoy ? 'Hoy' : esAyer ? 'Ayer' : fmtDate(iso.slice(0, 10));
  return { fecha, hora, esHoy, esAyer };
}

// ─── Genera entradas de log desde todos los checkins ─────────
interface LogEntry {
  id: string;            // único para React key
  checkin_id: string;
  location_id: string;
  estado: string;
  estado_anterior: string | null;
  timestamp: string;
  es_creacion: boolean;  // true si es el estado inicial del check-in
}

function buildLog(checkins: Checkin[]): LogEntry[] {
  const entries: LogEntry[] = [];
  checkins.forEach(ci => {
    // Si tiene historial de cambios, usar eso
    if (ci.estado_history && ci.estado_history.length > 0) {
      ci.estado_history.forEach((h, i) => {
        entries.push({
          id: `${ci.id}-h${i}`,
          checkin_id: ci.id,
          location_id: ci.location_id,
          estado: h.estado,
          estado_anterior: h.estado_anterior ?? null,
          timestamp: h.timestamp,
          es_creacion: false,
        });
      });
    }
    // Siempre incluir la creación del check-in
    if (ci.created_at) {
      entries.push({
        id: `${ci.id}-create`,
        checkin_id: ci.id,
        location_id: ci.location_id,
        estado: ci.estado_history?.length ? (ci.estado_history[0].estado_anterior ?? ci.estado_history[0].estado) : ci.estado,
        estado_anterior: null,
        timestamp: ci.created_at,
        es_creacion: true,
      });
    }
  });
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function RegistroView() {
  const { locations, checkins, currentRegFilter, setRegFilter } = useAppStore() as any;
  const { can } = useAuth();
  const { deleteCheckin } = useData();
  const [search, setSearch]   = useState('');
  const [vista, setVista]     = useState<'actividad' | 'checkins'>('actividad');
  const [logFilter, setLogFilter] = useState<'todo' | 'hoy' | 'semana'>('hoy');
  const [showCheckinModal, setShowCheckinModal] = useState(false);

  const getLocName = (id: string) => (locations as Location[]).find(l => l.id === id)?.name ?? id;

  // ── Log de actividad ──────────────────────────────────────
  const log = useMemo(() => {
    let entries = buildLog(checkins as Checkin[]);
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e => getLocName(e.location_id).toLowerCase().includes(q));
    }
    if (logFilter === 'hoy') {
      const hoy = new Date().toDateString();
      entries = entries.filter(e => new Date(e.timestamp).toDateString() === hoy);
    } else if (logFilter === 'semana') {
      const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
      entries = entries.filter(e => new Date(e.timestamp) >= hace7);
    }
    return entries;
  }, [checkins, search, logFilter, locations]);

  // ── Check-ins clásicos ────────────────────────────────────
  const filtered = useMemo(() => {
    let list = checkins as Checkin[];
    if (currentRegFilter !== 'todos') list = list.filter(c => c.estado === currentRegFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        getLocName(c.location_id).toLowerCase().includes(q) ||
        (c.notes ?? '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [checkins, currentRegFilter, search, locations]);

  const exportarLog = () => {
    const rows = [
      ['Locación','Fecha','Hora','Estado','Estado anterior','Tipo'],
      ...log.map(e => {
        const { fecha, hora } = fmtTimestamp(e.timestamp);
        return [getLocName(e.location_id), fecha, hora, ESTADO_LABEL[e.estado] ?? e.estado, e.estado_anterior ? ESTADO_LABEL[e.estado_anterior] ?? e.estado_anterior : '—', e.es_creacion ? 'Check-in creado' : 'Cambio de estado'];
      }),
    ];
    downloadCSV(toCSV(rows), `actividad-${today()}.csv`);
  };

  const exportarCheckins = () => {
    const rows = [['Locación','Fecha','Estado','Foto URL','Notas','Link'],
      ...filtered.map(c => [getLocName(c.location_id), c.date, c.estado, c.foto_url??'', c.notes??'', c.link??''])];
    downloadCSV(toCSV(rows), `registro-${today()}.csv`);
  };

  // Agrupar log por fecha para mostrar separadores
  const logByDate = useMemo(() => {
    const groups: { label: string; entries: LogEntry[] }[] = [];
    let currentLabel = '';
    log.forEach(e => {
      const { fecha } = fmtTimestamp(e.timestamp);
      if (fecha !== currentLabel) {
        currentLabel = fecha;
        groups.push({ label: fecha, entries: [] });
      }
      groups[groups.length - 1].entries.push(e);
    });
    return groups;
  }, [log]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Registro</h1>
        <div className="page-actions">
          {can('checkin') && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCheckinModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
              Nuevo check-in
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={vista === 'actividad' ? exportarLog : exportarCheckins}>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Toggle de vista */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid var(--color-divider)' }}>
        {([
          { key:'actividad', label:'Actividad', sub:'Log con timestamps' },
          { key:'checkins',  label:'Check-ins', sub:'Vista clásica' },
        ] as const).map(v => (
          <button key={v.key}
            style={{ padding:'8px 20px', border:'none', background:'transparent', cursor:'pointer',
              fontWeight: vista===v.key ? 700 : 500, fontFamily:'inherit', fontSize:'var(--text-sm)',
              color: vista===v.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: vista===v.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              transition:'all .15s', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2,
            }}
            onClick={() => setVista(v.key)}
          >
            {v.label}
            <span style={{ fontSize:10, fontWeight:400, color:'var(--color-text-faint)' }}>{v.sub}</span>
          </button>
        ))}
      </div>

      {/* ── VISTA: ACTIVIDAD ── */}
      {vista === 'actividad' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input type="search" className="search-input" placeholder="Buscar locación…" value={search} onChange={e => setSearch(e.target.value)} />
            {([
              { f:'hoy',    l:'Hoy' },
              { f:'semana', l:'Esta semana' },
              { f:'todo',   l:'Todo' },
            ] as const).map(fb => (
              <button key={fb.f} className={`filter-btn${logFilter===fb.f?' active':''}`} onClick={() => setLogFilter(fb.f)}>
                {fb.l}
              </button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>
              {log.length} {log.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </div>

          {log.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <h3>Sin actividad</h3>
              <p>
                {logFilter === 'hoy'
                  ? 'No hay cambios de estado registrados hoy. Los cambios aparecerán aquí con su hora exacta.'
                  : 'Sin entradas con ese filtro.'}
              </p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {logByDate.map(group => (
                <div key={group.label}>
                  {/* Separador de fecha */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0 8px', position:'sticky', top:0, background:'var(--color-bg)', zIndex:10, padding:'4px 0' }}>
                    <span style={{ fontWeight:700, fontSize:'var(--text-sm)', color:'var(--color-text)' }}>{group.label}</span>
                    <div style={{ flex:1, height:1, background:'var(--color-divider)' }} />
                    <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-faint)', fontFamily:'var(--font-mono)' }}>{group.entries.length}</span>
                  </div>

                  {/* Entradas del grupo */}
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {group.entries.map(e => {
                      const { hora }    = fmtTimestamp(e.timestamp);
                      const color       = ESTADO_COLOR[e.estado] ?? 'var(--color-text-muted)';
                      const locName     = getLocName(e.location_id);
                      return (
                        <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--color-surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--color-border)', marginBottom:2 }}>
                          {/* Hora */}
                          <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--color-text-muted)', minWidth:40, flexShrink:0 }}>{hora}</span>

                          {/* Dot de estado */}
                          <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />

                          {/* Descripción */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:'var(--text-sm)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {locName}
                            </div>
                            <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginTop:1 }}>
                              {e.es_creacion
                                ? <>Check-in creado · <span style={{ color }}>estado inicial: {ESTADO_LABEL[e.estado] ?? e.estado}</span></>
                                : e.estado_anterior
                                  ? <><span style={{ color:ESTADO_COLOR[e.estado_anterior] ?? 'var(--color-text-muted)' }}>{ESTADO_LABEL[e.estado_anterior] ?? e.estado_anterior}</span>{' → '}<span style={{ color, fontWeight:700 }}>{ESTADO_LABEL[e.estado] ?? e.estado}</span></>
                                  : <span style={{ color, fontWeight:700 }}>{ESTADO_LABEL[e.estado] ?? e.estado}</span>
                              }
                            </div>
                          </div>

                          {/* Badge de estado */}
                          <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background:`color-mix(in srgb,${color} 15%,transparent)`, color, flexShrink:0 }}>
                            {ESTADO_LABEL[e.estado] ?? e.estado}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA: CHECK-INS CLÁSICA ── */}
      {vista === 'checkins' && (
        <div>
          <div className="filters">
            <input type="search" className="search-input" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
            {[{f:'todos',l:'Todos'},{f:'grabado',l:'Grabado'},{f:'en_edicion',l:'En edición'},{f:'publicado',l:'Publicado'}].map(fb => (
              <button key={fb.f} className={`filter-btn${currentRegFilter===fb.f?' active':''}`} onClick={() => setRegFilter(fb.f)}>{fb.l}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <h3>Sin registros</h3><p>No hay check-ins con ese filtro.</p>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--color-border)' }}>
                    {['Locación','Fecha','Estado','Notas','Foto','Link', can('delete_loc') ? 'Acciones' : ''].filter(Boolean).map((h, i) => (
                      <th key={i} style={{ textAlign:'left', padding:'8px 12px', fontWeight:700, fontSize:'var(--text-xs)', color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ci: Checkin) => (
                    <tr key={ci.id} style={{ borderBottom:'1px solid var(--color-divider)' }}>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>
                        <div>{getLocName(ci.location_id)}</div>
                        {/* Mini-timeline de historial si existe */}
                        {ci.estado_history && ci.estado_history.length > 1 && (
                          <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                            {ci.estado_history.map((h, i) => (
                              <span key={i} style={{ fontSize:9, fontFamily:'var(--font-mono)', color:ESTADO_COLOR[h.estado] ?? 'var(--color-text-faint)', background:`color-mix(in srgb,${ESTADO_COLOR[h.estado]??'gray'} 10%,transparent)`, padding:'1px 6px', borderRadius:99 }}>
                                {new Date(h.timestamp).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false})} {ESTADO_LABEL[h.estado] ?? h.estado}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px', fontFamily:'var(--font-mono)', color:'var(--color-text-muted)' }}>{fmtDate(ci.date)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background:`color-mix(in srgb,${ESTADO_COLOR[ci.estado]??'gray'} 15%,transparent)`, color:ESTADO_COLOR[ci.estado]??'var(--color-text-muted)' }}>
                          {ESTADO_LABEL[ci.estado] ?? ci.estado}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', color:'var(--color-text-muted)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ci.notes ?? '—'}</td>
                      <td style={{ padding:'10px 12px' }}>{ci.foto_url ? <a href={ci.foto_url} target="_blank" rel="noopener noreferrer" style={{ color:'var(--color-primary)' }}>Ver</a> : '—'}</td>
                      <td style={{ padding:'10px 12px' }}>{ci.link ? <a href={ci.link} target="_blank" rel="noopener noreferrer" style={{ color:'var(--color-primary)' }}>Ver</a> : '—'}</td>
                      {can('delete_loc') && (
                        <td style={{ padding:'10px 12px' }}>
                          <button className="icon-btn danger" onClick={() => { if(confirm('¿Eliminar este check-in?')) deleteCheckin(ci.id); }} title="Eliminar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCheckinModal && (
        <CheckinModal onClose={() => setShowCheckinModal(false)} />
      )}
    </div>
  );
}
