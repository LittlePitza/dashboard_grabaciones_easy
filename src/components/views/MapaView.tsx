'use client';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { locStatus } from '@/lib/utils';
import type { Location } from '@/types';

// Leaflet requiere window → cargamos dinámico sin SSR
const MapCanvas = dynamic(() => import('../map/MapCanvas'), { ssr: false, loading: () => (
  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-surface-offset)', borderRadius:'var(--radius-xl)' }}>
    <div className="saving-spin" />
  </div>
) });

const FILTERS = [
  { key:'todas',   label:'Todas' },
  { key:'ok',      label:'Al corriente' },
  { key:'soon',    label:'Por vencer' },
  { key:'overdue', label:'Vencidas' },
  { key:'never',   label:'Sin grabar' },
];

export function MapaView() {
  const { locations, mapaFilter, setMapaFilter } = useAppStore() as any;

  const withCoords = (locations as Location[]).filter(l => l.lat && l.lng);
  const filtered   = mapaFilter === 'todas' ? withCoords : withCoords.filter(l => locStatus(l) === mapaFilter);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 120px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mapa</h1>
          <p className="page-subtitle">Vista geográfica de locaciones con coordenadas registradas.</p>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} className={`filter-btn${mapaFilter===f.key?' active':''}`} onClick={() => setMapaFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>
          {filtered.length} de {withCoords.length} ubicaciones
        </span>
      </div>

      {withCoords.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <h3>Sin ubicaciones</h3>
          <p>Ninguna locación tiene coordenadas. Edita una locación y agrega latitud/longitud.</p>
        </div>
      ) : (
        <div style={{ flex:1, borderRadius:'var(--radius-xl)', overflow:'hidden', border:'1px solid var(--color-border)', boxShadow:'var(--shadow-sm)' }}>
          <MapCanvas locations={filtered} />
        </div>
      )}
    </div>
  );
}
