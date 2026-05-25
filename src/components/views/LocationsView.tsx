'use client';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { useData } from '@/hooks/useData';
import { useAuth } from '@/hooks/useAuth';
import { locStatus, daysUntilDue, fmtDate, mapsUrl, genId, today } from '@/lib/utils';
import type { Location } from '@/types';

export function LocationsView() {
  const { locations, checkins, currentLocFilter, setLocFilter } = useAppStore() as any;
  const { deleteLoc, saveLoc } = useData();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  const filtered = useMemo(() => {
    let locs = locations as Location[];
    if (currentLocFilter !== 'todas') {
      const map: Record<string, string> = { vencidas:'overdue', pronto:'soon', ok:'ok', nunca:'never' };
      locs = locs.filter(l => locStatus(l) === (map[currentLocFilter] ?? currentLocFilter));
    }
    if (search) locs = locs.filter(l =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.responsable ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return locs;
  }, [locations, currentLocFilter, search]);

  const total    = locations.length;
  const ok       = (locations as Location[]).filter(l => locStatus(l)==='ok').length;
  const pronto   = (locations as Location[]).filter(l => locStatus(l)==='soon').length;
  const vencidas = (locations as Location[]).filter(l => locStatus(l)==='overdue').length;
  const nunca    = (locations as Location[]).filter(l => locStatus(l)==='never').length;
  const pct      = total ? Math.round((ok/total)*100) : 0;

  const statusColor = (st: string) =>
    st==='ok' ? 'var(--color-success)' : st==='soon' ? 'var(--color-gold)' : st==='overdue' ? 'var(--color-error)' : 'var(--color-text-faint)';

  const statusLabel = (st: string) =>
    st==='ok' ? 'Al corriente' : st==='soon' ? 'Por vencer' : st==='overdue' ? 'Vencida' : 'Sin grabar';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locaciones</h1>
        </div>
        <div className="page-actions">
          {can('checkin') && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva locación
            </button>
          )}
        </div>
      </div>

      <div className="kpi-strip">
        {[
          { label:'Total', value:total, color:'var(--color-text)', sub:'locaciones' },
          { label:'Vencidas', value:vencidas, color:'var(--color-error)', sub:'requieren visita' },
          { label:'Por vencer', value:pronto, color:'var(--color-gold)', sub:'próx. 3 días' },
          { label:'Al corriente', value:ok, color:'var(--color-success)', sub:`${pct}%` },
          { label:'Sin grabar', value:nunca, color:'var(--color-text-muted)', sub:'primera visita' },
          { label:'Check-ins', value:checkins.length, color:'var(--color-primary)', sub:'registros' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        <input type="search" className="search-input" placeholder="Buscar locación…" value={search} onChange={e => setSearch(e.target.value)} />
        {[{f:'todas',l:'Todas'},{f:'vencidas',l:'Vencidas'},{f:'pronto',l:'Próximas'},{f:'ok',l:'Al corriente'},{f:'nunca',l:'Sin grabar'}].map(fb => (
          <button key={fb.f} className={`filter-btn${currentLocFilter===fb.f?' active':''}`} onClick={() => setLocFilter(fb.f)}>{fb.l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <h3>Sin locaciones</h3><p>No hay locaciones con ese filtro.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
          {filtered.map((loc: Location) => {
            const st  = locStatus(loc);
            const due = daysUntilDue(loc);
            const color = statusColor(st);
            const lciCheckins = (checkins as any[]).filter(c => c.location_id === loc.id);
            return (
              <article key={loc.id} style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'16px 20px', boxShadow:'var(--shadow-sm)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3, background:color }} />
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <h3 style={{ fontSize:'var(--text-base)', fontWeight:700, margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</h3>
                    {loc.responsable && <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>{loc.responsable}</div>}
                    {loc.address && <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.address}</div>}
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:99, fontSize:10, fontWeight:700, background:`color-mix(in srgb,${color} 15%,transparent)`, color, flexShrink:0 }}>
                    {statusLabel(st)}
                  </span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)', marginBottom:12 }}>
                  <span>Cada {loc.freq_days}d</span>
                  {loc.last_checkin && <span>Último: {fmtDate(loc.last_checkin)}</span>}
                  {due !== null && <span style={{ color }}>{due >= 0 ? `${due}d rest.` : `${Math.abs(due)}d tard.`}</span>}
                </div>
                <div style={{ display:'flex', gap:8, paddingTop:12, borderTop:'1px solid var(--color-divider)' }}>
                  {can('edit_loc') && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(loc); setShowModal(true); }}>Editar</button>
                  )}
                  {loc.lat && loc.lng && (
                    <a className="btn btn-ghost btn-sm" href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer">Maps</a>
                  )}
                  {can('delete_loc') && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', color:'var(--color-error)' }}
                      onClick={() => { if(confirm(`¿Eliminar "${loc.name}"?`)) deleteLoc(loc.id); }}>
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showModal && (
        <LocModal
          loc={editing}
          onClose={() => setShowModal(false)}
          onSave={async (l) => { const ok = await saveLoc(l); if(ok) setShowModal(false); }}
        />
      )}
    </div>
  );
}

function LocModal({ loc, onClose, onSave }: { loc: Location|null; onClose: () => void; onSave: (l: Location) => void }) {
  const [form, setForm] = useState<Location>(loc ?? {
    id: genId(), name:'', address:'', responsable:'', freq_days:15, lat:null, lng:null,
    notion_url:'', playlist_url:'', created_at: new Date().toISOString(),
  });
  const set = (k: keyof Location, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{loc ? 'Editar locación' : 'Nueva locación'}</h2>
          <button className="icon-btn" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="modal-body">
          <div className="field"><label>Nombre *</label><input className="field-input" value={form.name} onChange={e => set('name',e.target.value)} placeholder="Nombre de la obra" /></div>
          <div className="field-row">
            <div className="field"><label>Responsable</label><input className="field-input" value={form.responsable??''} onChange={e => set('responsable',e.target.value)} /></div>
            <div className="field"><label>Frecuencia (días)</label><input type="number" className="field-input" value={form.freq_days} onChange={e => set('freq_days',parseInt(e.target.value)||15)} min={1} /></div>
          </div>
          <div className="field"><label>Dirección</label><input className="field-input" value={form.address??''} onChange={e => set('address',e.target.value)} /></div>
          <div className="field-row">
            <div className="field"><label>Latitud</label><input type="number" className="field-input" value={form.lat??''} onChange={e => set('lat',parseFloat(e.target.value)||null)} step="any" /></div>
            <div className="field"><label>Longitud</label><input type="number" className="field-input" value={form.lng??''} onChange={e => set('lng',parseFloat(e.target.value)||null)} step="any" /></div>
          </div>
          <div className="field"><label>Link Notion / Drive</label><input type="url" className="field-input" value={form.notion_url??''} onChange={e => set('notion_url',e.target.value)} placeholder="https://…" /></div>
          <div className="field"><label>Playlist YouTube</label><input type="url" className="field-input" value={form.playlist_url??''} onChange={e => set('playlist_url',e.target.value)} placeholder="https://youtube.com/playlist?…" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if(!form.name.trim()) return; onSave(form); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
