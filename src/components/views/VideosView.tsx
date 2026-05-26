'use client';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { fmtDate, ytThumb } from '@/lib/utils';

const ESTADO_TS_COLOR: Record<string, string> = { grabado:'var(--color-primary)', en_edicion:'var(--color-gold)', editado:'var(--color-orange)', publicado:'var(--color-success)' };
const ESTADO_TS_LABEL: Record<string, string> = { grabado:'Grabado', en_edicion:'En edición', editado:'Editado', publicado:'Publicado' };
import type { Location, Checkin, CheckinEstado } from '@/types';

const ESTADOS: { key: CheckinEstado; label: string }[] = [
  { key:'grabado',    label:'Grabado' },
  { key:'en_edicion', label:'En edición' },
  { key:'editado',    label:'Editado' },
  { key:'publicado',  label:'Publicado' },
];

const ESTADO_COLOR: Record<string, string> = {
  grabado:    'var(--color-primary)',
  en_edicion: 'var(--color-gold)',
  editado:    'var(--color-orange)',
  publicado:  'var(--color-success)',
};

export function VideosView() {
  const { locations, checkins, currentVideoFilter, setVideoFilter, currentVideoLocId, setVideoLocId } = useAppStore() as any;
  const { can } = useAuth();
  const { deleteCheckin, updateCheckinEstado } = useData();
  const [search, setSearch] = useState('');

  const locs = useMemo(() => {
    let list = locations as Location[];
    if (search) list = list.filter((l: Location) => l.name.toLowerCase().includes(search.toLowerCase()));
    if (currentVideoFilter === 'pendiente')
      list = list.filter((l: Location) => (checkins as Checkin[]).some(c => c.location_id===l.id && c.estado !== 'publicado'));
    if (currentVideoFilter === 'publicado')
      list = list.filter((l: Location) => (checkins as Checkin[]).some(c => c.location_id===l.id && c.estado === 'publicado'));
    return list;
  }, [locations, checkins, search, currentVideoFilter]);

  if (currentVideoLocId) {
    return <VideoDetail locId={currentVideoLocId} onBack={() => setVideoLocId(null)} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Producción de Videos</h1>
          <p className="page-subtitle">Biblioteca de videos por obra · Estado de edición</p>
        </div>
      </div>
      <div className="filters">
        <input type="search" className="search-input" placeholder="Buscar obra…" value={search} onChange={e => setSearch(e.target.value)} />
        {[{f:'todas',l:'Todas'},{f:'pendiente',l:'Con pendientes'},{f:'publicado',l:'Publicadas'}].map(fb => (
          <button key={fb.f} className={`filter-btn${currentVideoFilter===fb.f?' active':''}`} onClick={() => setVideoFilter(fb.f)}>{fb.l}</button>
        ))}
      </div>
      {locs.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <h3>Sin obras</h3><p>No hay obras con ese filtro.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
          {locs.map((loc: Location) => {
            const locCIs   = (checkins as Checkin[]).filter(c => c.location_id === loc.id);
            const total    = locCIs.length;
            const grabado  = locCIs.filter(c=>c.estado==='grabado').length;
            const enEd     = locCIs.filter(c=>c.estado==='en_edicion').length;
            const editado  = locCIs.filter(c=>c.estado==='editado').length;
            const publicado= locCIs.filter(c=>c.estado==='publicado').length;
            const pct      = total ? Math.round((publicado/total)*100) : 0;

            const withMedia = [...locCIs].sort((a,b)=>b.date.localeCompare(a.date)).find(c => c.foto_url || ytThumb(c.link));
            const thumbSrc  = withMedia ? (withMedia.foto_url || ytThumb(withMedia.link)) : null;

            return (
              <div key={loc.id} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden', cursor:'pointer', boxShadow:'var(--shadow-sm)', transition:'box-shadow .18s,transform .18s' }}
                onClick={() => setVideoLocId(loc.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow='var(--shadow-md)'; (e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow='var(--shadow-sm)'; (e.currentTarget as HTMLDivElement).style.transform=''; }}
              >
                <div style={{ height:120, background:'var(--color-surface-offset)', overflow:'hidden', position:'relative' }}>
                  {thumbSrc
                    ? <img src={thumbSrc} alt={loc.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-faint)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                      </div>
                  }
                  {loc.playlist_url && (
                    <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,.65)', color:'#fff', borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>▶ Playlist</div>
                  )}
                </div>
                <div style={{ padding:'12px 14px' }}>
                  <div style={{ fontWeight:700, fontSize:'var(--text-sm)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                    {grabado   > 0 && <span style={{ fontSize:10, color:'var(--color-primary)' }}>● {grabado} grab.</span>}
                    {enEd      > 0 && <span style={{ fontSize:10, color:'var(--color-gold)' }}>● {enEd} edic.</span>}
                    {editado   > 0 && <span style={{ fontSize:10, color:'var(--color-orange)' }}>● {editado} listo</span>}
                    {publicado > 0 && <span style={{ fontSize:10, color:'var(--color-success)' }}>● {publicado} pub.</span>}
                    {total === 0 && <span style={{ fontSize:10, color:'var(--color-text-faint)' }}>Sin videos aún</span>}
                  </div>
                  {total > 0 && (
                    <div style={{ height:4, background:'var(--color-surface-dynamic)', borderRadius:99, overflow:'hidden', display:'flex' }}>
                      <div style={{ width:`${grabado/total*100}%`, background:'var(--color-primary)', height:'100%' }} />
                      <div style={{ width:`${enEd/total*100}%`, background:'var(--color-gold)', height:'100%' }} />
                      <div style={{ width:`${editado/total*100}%`, background:'var(--color-orange)', height:'100%' }} />
                      <div style={{ width:`${publicado/total*100}%`, background:'var(--color-success)', height:'100%' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VideoDetail({ locId, onBack }: { locId: string; onBack: () => void }) {
  const { locations, checkins } = useAppStore() as any;
  const { can } = useAuth();
  const { deleteCheckin, updateCheckinEstado } = useData();

  const loc    = (locations as Location[]).find(l => l.id === locId);
  const locCIs = useMemo(() =>
    (checkins as Checkin[]).filter(c => c.location_id === locId).sort((a,b) => b.date.localeCompare(a.date)),
    [checkins, locId]
  );

  if (!loc) return null;

  const total    = locCIs.length;
  const publicado= locCIs.filter(c=>c.estado==='publicado').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
            Todas las obras
          </button>
          <h1 className="page-title">{loc.name}</h1>
          {loc.address && <p className="page-subtitle">{loc.address}</p>}
        </div>
        {loc.playlist_url && (
          <a className="btn btn-secondary btn-sm" href={loc.playlist_url} target="_blank" rel="noopener noreferrer">▶ Playlist</a>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:24 }}>
        {([
          { label:'Total', value:total },
          { label:'Grabado', value:locCIs.filter(c=>c.estado==='grabado').length, color:'var(--color-primary)' },
          { label:'En edición', value:locCIs.filter(c=>c.estado==='en_edicion').length, color:'var(--color-gold)' },
          { label:'Editado', value:locCIs.filter(c=>c.estado==='editado').length, color:'var(--color-orange)' },
          { label:'Publicado', value:publicado, color:'var(--color-success)' },
        ] as const).map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize:'1.5rem', color:(k as any).color ?? 'var(--color-text)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Check-ins */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {locCIs.length === 0 ? (
          <div className="empty-state"><h3>Sin check-ins</h3><p>Agrega el primer check-in para esta obra.</p></div>
        ) : locCIs.map((ci: Checkin) => {
          const fotoSrc = ci.foto_url || ytThumb(ci.link);
          return (
            <div key={ci.id} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', overflow:'hidden', display:'flex', gap:0, boxShadow:'var(--shadow-sm)' }}>
              <div style={{ width:110, minHeight:80, background:'var(--color-surface-offset)', flexShrink:0 }}>
                {fotoSrc
                  ? <img src={fotoSrc} alt="foto" style={{ width:'100%', height:'100%', objectFit:'cover', cursor:'pointer' }} onClick={() => window.open(fotoSrc, '_blank')} loading="lazy" />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-faint)' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    </div>
                }
              </div>
              <div style={{ flex:1, padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>{fmtDate(ci.date)}</span>
                  <div style={{ display:'flex', gap:4 }}>
                    {can('delete_loc') && (
                      <button className="icon-btn danger" title="Eliminar" onClick={() => { if(confirm('¿Eliminar este check-in?')) deleteCheckin(ci.id); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                {ci.notes && <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>{ci.notes}</div>}
                {/* Timeline de historial de estados */}
                {ci.estado_history && ci.estado_history.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:3, padding:'8px 10px', background:'var(--color-surface-offset)', borderRadius:'var(--radius-md)', borderLeft:'2px solid var(--color-divider)' }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--color-text-faint)', marginBottom:2 }}>Historial de estados</div>
                    {ci.estado_history.map((h: any, i: number) => {
                      const color = ESTADO_TS_COLOR[h.estado] ?? 'var(--color-text-muted)';
                      const d     = new Date(h.timestamp);
                      const hora  = d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', hour12:false });
                      const fecha = d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' });
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:10, fontFamily:'var(--font-mono)' }}>
                          <span style={{ color:'var(--color-text-faint)', minWidth:80 }}>{fecha} {hora}</span>
                          {h.estado_anterior && (
                            <><span style={{ color:ESTADO_TS_COLOR[h.estado_anterior]??'gray' }}>{ESTADO_TS_LABEL[h.estado_anterior]??h.estado_anterior}</span>
                            <span style={{ color:'var(--color-text-faint)' }}>→</span></>
                          )}
                          <span style={{ color, fontWeight:700 }}>{ESTADO_TS_LABEL[h.estado]??h.estado}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {ESTADOS.map(e => (
                    <button key={e.key}
                      style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:700, border:'1px solid', cursor: can('change_estado') ? 'pointer' : 'default', opacity: can('change_estado') ? 1 : .7,
                        background: ci.estado===e.key ? `color-mix(in srgb,${ESTADO_COLOR[e.key]} 15%,transparent)` : 'transparent',
                        color: ci.estado===e.key ? ESTADO_COLOR[e.key] : 'var(--color-text-muted)',
                        borderColor: ci.estado===e.key ? ESTADO_COLOR[e.key] : 'var(--color-border)',
                      }}
                      disabled={!can('change_estado')}
                      onClick={() => can('change_estado') && updateCheckinEstado(ci.id, e.key)}
                    >{e.label}</button>
                  ))}
                  {ci.link && (
                    <a href={ci.link} target="_blank" rel="noopener noreferrer" style={{ fontSize:'var(--text-xs)', color:'var(--color-primary)', fontWeight:600, marginLeft:'auto' }}>
                      ▶ Ver video
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
