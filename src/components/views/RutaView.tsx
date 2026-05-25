'use client';
import { useAppStore } from '@/lib/store';
import { locStatus, daysUntilDue, fmtDate, getPlannedDate } from '@/lib/utils';
import type { Location } from '@/types';

export function RutaView() {
  const { locations, rutaSelected, addToRuta, removeFromRuta, clearRuta, role } = useAppStore() as any;

  if (role === 'lector') {
    return (
      <div className="empty-state" style={{ marginTop:40 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3>Sección protegida</h3>
        <p>La planificación de rutas solo está disponible para administradores.</p>
      </div>
    );
  }

  const suggested = [...(locations as Location[])]
    .filter(l => ['overdue','soon','never'].includes(locStatus(l)))
    .sort((a,b) => (daysUntilDue(a)??-999)-(daysUntilDue(b)??-999))
    .slice(0, 12);

  const pool = (locations as Location[]).filter(l => !rutaSelected.includes(l.id));
  const selected = rutaSelected.map((id: string) => (locations as Location[]).find(l => l.id===id)).filter(Boolean) as Location[];

  const statusColor = (l: Location) => {
    const st = locStatus(l);
    return st==='overdue' ? 'var(--color-error)' : st==='soon' ? 'var(--color-gold)' : st==='ok' ? 'var(--color-success)' : 'var(--color-text-faint)';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Ruta</h1>
          <p className="page-subtitle">Planea tus visitas de grabación</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Sugeridas */}
        <div>
          <h2 style={{ fontSize:'var(--text-base)', fontWeight:700, marginBottom:12 }}>Sugeridas por urgencia</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {suggested.map((loc: Location) => {
              const added = rutaSelected.includes(loc.id);
              const due   = daysUntilDue(loc);
              const color = statusColor(loc);
              return (
                <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'var(--text-sm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                    <div style={{ fontSize:'var(--text-xs)', color, fontFamily:'var(--font-mono)' }}>
                      {due !== null ? (due < 0 ? `Venció hace ${Math.abs(due)}d` : due===0 ? 'Vence hoy' : `Vence en ${due}d`) : 'Sin grabar'}
                    </div>
                  </div>
                  <button
                    className={`btn btn-sm ${added ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => added ? removeFromRuta(loc.id) : addToRuta(loc.id)}
                  >
                    {added ? '✓ En ruta' : '+ Agregar'}
                  </button>
                </div>
              );
            })}
            {suggested.length === 0 && (
              <div style={{ color:'var(--color-text-muted)', fontSize:'var(--text-sm)', textAlign:'center', padding:20 }}>Todas las locaciones están al corriente</div>
            )}
          </div>
        </div>

        {/* Ruta seleccionada */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h2 style={{ fontSize:'var(--text-base)', fontWeight:700, margin:0 }}>Ruta del día ({selected.length})</h2>
            {selected.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearRuta}>Limpiar</button>
            )}
          </div>
          {selected.length === 0 ? (
            <div style={{ color:'var(--color-text-muted)', fontSize:'var(--text-sm)', textAlign:'center', padding:20, background:'var(--color-surface)', borderRadius:'var(--radius-lg)', border:'1px dashed var(--color-border)' }}>
              Agrega locaciones desde la lista
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {selected.map((loc: Location, i: number) => (
                <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-lg)' }}>
                  <span style={{ width:24, height:24, borderRadius:'50%', background:'var(--color-primary-highlight)', color:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{i+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'var(--text-sm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                    <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>{loc.responsable ?? ''}</div>
                  </div>
                  <button className="icon-btn danger" onClick={() => removeFromRuta(loc.id)} title="Quitar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
