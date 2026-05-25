'use client';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { locStatus, daysUntilDue, fmtDate, mapsUrl } from '@/lib/utils';
import type { Location } from '@/types';

export function VencerView() {
  const { locations } = useAppStore() as any;

  const list = useMemo(() =>
    (locations as Location[])
      .filter(l => ['overdue','soon'].includes(locStatus(l)))
      .sort((a,b) => (daysUntilDue(a)??-999) - (daysUntilDue(b)??-999)),
    [locations]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Por <span style={{ color:'var(--color-primary)' }}>Vencer</span></h1>
          <p className="page-subtitle">Locaciones cuyo próximo check-in está próximo o ya venció.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="20 6 9 17 4 12"/></svg>
          <h3>Todo al corriente</h3><p>No hay locaciones urgentes en este momento.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {list.map((loc: Location) => {
            const st  = locStatus(loc);
            const due = daysUntilDue(loc) ?? 0;
            const color = st === 'overdue' ? 'var(--color-error)' : 'var(--color-gold)';
            return (
              <div key={loc.id} style={{ background:'var(--color-surface)', border:`1px solid ${color}44`, borderRadius:'var(--radius-xl)', padding:'16px 20px', display:'flex', alignItems:'center', gap:16, boxShadow:'var(--shadow-sm)' }}>
                <div style={{ width:56, height:56, borderRadius:'var(--radius-lg)', background:`color-mix(in srgb,${color} 12%,transparent)`, color, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, lineHeight:1 }}>
                  <span style={{ fontSize:'1.4rem', fontWeight:700, fontFamily:'var(--font-mono)' }}>{Math.abs(due)}</span>
                  <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', opacity:.75 }}>días</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'var(--text-base)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>
                    {loc.responsable && `${loc.responsable} · `}
                    Cada {loc.freq_days}d{loc.last_checkin ? ` · Último: ${fmtDate(loc.last_checkin)}` : ' · Sin grabar'}
                  </div>
                </div>
                <div style={{ fontSize:'var(--text-xs)', fontWeight:700, color, background:`color-mix(in srgb,${color} 12%,transparent)`, padding:'3px 10px', borderRadius:99, flexShrink:0 }}>
                  {st === 'overdue' ? `Venció hace ${Math.abs(due)}d` : `Vence en ${due}d`}
                </div>
                {loc.lat && loc.lng && (
                  <a className="btn btn-ghost btn-sm" href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>Maps</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
