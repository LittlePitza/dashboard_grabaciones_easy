'use client';

import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { locStatus, daysUntilDue, fmtDate, mapsUrl, today, freqLabel } from '@/lib/utils';
import type { Location } from '@/types';

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function Panel({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-xl)', padding:'16px 20px', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column', gap:12, minHeight:200 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:12, borderBottom:'1px solid var(--color-divider)' }}>
        <h2 style={{ fontSize:'var(--text-base)', fontWeight:700, margin:0 }}>{title}</h2>
        <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>{meta}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, overflowY:'auto', maxHeight:280 }}>{children}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, color:'var(--color-text-faint)', fontSize:'var(--text-sm)', textAlign:'center', padding:16 }}>
      {text}
    </div>
  );
}

const statusColor = (st: string) =>
  st === 'ok' ? 'var(--color-success)' : st === 'soon' ? 'var(--color-gold)' : st === 'overdue' ? 'var(--color-error)' : 'var(--color-text-faint)';

export function DashboardView() {
  const { locations, checkins, setView } = useAppStore() as any;
  const { can } = useAuth();

  const now      = new Date();
  const hr       = now.getHours();
  const saludo   = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fechaStr = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  const total    = locations.length;
  const ok       = locations.filter((l: Location) => locStatus(l) === 'ok').length;
  const pronto   = locations.filter((l: Location) => locStatus(l) === 'soon').length;
  const vencidas = locations.filter((l: Location) => locStatus(l) === 'overdue').length;
  const nunca    = locations.filter((l: Location) => locStatus(l) === 'never').length;
  const pct      = total ? Math.round((ok / total) * 100) : 0;

  const headline = !total ? 'Bienvenido'
    : vencidas ? `${vencidas} locación${vencidas > 1 ? 'es' : ''} vencida${vencidas > 1 ? 's' : ''}`
    : pronto   ? `${pronto} por vencer pronto`
    : 'Todo al día';

  const subline = !total ? 'Agrega tu primera locación para empezar.'
    : vencidas ? `${pronto ? pronto + ' por vencer · ' : ''}${ok} al corriente de ${total} totales`
    : pronto   ? `Todo bajo control: ${ok} al corriente de ${total}`
    : `Las ${total} locaciones están dentro de su frecuencia.`;

  const urgentes = [
    ...locations.filter((l: Location) => locStatus(l) === 'overdue'),
    ...locations.filter((l: Location) => locStatus(l) === 'soon'),
    ...locations.filter((l: Location) => locStatus(l) === 'never'),
  ].slice(0, 8);

  const cutoffStr = (() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10); })();
  const recent = [...checkins]
    .filter((c: any) => c.date >= cutoffStr)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const getLocName = (id: string) => (locations as Location[]).find(l => l.id === id)?.name ?? id;

  const todayMs  = new Date(today() + 'T00:00:00').getTime();
  const limitMs  = todayMs + 7 * 86_400_000;
  const upcoming = (locations as Location[])
    .filter(l => l.last_checkin)
    .map(l => {
      const d = new Date(`${l.last_checkin}T00:00:00`);
      d.setDate(d.getDate() + (l.freq_days || 15));
      return { ...l, _next: d.getTime(), _date: d };
    })
    .filter((l: any) => l._next >= todayMs && l._next <= limitMs)
    .sort((a: any, b: any) => a._next - b._next)
    .slice(0, 8);

  const VERBOS: Record<string, string> = { grabado:'grabó', en_edicion:'pasó a edición', editado:'editó', publicado:'publicó' };
  const DOTCOLOR: Record<string, string> = { grabado:'var(--color-primary)', en_edicion:'var(--color-gold)', editado:'var(--color-orange)', publicado:'var(--color-success)' };

  return (
    <div>
      {/* Hero */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap', paddingBottom:20, borderBottom:'1px solid var(--color-divider)', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:'var(--text-sm)', color:'var(--color-text-muted)', marginBottom:4 }}>{saludo}</div>
          <h1 style={{ fontSize:'clamp(1.5rem,2vw,2rem)', fontWeight:700, margin:'0 0 4px' }}>{headline}</h1>
          <p style={{ color:'var(--color-text-muted)', margin:0, fontSize:'var(--text-sm)' }}>{subline}</p>
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'var(--text-sm)', color:'var(--color-text-muted)', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', padding:'8px 12px', whiteSpace:'nowrap' }}>
          {fechaStr}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12, marginBottom:24 }}>
        {([
          { label:'Total locaciones', value:total,    color:'var(--color-primary)',  sub: nunca ? `${nunca} sin grabar` : 'todas registradas' },
          { label:'Al corriente',     value:ok,       color:'var(--color-success)',  sub:`${pct}% del total` },
          { label:'Por vencer',       value:pronto,   color:'var(--color-gold)',     sub:'próx. 3 días' },
          { label:'Vencidas',         value:vencidas, color:'var(--color-error)',    sub:'requieren visita' },
        ] as const).map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 2-col */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16, marginBottom:16 }}>
        <Panel title="Acciones urgentes" meta={String(urgentes.length)}>
          {urgentes.length === 0 ? <EmptyPanel text="Sin acciones urgentes" /> : urgentes.map((loc: Location) => {
            const st  = locStatus(loc);
            const due = daysUntilDue(loc);
            const sub = st === 'overdue' ? `Venció hace ${Math.abs(due!)}d · ${loc.responsable ?? '—'}`
                       : st === 'soon'   ? `Vence en ${due}d · ${loc.responsable ?? '—'}`
                       : `Sin grabar · ${loc.responsable ?? '—'}`;
            return (
              <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--color-surface-offset)', borderRadius:'var(--radius-md)', borderLeft:`3px solid ${statusColor(st)}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:'var(--text-sm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>{sub}</div>
                </div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  {can('checkin') && (
                    <button className="btn btn-primary btn-sm" style={{ padding:'4px 8px' }} title="Check-in">✓</button>
                  )}
                  {loc.lat && loc.lng && (
                    <a className="btn btn-ghost btn-sm" href={mapsUrl(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer" style={{ padding:'4px 8px' }}>↗</a>
                  )}
                </div>
              </div>
            );
          })}
        </Panel>

        <Panel title="Actividad reciente" meta="últimos 7d">
          {recent.length === 0 ? <EmptyPanel text="Sin actividad reciente" /> : recent.map((ci: any) => (
            <div key={ci.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--color-divider)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:DOTCOLOR[ci.estado] ?? 'var(--color-text-muted)', marginTop:5, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'var(--text-sm)' }}>Se <strong>{VERBOS[ci.estado] ?? ci.estado}</strong> material de <strong>{getLocName(ci.location_id)}</strong></div>
                <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>{fmtDate(ci.date)}</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
        <Panel title="Distribución por estado" meta="">
          {([
            { label:'Al corriente', count:ok,       color:'var(--color-success)' },
            { label:'Por vencer',   count:pronto,   color:'var(--color-gold)' },
            { label:'Vencidas',     count:vencidas, color:'var(--color-error)' },
            { label:'Sin grabar',   count:nunca,    color:'var(--color-text-faint)' },
          ] as const).map(r => {
            const p = total ? Math.round((r.count / total) * 100) : 0;
            return (
              <div key={r.label} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:r.color, display:'inline-block' }} />
                    {r.label}
                  </span>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--color-text-muted)' }}>{r.count} · {p}%</span>
                </div>
                <div style={{ height:8, background:'var(--color-surface-dynamic)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ width:`${p}%`, height:'100%', background:r.color, borderRadius:99 }} />
                </div>
              </div>
            );
          })}
        </Panel>

        <Panel title="Próximas visitas" meta="7 días">
          {upcoming.length === 0 ? <EmptyPanel text="Nada agendado los próximos 7 días" /> : upcoming.map((loc: any) => {
            const d = loc._date as Date;
            const diff = Math.round((loc._next - todayMs) / 86_400_000);
            const badge = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : `${diff}d`;
            const bc    = diff === 0 ? 'var(--color-error)' : diff <= 3 ? 'var(--color-gold)' : 'var(--color-text-muted)';
            return (
              <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--color-divider)', cursor:'pointer' }} onClick={() => setView('vencer')}>
                <div style={{ minWidth:44, textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:'1.1rem', fontWeight:700, fontFamily:'var(--font-mono)', lineHeight:1 }}>{d.getDate()}</div>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', color:'var(--color-text-muted)', marginTop:2 }}>{MONTHS[d.getMonth()]}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:'var(--text-sm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc.name}</div>
                  <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>{loc.responsable ? loc.responsable + ' · ' : ''}{freqLabel(loc.freq_days)}</div>
                </div>
                <span style={{ padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700, background:`color-mix(in srgb,${bc} 15%,transparent)`, color:bc, flexShrink:0 }}>{badge}</span>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
