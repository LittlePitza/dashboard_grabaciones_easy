'use client';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { locStatus, daysUntilDue, daysAgo, fmtDate, mapsUrl, freqLabel } from '@/lib/utils';
import { CheckinModal } from '@/components/modals/CheckinModal';
import type { Location } from '@/types';

export function CorrienteView() {
  const { locations, checkins } = useAppStore() as any;
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [checkinLocId, setCheckinLocId] = useState<string | null>(null);

  const ok = useMemo(() =>
    (locations as Location[]).filter(l => locStatus(l) === 'ok'), [locations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q ? ok.filter((l: Location) =>
      l.name.toLowerCase().includes(q) ||
      (l.responsable??'').toLowerCase().includes(q) ||
      (l.address??'').toLowerCase().includes(q)
    ) : ok;
    return [...list].sort((a: Location, b: Location) => (daysUntilDue(a)??999) - (daysUntilDue(b)??999));
  }, [ok, search]);

  const avg = ok.length ? Math.round(ok.reduce((s: number, l: Location) => s + (daysUntilDue(l)??0), 0) / ok.length) : 0;
  const next = ok.length ? [...ok].sort((a: Location,b: Location) => (daysUntilDue(a)??999)-(daysUntilDue(b)??999))[0] : null;
  const fresh = ok.length ? [...ok].sort((a: Location,b: Location) => (daysUntilDue(b)??0)-(daysUntilDue(a)??0))[0] : null;
  const total = locations.length;
  const pct   = total ? Math.round((ok.length/total)*100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Al corriente</h1>
      </div>
      <p style={{ color:'var(--color-text-muted)', fontSize:'var(--text-sm)', marginBottom:20 }}>Locaciones grabadas recientemente y dentro de su frecuencia.</p>

      {/* KPIs */}
      {ok.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Al corriente', value:ok.length, sub:`${pct}% del total`, color:'var(--color-success)' },
            { label:'Margen promedio', value:`${avg}d`, sub:'hasta vencer', color:'var(--color-text)' },
            { label:'Próxima a vencer', value:next?.name ?? '—', sub:next ? `en ${daysUntilDue(next)}d` : '', color:'var(--color-gold)', small:true },
            { label:'Más reciente', value:fresh?.name ?? '—', sub:fresh ? `hace ${daysAgo(fresh.last_checkin)}d` : '', color:'var(--color-text)', small:true },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div style={{ fontSize: k.small ? 'var(--text-base)' : '1.8rem', fontWeight:700, fontFamily: k.small ? 'inherit' : 'var(--font-mono)', color:k.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.value}</div>
              <div className="kpi-sub" style={{ color: k.color === 'var(--color-gold)' ? k.color : undefined }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {ok.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ position:'relative', maxWidth:480 }}>
            <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--color-text-muted)', pointerEvents:'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" className="search-input" style={{ paddingLeft:36, width:'100%' }} placeholder="Buscar por nombre, responsable o dirección…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      )}

      {ok.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="20 6 9 17 4 12"/></svg>
          <h3>Ninguna al corriente aún</h3><p>Agrega check-ins para ver qué locaciones están al día.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><h3>Sin resultados</h3><p>Ninguna coincide con "{search}".</p></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {filtered.map((loc: Location) => {
            const due     = daysUntilDue(loc) ?? 0;
            const elapsed = daysAgo(loc.last_checkin) ?? 0;
            const freq    = loc.freq_days ?? 15;
            const pct     = Math.min(100, Math.max(0, Math.round((elapsed/freq)*100)));
            const tone    = due <= 5 ? 'warn' : due <= 10 ? 'mid' : 'fresh';
            const color   = tone === 'warn' ? 'var(--color-gold)' : tone === 'mid' ? 'var(--color-primary)' : 'var(--color-success)';
            const initials = (loc.responsable ?? '?').trim().split(/\s+/).map((s: string) => s[0]).slice(0,2).join('').toUpperCase() || '?';

            return (
              <article key={loc.id} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12, boxShadow:'var(--shadow-sm)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3, background:color }} />
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <h3 style={{ fontSize:'var(--text-base)', fontWeight:700, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</h3>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--color-text-muted)' }}>{freqLabel(freq)}</div>
                  </div>
                  <div style={{ width:52, height:52, borderRadius:'var(--radius-lg)', background:`color-mix(in srgb,${color} 12%,transparent)`, color, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, lineHeight:1 }}>
                    <span style={{ fontSize:'1.3rem', fontWeight:700, fontFamily:'var(--font-mono)' }}>{due}</span>
                    <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', opacity:.75 }}>d</span>
                  </div>
                </div>
                {(loc.responsable || loc.address) && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {loc.responsable && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>
                        <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--color-primary-highlight)', color:'var(--color-primary)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>{initials}</span>
                        {loc.responsable}
                      </div>
                    )}
                    {loc.address && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'var(--text-xs)', color:'var(--color-text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {loc.address}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <div style={{ height:6, background:'var(--color-surface-dynamic)', borderRadius:99, overflow:'hidden', marginBottom:4 }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99 }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--color-text-muted)' }}>
                    <span>Día {elapsed} de {freq}</span>
                    <span>Último: {fmtDate(loc.last_checkin)}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, paddingTop:12, borderTop:'1px solid var(--color-divider)' }}>
                  {can('checkin') && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex:1, justifyContent:'center' }}
                      onClick={() => setCheckinLocId(loc.id)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
                      Check-in
                    </button>
                  )}
                  {loc.lat && loc.lng && (
                    <a className="btn btn-secondary btn-sm" href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                      Maps
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {checkinLocId && (
        <CheckinModal
          locationId={checkinLocId}
          onClose={() => setCheckinLocId(null)}
        />
      )}
    </div>
  );
}
