'use client';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { fmtDate, toCSV, downloadCSV, today } from '@/lib/utils';
import type { Location, Checkin } from '@/types';

export function RegistroView() {
  const { locations, checkins, currentRegFilter, setRegFilter } = useAppStore() as any;
  const { can } = useAuth();
  const { deleteCheckin } = useData();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = checkins as Checkin[];
    if (currentRegFilter !== 'todos') list = list.filter(c => c.estado === currentRegFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        ((locations as Location[]).find(l => l.id === c.location_id)?.name ?? '').toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a,b) => b.date.localeCompare(a.date));
  }, [checkins, currentRegFilter, search, locations]);

  const getLocName = (id: string) => (locations as Location[]).find(l => l.id === id)?.name ?? id;

  const exportar = () => {
    const rows = [['Locación','Fecha','Estado','Foto URL','Notas','Link'],
      ...filtered.map(c => [getLocName(c.location_id), c.date, c.estado, c.foto_url??'', c.notes??'', c.link??''])];
    downloadCSV(toCSV(rows), `registro-${today()}.csv`);
  };

  const estadoColor: Record<string, string> = { grabado:'var(--color-primary)', en_edicion:'var(--color-gold)', editado:'var(--color-orange)', publicado:'var(--color-success)' };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Registro</h1>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={exportar}>Exportar CSV</button>
        </div>
      </div>
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
                {['Locación','Fecha','Estado','Notas','Foto','Link',can('delete_loc')?'':''].map((h,i) => h && (
                  <th key={i} style={{ textAlign:'left', padding:'8px 12px', fontWeight:700, fontSize:'var(--text-xs)', color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ci: Checkin) => (
                <tr key={ci.id} style={{ borderBottom:'1px solid var(--color-divider)' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600 }}>{getLocName(ci.location_id)}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'var(--font-mono)', color:'var(--color-text-muted)' }}>{fmtDate(ci.date)}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background:`color-mix(in srgb,${estadoColor[ci.estado]??'var(--color-text-muted)'} 15%,transparent)`, color:estadoColor[ci.estado]??'var(--color-text-muted)' }}>{ci.estado}</span>
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
  );
}
