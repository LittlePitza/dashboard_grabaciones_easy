'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { locStatus, daysUntilDue, fmtDate, mapsUrl, freqLabel } from '@/lib/utils';
import type { Location } from '@/types';

interface Props { locations: Location[] }

const STATUS_COLOR: Record<string, string> = {
  ok:      '#22c55e',
  soon:    '#f59e0b',
  overdue: '#ef4444',
  never:   '#6b7280',
};

export default function MapCanvas({ locations }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapInst   = useRef<any>(null);
  const markers   = useRef<any[]>([]);
  const { theme } = useAppStore() as any;

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const L = (window as any).L;
    if (!L) { setTimeout(() => {}, 300); return; }

    mapInst.current = L.map(mapRef.current, { zoomControl: true })
      .setView([18.65, -99.18], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapInst.current);

    return () => {
      mapInst.current?.remove();
      mapInst.current = null;
    };
  }, []);

  useEffect(() => {
    const L2 = (window as any).L;
    if (!L2 || !mapInst.current) return;
    const L = L2;

    markers.current.forEach(m => mapInst.current.removeLayer(m));
    markers.current = [];

    locations.forEach(loc => {
      if (!loc.lat || !loc.lng) return;
      const st    = locStatus(loc);
      const due   = daysUntilDue(loc);
      const color = STATUS_COLOR[st] ?? STATUS_COLOR.never;

      const icon = L.divIcon({
        html: `<div style="position:relative;width:28px;height:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">
          <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="14" cy="14" r="5" fill="white"/>
          </svg>
        </div>`,
        className: '', iconSize:[28,36], iconAnchor:[14,36], popupAnchor:[0,-32],
      });

      const statusLabel = st==='never' ? 'Sin grabar' : st==='overdue' ? `Venció hace ${Math.abs(due!)}d` : st==='soon' ? `Vence en ${due}d` : `Al corriente · ${due}d rest.`;

      const popup = `<div style="padding:12px 14px;min-width:190px;font-family:system-ui,sans-serif">
        <h3 style="font-size:14px;font-weight:700;margin:0 0 4px;padding-right:16px">${loc.name}</h3>
        <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:8px">${statusLabel}</div>
        ${loc.responsable ? `<div style="font-size:11px;color:#888;margin-bottom:2px">👤 ${loc.responsable}</div>` : ''}
        ${loc.address     ? `<div style="font-size:11px;color:#888;margin-bottom:2px">📍 ${loc.address}</div>` : ''}
        <div style="font-size:11px;color:#888">⏱ ${freqLabel(loc.freq_days)}${loc.last_checkin ? ' · último ' + fmtDate(loc.last_checkin) : ''}</div>
        <div style="display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb">
          <a href="${mapsUrl(loc.lat!, loc.lng!)}" target="_blank" style="flex:1;text-align:center;padding:5px 8px;background:#3b82f6;color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">Abrir Maps</a>
        </div>
      </div>`;

      const marker = L.marker([loc.lat, loc.lng], { icon }).bindPopup(popup, { closeButton:true, autoPan:true });
      marker.addTo(mapInst.current);
      markers.current.push(marker);
    });

    if (markers.current.length > 0) {
      try {
        const group = L.featureGroup(markers.current);
        mapInst.current.fitBounds(group.getBounds().pad(0.2), { maxZoom:14 });
      } catch {}
    }
  }, [locations]);

  // Dark mode tiles
  useEffect(() => {
    if (!mapRef.current) return;
    const pane = mapRef.current.querySelector('.leaflet-tile-pane') as HTMLElement;
    if (!pane) return;
    pane.style.filter = theme === 'dark'
      ? 'invert(1) hue-rotate(180deg) brightness(.95) contrast(.9) saturate(.6)'
      : '';
  }, [theme, locations]);

  return <div ref={mapRef} style={{ width:'100%', height:'100%' }} />;
}
