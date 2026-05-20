/* ═══════════════════════════════════════════════════════════
   GRABACIÓN OBRAS — app.js
   ═══════════════════════════════════════════════════════════ */

// ─── CONFIG ──────────────────────────────────────────────────
const PIN = '1234'; // Cambia antes de producción
const SUPABASE_URL = 'https://fpwttcyemwqfkjsvwxwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_izZUskrc3yT49khe14SptQ__YX9MGk3';
const USE_SUPABASE = true;

// ─── SUPABASE CLIENT ─────────────────────────────────────────
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STATE ───────────────────────────────────────────────────
let locations = [];
let checkins  = [];
let currentLocFilter = 'todas';
let currentRegFilter = 'todos';
let rutaSelected     = []; // IDs en orden para "crear ruta"
let currentRutaTab   = 'sugerida';

// ─── SEED DATA (fallback offline) ────────────────────────────
const SEED_LOCATIONS = [
  {id:'loc-1', name:'Academia Cenit',    address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-2', name:'Commosa',           address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-3', name:'Planta Mars',       address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-4', name:'Harmak',            address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-5', name:'Matera II',         address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-6', name:'Marques del Rio',   address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-7', name:'Granja Palenque',   address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-8', name:'Costco',            address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-9', name:'Finka',             address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-10',name:'Acceso Ammper',     address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-11',name:'La condesa III',    address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-12',name:'Noura',             address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-13',name:'Naara',             address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-14',name:'Bordos',            address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-15',name:'FGR',               address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-16',name:'Villa Almeria',     address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
  {id:'loc-17',name:'Biznaga',           address:'', responsable:'', freq_days:15, link_notion:'', last_checkin:null, created_at:new Date().toISOString()},
];

// ─── PIN ─────────────────────────────────────────────────────
function togglePinVis() {
  const inp = document.getElementById('pin-input');
  const eye = document.getElementById('pin-eye');
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type = 'password';
    eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

function checkPin() {
  const val = document.getElementById('pin-input').value;
  if (val === PIN) {
    sessionStorage.setItem('unlocked', '1');
    openAppShell();
  } else {
    const errEl = document.getElementById('pin-error');
    errEl.textContent = 'PIN incorrecto.';
    const inp = document.getElementById('pin-input');
    inp.classList.add('error');
    setTimeout(() => { inp.classList.remove('error'); inp.value = ''; }, 600);
  }
}

document.getElementById('pin-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkPin();
});

let __appInitialized = false;
function openAppShell() {
  document.getElementById('pin-gate').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (!__appInitialized) { __appInitialized = true; initApp(); }
}

if (sessionStorage.getItem('unlocked') === '1') openAppShell();

function logout() {
  sessionStorage.removeItem('unlocked');
  location.reload();
}

// ─── INIT ─────────────────────────────────────────────────────
async function initApp() {
  setupThemeToggle();
  await loadAll();
  renderAll();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
}

async function loadAll() {
  if (USE_SUPABASE) {
    try {
      const [locRes, ciRes] = await Promise.all([
        sb.from('locations').select('*').order('name'),
        sb.from('checkins').select('*').order('date', { ascending: false })
      ]);
      if (locRes.error) throw locRes.error;
      if (ciRes.error) throw ciRes.error;
      locations = locRes.data;
      checkins  = ciRes.data;
      setSyncStatus('online');
    } catch (e) {
      showToast('Error conectando a Supabase: ' + e.message, 'error');
      if (locations.length === 0) locations = SEED_LOCATIONS;
      setSyncStatus('local');
    }
  } else {
    if (locations.length === 0) locations = SEED_LOCATIONS;
    setSyncStatus('local');
  }
  updateLastCheckins();
}

function setSyncStatus(state) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  el.className = 'sync-indicator';
  if (state === 'online') {
    el.textContent = '⬤ sync';
    el.classList.add('sync-online');
  } else if (state === 'local') {
    el.textContent = '⬤ local';
    el.classList.add('sync-local');
  } else {
    el.textContent = '⬤ offline';
    el.classList.add('sync-offline');
  }
}

async function refreshAll() {
  showToast('Actualizando datos…', 'info');
  await loadAll();
  renderAll();
  showToast('Datos actualizados', 'success');
}

function renderAll() {
  renderKPIs();
  renderLocaciones();
  renderVencer();
  renderRegistro();
  renderRutaAll();
  renderCorriente();
  updateBadges();
  document.getElementById('sidebar-loc-count').textContent = locations.length;
}

// ─── UTILS ────────────────────────────────────────────────────
const today     = () => new Date().toISOString().slice(0, 10);
const daysAgo   = (d) => d ? Math.floor((new Date(today()) - new Date(d)) / 86400000) : null;
const daysUntilDue = (loc) => loc.last_checkin ? loc.freq_days - daysAgo(loc.last_checkin) : null;
const locStatus = (loc) => {
  if (!loc.last_checkin) return 'never';
  const due = daysUntilDue(loc);
  if (due < 0) return 'overdue';
  if (due <= 3) return 'soon';
  return 'ok';
};
const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const genId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(36).slice(2));
const esc   = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const getLocName = (id) => (locations.find(l => l.id === id) || {}).name || id;

function getPlannedDate(loc) {
  if (!loc.last_checkin) return today();
  const d = new Date(loc.last_checkin + 'T00:00:00');
  d.setDate(d.getDate() + (loc.freq_days || 15));
  return d.toISOString().slice(0, 10);
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
}

function formatWeekLabel(d) {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `Semana ${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]}`;
}

function updateLastCheckins() {
  locations.forEach(loc => {
    const lc = checkins.filter(c => c.location_id === loc.id).sort((a, b) => b.date.localeCompare(a.date));
    if (lc.length > 0) loc.last_checkin = lc[0].date;
  });
}

// ─── KPIs ──────────────────────────────────────────────────────
function renderKPIs() {
  const total    = locations.length;
  const vencidas = locations.filter(l => locStatus(l) === 'overdue').length;
  const pronto   = locations.filter(l => locStatus(l) === 'soon').length;
  const ok       = locations.filter(l => locStatus(l) === 'ok').length;
  const sinGrabar= locations.filter(l => locStatus(l) === 'never').length;
  const pct      = total > 0 ? Math.round((ok / total) * 100) : 0;

  document.getElementById('kpi-strip').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value">${total}</div><div class="kpi-sub">locaciones</div></div>
    <div class="kpi-card"><div class="kpi-label">Vencidas</div><div class="kpi-value" style="color:var(--color-error)">${vencidas}</div><div class="kpi-sub">requieren visita</div></div>
    <div class="kpi-card"><div class="kpi-label">Por vencer</div><div class="kpi-value" style="color:var(--color-gold)">${pronto}</div><div class="kpi-sub">en los próx. 3 días</div></div>
    <div class="kpi-card"><div class="kpi-label">Al corriente</div><div class="kpi-value" style="color:var(--color-success)">${ok}</div><div class="kpi-sub">${pct}% del total</div></div>
    <div class="kpi-card"><div class="kpi-label">Sin grabar</div><div class="kpi-value">${sinGrabar}</div><div class="kpi-sub">primera visita</div></div>
    <div class="kpi-card"><div class="kpi-label">Check-ins</div><div class="kpi-value" style="color:var(--color-primary)">${checkins.length}</div><div class="kpi-sub">total registros</div></div>
  `;
}

function updateBadges() {
  const urgentes = locations.filter(l => ['overdue', 'soon'].includes(locStatus(l))).length;
  const bv = document.getElementById('badge-vencer');
  bv.textContent = urgentes;
  bv.classList.toggle('zero', urgentes === 0);
  const br = document.getElementById('badge-ruta');
  br.textContent = rutaSelected.length;
  br.classList.toggle('zero', rutaSelected.length === 0);
}

// ─── LOCACIONES ───────────────────────────────────────────────
function setLocFilter(f, btn) {
  currentLocFilter = f;
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLocaciones();
}

function renderLocaciones() {
  const q = (document.getElementById('loc-search')?.value || '').toLowerCase();
  let list = locations.filter(l => {
    if (q && !l.name.toLowerCase().includes(q)) return false;
    if (currentLocFilter === 'vencidas') return locStatus(l) === 'overdue';
    if (currentLocFilter === 'pronto')   return locStatus(l) === 'soon';
    if (currentLocFilter === 'ok')       return locStatus(l) === 'ok';
    if (currentLocFilter === 'nunca')    return locStatus(l) === 'never';
    return true;
  });

  const grid = document.getElementById('loc-grid');
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <h3>Sin locaciones</h3><p>No hay locaciones con el filtro actual.</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(loc => {
    const st  = locStatus(loc);
    const due = daysUntilDue(loc);
    let statusLabel, statusClass;
    if (st === 'never')   { statusLabel = 'Sin grabar';           statusClass = 'chip-never'; }
    else if (st === 'overdue') { statusLabel = `${Math.abs(due)}d vencida`; statusClass = 'chip-overdue'; }
    else if (st === 'soon')    { statusLabel = `${due}d p/vencer`;           statusClass = 'chip-soon'; }
    else                       { statusLabel = 'Al corriente';                statusClass = 'chip-ok'; }

    const dotClass = { never:'status-never', overdue:'status-overdue', soon:'status-soon', ok:'status-ok' }[st];
    return `<div class="loc-card">
      <div class="loc-card-header">
        <span class="loc-card-title">${esc(loc.name)}</span>
        <span class="status-dot ${dotClass}" title="${statusLabel}"></span>
      </div>
      <div class="loc-meta">
        ${loc.address ? `<div class="loc-meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${esc(loc.address)}</div>` : ''}
        ${loc.responsable ? `<div class="loc-meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${esc(loc.responsable)}</div>` : ''}
        <div class="loc-meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Cada ${loc.freq_days}d · Último: ${fmtDate(loc.last_checkin)}</div>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${st==='ok'?100:st==='soon'?60:st==='overdue'?15:0}%;background:${st==='overdue'?'var(--color-error)':st==='soon'?'var(--color-gold)':'var(--color-success)'}"></div>
      </div>
      <div class="loc-card-footer">
        <span class="chip ${statusClass}">${statusLabel}</span>
        <div class="loc-card-actions">
          <button class="icon-btn" onclick="openCheckinModal('${loc.id}')" title="Nuevo check-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="icon-btn" onclick="openLocModal('${loc.id}')" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" onclick="deleteLoc('${loc.id}')" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── VENCER ───────────────────────────────────────────────────
function renderVencer() {
  const sorted = [...locations]
    .filter(l => l.last_checkin)
    .map(l => ({ ...l, dueIn: daysUntilDue(l) }))
    .sort((a, b) => a.dueIn - b.dueIn)
    .slice(0, 20);
  const never = locations.filter(l => !l.last_checkin);
  const all   = [...sorted, ...never.map(l => ({ ...l, dueIn: null }))];

  const el = document.getElementById('vencer-list');
  if (all.length === 0) { el.innerHTML = '<div class="empty-state"><h3>Sin locaciones</h3></div>'; return; }

  el.innerHTML = all.map(loc => {
    const due = loc.dueIn;
    let cls = 'ok', label;
    if (due === null)    { cls = 'ok'; label = 'Sin grabar'; }
    else if (due < 0)    { cls = 'overdue'; label = `${Math.abs(due)}d vencida`; }
    else if (due <= 3)   { cls = 'soon'; label = `vence en ${due}d`; }
    else                 { cls = 'ok'; label = `${due}d restantes`; }
    const daysDisplay = due === null ? '—' : (due < 0 ? `-${Math.abs(due)}` : `+${due}`);
    return `<div class="vencer-item">
      <div class="vencer-days ${cls}">${daysDisplay}</div>
      <div class="vencer-info">
        <div class="vencer-name">${esc(loc.name)}</div>
        <div class="vencer-sub">Cada ${loc.freq_days}d · Último: ${fmtDate(loc.last_checkin)} · <span class="chip chip-${due===null?'never':due<0?'overdue':due<=3?'soon':'ok'}">${label}</span></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openCheckinModal('${loc.id}')">Check-in</button>
    </div>`;
  }).join('');
}

// ─── REGISTRO ─────────────────────────────────────────────────
function setRegFilter(f, btn) {
  currentRegFilter = f;
  document.querySelectorAll('#view-registro .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRegistro();
}

function renderRegistro() {
  const q = (document.getElementById('reg-search')?.value || '').toLowerCase();
  let list = [...checkins].sort((a, b) => b.date.localeCompare(a.date));
  if (currentRegFilter !== 'todos') list = list.filter(c => c.estado === currentRegFilter);
  if (q) list = list.filter(c => getLocName(c.location_id).toLowerCase().includes(q) || (c.notes || '').toLowerCase().includes(q));

  const tbody = document.getElementById('registro-tbody');
  const empty = document.getElementById('registro-empty');
  if (list.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = list.map(ci => `
    <tr>
      <td style="font-weight:600">${esc(getLocName(ci.location_id))}</td>
      <td style="font-family:var(--font-mono);color:var(--color-text-muted)">${fmtDate(ci.date)}</td>
      <td><span class="chip chip-${ci.estado}">${{grabado:'Grabado',en_edicion:'En edición',publicado:'Publicado'}[ci.estado]||ci.estado}</span></td>
      <td style="color:var(--color-text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ci.notes||'')}</td>
      <td>${ci.link ? `<a href="${esc(ci.link)}" target="_blank" rel="noopener noreferrer" class="text-link">Ver ↗</a>` : ''}</td>
      <td><div class="td-actions">
        <button class="icon-btn" onclick="openCheckinModal(null,'${ci.id}')" title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" onclick="deleteCheckin('${ci.id}')" title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('');
}

// ─── MI RUTA — TABS ───────────────────────────────────────────
function switchRutaTab(tab, btn) {
  currentRutaTab = tab;
  document.querySelectorAll('.ruta-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ruta-tab-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('ruta-panel-' + tab)?.classList.add('active');
  if (tab === 'sugerida') renderRutaSugerida();
  if (tab === 'crear')    renderRutaPool();
  if (tab === 'semanas')  renderRutaSemanas();
}

function renderRutaAll() {
  renderRutaSugerida();
  renderRutaPool();
  renderRutaSemanas();
}

// ─── RUTA SUGERIDA ─────────────────────────────────────────────
/**
 * Genera una ruta ordenada por urgencia real:
 * prioridad = (días vencida * 3) + (días sin grabar es high) 
 * Se ordenan: overdue primero (más días vencidas = más urgente),
 * luego soon, luego never (primeras visitas), luego ok.
 */
function buildSuggestedRoute() {
  return [...locations]
    .map(loc => {
      const st  = locStatus(loc);
      const due = daysUntilDue(loc);
      let score = 0;
      if (st === 'overdue') score = 10000 + Math.abs(due) * 10;
      else if (st === 'soon')    score = 5000 + (3 - (due || 0)) * 100;
      else if (st === 'never')   score = 3000;
      else score = Math.max(0, 100 - (due || 99));
      return { ...loc, st, due, score };
    })
    .sort((a, b) => b.score - a.score);
}

function renderRutaSugerida() {
  const suggested = buildSuggestedRoute();
  const list = document.getElementById('ruta-sugerida-list');
  if (!list) return;

  if (suggested.length === 0) {
    list.innerHTML = '<div class="empty-state"><h3>Sin locaciones</h3><p>Agrega locaciones para ver la ruta sugerida.</p></div>';
    return;
  }

  list.innerHTML = suggested.map((loc, i) => {
    const rankCls = i < 3 ? 'rank-critical' : i < 6 ? 'rank-urgent' : 'rank-normal';
    let urgencyTxt, urgencyCls;
    if (loc.st === 'overdue') {
      urgencyTxt = `Vencida hace ${Math.abs(loc.due)}d`;
      urgencyCls = 'urgency-critical';
    } else if (loc.st === 'soon') {
      urgencyTxt = `Vence en ${loc.due}d`;
      urgencyCls = 'urgency-high';
    } else if (loc.st === 'never') {
      urgencyTxt = 'Primera visita';
      urgencyCls = 'urgency-medium';
    } else {
      urgencyTxt = `${loc.due}d restantes`;
      urgencyCls = 'urgency-medium';
    }

    const metaParts = [];
    if (loc.address)     metaParts.push(esc(loc.address));
    if (loc.responsable) metaParts.push(esc(loc.responsable));
    metaParts.push(`Cada ${loc.freq_days}d · Último: ${fmtDate(loc.last_checkin)}`);

    return `<div class="ruta-sug-item">
      <div class="ruta-sug-rank ${rankCls}">${i + 1}</div>
      <div class="ruta-sug-info">
        <div class="ruta-sug-name">${esc(loc.name)}</div>
        <div class="ruta-sug-meta">
          <span class="ruta-sug-urgency ${urgencyCls}">${urgencyTxt}</span>
          <span>${metaParts.join(' · ')}</span>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="addToRuta('${loc.id}')">+ Ruta</button>
        <button class="btn btn-primary btn-sm" onclick="openCheckinModal('${loc.id}')">Check-in</button>
      </div>
    </div>`;
  }).join('');
}

// ─── CREAR RUTA ────────────────────────────────────────────────
function renderRutaPool() {
  const q = (document.getElementById('ruta-pool-search')?.value || '').toLowerCase();
  const poolList = document.getElementById('ruta-pool-list');
  if (!poolList) return;

  // Sort: overdue first, then soon, then never, then ok — within each by name
  const sorted = [...locations]
    .filter(l => !q || l.name.toLowerCase().includes(q) || (l.address||'').toLowerCase().includes(q))
    .map(l => ({ ...l, st: locStatus(l), due: daysUntilDue(l) }))
    .sort((a, b) => {
      const order = { overdue: 0, soon: 1, never: 2, ok: 3 };
      const diff = (order[a.st] ?? 9) - (order[b.st] ?? 9);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

  if (sorted.length === 0) {
    poolList.innerHTML = '<div style="padding:var(--space-8);text-align:center;color:var(--color-text-faint);font-size:var(--text-sm)">Sin resultados</div>';
    return;
  }

  poolList.innerHTML = sorted.map(loc => {
    const inRuta = rutaSelected.includes(loc.id);
    let statusTxt, statusCls;
    if (loc.st === 'overdue')   { statusTxt = `Vencida ${Math.abs(loc.due)}d`; statusCls = 'chip-overdue'; }
    else if (loc.st === 'soon') { statusTxt = `${loc.due}d p/vencer`;          statusCls = 'chip-soon'; }
    else if (loc.st === 'never'){ statusTxt = 'Primera visita';                statusCls = 'chip-never'; }
    else                        { statusTxt = `${loc.due}d restantes`;         statusCls = 'chip-ok'; }

    return `<div class="pool-item ${inRuta ? 'in-ruta' : ''}" onclick="addToRuta('${loc.id}')">
      <div class="pool-item-main">
        <div class="pool-item-name">${esc(loc.name)}</div>
        <div class="pool-item-meta">
          <span class="chip ${statusCls}">${statusTxt}</span>
          ${loc.address ? ' · ' + esc(loc.address) : ''}
        </div>
      </div>
      ${inRuta
        ? `<span style="font-size:var(--text-xs);color:var(--color-success)">✓</span>`
        : `<button class="pool-add-btn" onclick="addToRuta('${loc.id}');event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar
           </button>`
      }
    </div>`;
  }).join('');
}

function renderSelectedOrder() {
  const container = document.getElementById('ruta-selected-order');
  const empty     = document.getElementById('ruta-selected-empty');
  const shareBt   = document.getElementById('ruta-share-btn');
  const countBdg  = document.getElementById('ruta-count-badge');
  if (!container) return;

  countBdg && (countBdg.textContent = rutaSelected.length);
  shareBt  && (shareBt.disabled = rutaSelected.length === 0);

  if (rutaSelected.length === 0) {
    container.innerHTML = '';
    container.appendChild(empty || createEmptyEl());
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Clear and rebuild order items only (keep empty el in DOM)
  const items = container.querySelectorAll('.ruta-order-item');
  items.forEach(el => el.remove());

  rutaSelected.forEach((id, i) => {
    const loc = locations.find(l => l.id === id);
    if (!loc) return;
    const div = document.createElement('div');
    div.className = 'ruta-order-item';
    div.innerHTML = `
      <span class="ruta-order-num">${i + 1}</span>
      <span class="ruta-order-name">${esc(loc.name)}</span>
      <button class="icon-btn ruta-order-remove" onclick="removeFromRuta('${id}')" title="Quitar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(div);
  });
}

function addToRuta(id) {
  if (rutaSelected.includes(id)) return;
  rutaSelected.push(id);
  renderRutaPool();
  renderSelectedOrder();
  updateBadges();
}

function removeFromRuta(id) {
  rutaSelected = rutaSelected.filter(x => x !== id);
  renderRutaPool();
  renderSelectedOrder();
  updateBadges();
}

function clearRuta() {
  rutaSelected = [];
  renderRutaPool();
  renderSelectedOrder();
  updateBadges();
}

// ─── POR SEMANA ─────────────────────────────────────────────────
function renderRutaSemanas() {
  const q        = (document.getElementById('ruta-search')?.value || '').toLowerCase();
  const filtered = locations.filter(l => !q || l.name.toLowerCase().includes(q) || (l.address||'').toLowerCase().includes(q));

  const groups = {};
  filtered.forEach(loc => {
    const planDate = getPlannedDate(loc);
    const week     = startOfWeek(planDate).toISOString().slice(0, 10);
    if (!groups[week]) groups[week] = [];
    groups[week].push({ ...loc, planDate });
  });

  const weeks    = Object.keys(groups).sort();
  const timeline = document.getElementById('ruta-timeline');
  const weeksCount = document.getElementById('ruta-weeks-count');
  if (weeksCount) weeksCount.textContent = weeks.length;

  if (!weeks.length) {
    timeline.innerHTML = `<div class="empty-state"><h3>Sin resultados</h3><p>No hay locaciones que coincidan.</p></div>`;
    return;
  }

  const currentWeek = startOfWeek(today()).toISOString().slice(0, 10);
  timeline.innerHTML = weeks.map(week => {
    const items  = groups[week].sort((a, b) => a.planDate.localeCompare(b.planDate) || a.name.localeCompare(b.name));
    const sample = items[0];
    const due    = daysUntilDue(sample);
    let cls = 'ok';
    if (week === currentWeek) cls = 'current';
    else if (due !== null && due < 0) cls = 'overdue';
    else if (due !== null && due <= 3) cls = 'soon';

    const weekTitle = formatWeekLabel(new Date(week + 'T00:00:00'));
    let meta = '';
    if (week === currentWeek)        meta = '<span class="soon">Esta semana</span>';
    else if (due !== null && due < 0) meta = `<span class="warn">Venció hace ${Math.abs(due)}d</span>`;
    else if (due !== null && due <= 3) meta = `<span class="soon">Vence en ${due}d</span>`;
    else meta = `<span class="ok">Próximo: ${fmtDate(sample.planDate)}</span>`;

    return `<div class="ruta-week">
      <span class="ruta-week-marker ${cls}"></span>
      <div class="ruta-week-card">
        <div class="ruta-week-head">
          <div>
            <div class="ruta-week-kicker">${week === currentWeek ? 'Esta semana' : weekTitle.toUpperCase()}</div>
            <div class="ruta-week-title">${items.length === 1 ? esc(items[0].name) : items.length + ' locaciones'}</div>
          </div>
          <div class="ruta-week-meta">${meta}</div>
        </div>
        <div class="ruta-week-list">
          ${items.map(loc => {
            const st     = locStatus(loc);
            const stText = { never:'Primera visita', overdue:'Vencida', soon:'Por vencer', ok:'Al corriente' }[st];
            return `<div class="ruta-item">
              <div class="ruta-item-main">
                <div class="ruta-item-name">${esc(loc.name)}</div>
                <div class="ruta-item-sub">${loc.address ? esc(loc.address) + ' · ' : ''}${stText} · ${fmtDate(loc.planDate)}</div>
              </div>
              <div class="ruta-item-actions">
                <button class="btn btn-ghost btn-sm" onclick="addToRuta('${loc.id}')">+ Ruta</button>
                <button class="btn btn-ghost btn-sm" onclick="openCheckinModal('${loc.id}')">Check-in</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── EXPORT RUTA ──────────────────────────────────────────────
function exportRuta(type) {
  let ids, title;
  if (type === 'sugerida') {
    ids   = buildSuggestedRoute().slice(0, 10).map(l => l.id);
    title = 'Ruta sugerida del día';
  } else {
    ids   = rutaSelected;
    title = 'Mi ruta del día';
  }
  if (ids.length === 0) { showToast('No hay locaciones en la ruta', 'error'); return; }
  const text = ids.map((id, i) => `${i + 1}. ${getLocName(id)}`).join('\n');
  if (navigator.share) navigator.share({ title, text });
  else navigator.clipboard.writeText(text).then(() => showToast('Ruta copiada al portapapeles ✓', 'success'));
}

// ─── CORRIENTE ────────────────────────────────────────────────
function renderCorriente() {
  const ok    = locations.filter(l => locStatus(l) === 'ok');
  const grid  = document.getElementById('corriente-grid');
  const empty = document.getElementById('corriente-empty');
  if (ok.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = ok.map(loc => {
    const due = daysUntilDue(loc);
    return `<div class="corriente-card">
      <div class="corriente-name">${esc(loc.name)}</div>
      <div class="corriente-date">Último: ${fmtDate(loc.last_checkin)}</div>
      <div style="font-size:var(--text-xs);color:var(--color-success)">✓ ${due}d restantes</div>
    </div>`;
  }).join('');
}

// ─── MODALS: LOCACIÓN ─────────────────────────────────────────
function openLocModal(id) {
  const isEdit = !!id;
  document.getElementById('modal-loc-title').textContent = isEdit ? 'Editar locación' : 'Nueva locación';
  if (isEdit) {
    const loc = locations.find(l => l.id === id);
    if (!loc) return;
    document.getElementById('loc-id').value          = loc.id;
    document.getElementById('loc-name').value        = loc.name;
    document.getElementById('loc-responsable').value = loc.responsable || '';
    document.getElementById('loc-freq').value        = loc.freq_days;
    document.getElementById('loc-address').value     = loc.address || '';
    document.getElementById('loc-notion').value      = loc.link_notion || '';
  } else {
    document.getElementById('loc-id').value          = '';
    document.getElementById('loc-name').value        = '';
    document.getElementById('loc-responsable').value = '';
    document.getElementById('loc-freq').value        = 15;
    document.getElementById('loc-address').value     = '';
    document.getElementById('loc-notion').value      = '';
  }
  openModal('modal-loc');
}

async function saveLoc() {
  const id   = document.getElementById('loc-id').value;
  const name = document.getElementById('loc-name').value.trim();
  const freq = parseInt(document.getElementById('loc-freq').value);
  if (!name)        { showToast('El nombre es obligatorio', 'error'); return; }
  if (!freq || freq < 1) { showToast('La frecuencia debe ser ≥ 1 día', 'error'); return; }

  const obj = {
    id: id || genId(),
    name,
    responsable: document.getElementById('loc-responsable').value.trim(),
    freq_days:   freq,
    address:     document.getElementById('loc-address').value.trim(),
    link_notion: document.getElementById('loc-notion').value.trim(),
    last_checkin: id ? (locations.find(l => l.id === id) || {}).last_checkin : null,
    created_at:   id ? (locations.find(l => l.id === id) || {}).created_at   : new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const { error } = await sb.from('locations').upsert(obj);
    if (error) { showToast('Error guardando: ' + error.message, 'error'); return; }
  }

  const idx = locations.findIndex(l => l.id === obj.id);
  if (idx > -1) locations[idx] = obj;
  else          locations.push(obj);

  closeModal('modal-loc');
  renderAll();
  showToast(id ? 'Locación actualizada' : 'Locación creada', 'success');
}

// ─── MODALS: CHECK-IN ─────────────────────────────────────────
function openCheckinModal(locId, ciId) {
  const sel = document.getElementById('ci-loc');
  sel.innerHTML = '<option value="">— Selecciona —</option>' +
    locations.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');

  if (ciId) {
    const ci = checkins.find(c => c.id === ciId);
    if (!ci) return;
    document.getElementById('modal-checkin-title').textContent = 'Editar check-in';
    document.getElementById('ci-id').value     = ci.id;
    sel.value = ci.location_id;
    document.getElementById('ci-date').value   = ci.date;
    document.getElementById('ci-estado').value = ci.estado;
    document.getElementById('ci-link').value   = ci.link  || '';
    document.getElementById('ci-notes').value  = ci.notes || '';
  } else {
    document.getElementById('modal-checkin-title').textContent = 'Nuevo check-in';
    document.getElementById('ci-id').value     = '';
    if (locId) sel.value = locId;
    document.getElementById('ci-date').value   = today();
    document.getElementById('ci-estado').value = 'grabado';
    document.getElementById('ci-link').value   = '';
    document.getElementById('ci-notes').value  = '';
  }
  openModal('modal-checkin');
}

async function saveCheckin() {
  const id    = document.getElementById('ci-id').value;
  const locId = document.getElementById('ci-loc').value;
  const date  = document.getElementById('ci-date').value;
  const estado= document.getElementById('ci-estado').value;
  if (!locId) { showToast('Selecciona una locación', 'error'); return; }
  if (!date)  { showToast('La fecha es obligatoria', 'error'); return; }

  const obj = {
    id:          id || genId(),
    location_id: locId,
    date,
    estado,
    link:       document.getElementById('ci-link').value.trim(),
    notes:      document.getElementById('ci-notes').value.trim(),
    created_at: id ? (checkins.find(c => c.id === id) || {}).created_at : new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const { error } = await sb.from('checkins').upsert(obj);
    if (error) { showToast('Error guardando: ' + error.message, 'error'); return; }
    // Sync last_checkin en Supabase
    updateLastCheckins();
    const loc = locations.find(l => l.id === locId);
    if (loc) {
      await sb.from('locations').update({ last_checkin: loc.last_checkin, updated_at: new Date().toISOString() }).eq('id', locId);
    }
  }

  const idx = checkins.findIndex(c => c.id === obj.id);
  if (idx > -1) checkins[idx] = obj;
  else          checkins.push(obj);

  updateLastCheckins();
  closeModal('modal-checkin');
  renderAll();
  showToast(id ? 'Check-in actualizado' : 'Check-in registrado ✓', 'success');
}

// ─── DELETE ────────────────────────────────────────────────────
function deleteLoc(id) {
  const loc = locations.find(l => l.id === id);
  confirmDialog(`Eliminar "${loc?.name}"`, '¿Seguro? Se eliminarán también sus check-ins.', async () => {
    if (USE_SUPABASE) {
      const { error } = await sb.from('locations').delete().eq('id', id);
      if (error) { showToast('Error eliminando: ' + error.message, 'error'); return; }
    }
    locations = locations.filter(l => l.id !== id);
    checkins  = checkins.filter(c => c.location_id !== id);
    rutaSelected = rutaSelected.filter(x => x !== id);
    renderAll();
    showToast('Locación eliminada', 'success');
  });
}

function deleteCheckin(id) {
  confirmDialog('Eliminar check-in', '¿Eliminar este registro?', async () => {
    if (USE_SUPABASE) {
      const { error } = await sb.from('checkins').delete().eq('id', id);
      if (error) { showToast('Error eliminando: ' + error.message, 'error'); return; }
    }
    checkins = checkins.filter(c => c.id !== id);
    updateLastCheckins();
    renderAll();
    showToast('Check-in eliminado', 'success');
  });
}

// ─── EXPORT CSV ────────────────────────────────────────────────
function exportCSV(type) {
  let rows, filename;
  if (type === 'locaciones') {
    rows = [['Nombre','Dirección','Responsable','Frecuencia (días)','Último check-in','Estado']];
    locations.forEach(l => rows.push([l.name, l.address||'', l.responsable||'', l.freq_days, l.last_checkin||'', locStatus(l)]));
    filename = `locaciones-${today()}.csv`;
  } else {
    rows = [['Locación','Fecha','Estado','Notas','Link']];
    checkins.sort((a, b) => b.date.localeCompare(a.date)).forEach(c => rows.push([getLocName(c.location_id), c.date, c.estado, c.notes||'', c.link||'']));
    filename = `registro-${today()}.csv`;
  }
  const csv  = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`${filename} descargado`, 'success');
}

// ─── NAVIGATION ────────────────────────────────────────────────
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + viewId)?.classList.add('active');
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── MODALS UTILS ──────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeOnOverlay(e, id) { if (e.target === e.currentTarget) closeModal(id); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open,.confirm-overlay.open').forEach(el => el.classList.remove('open'));
  }
});

// ─── CONFIRM DIALOG ────────────────────────────────────────────
let confirmCallback = null;
function confirmDialog(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  confirmCallback = cb;
  document.getElementById('confirm-overlay').classList.add('open');
  document.getElementById('confirm-ok-btn').onclick = () => { closeConfirm(); cb(); };
}
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  confirmCallback = null;
}

// ─── THEME TOGGLE ──────────────────────────────────────────────
function setupThemeToggle() {
  const btn  = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const html = document.documentElement;
  let dark   = html.getAttribute('data-theme') === 'dark';

  const updateIcon = () => {
    btn.innerHTML = dark
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  };
  updateIcon();
  btn.addEventListener('click', () => {
    dark = !dark;
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
    updateIcon();
  });
}

// ─── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = {
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = (icons[type] || icons.info) + `<span>${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('exit'); setTimeout(() => t.remove(), 250); }, 3500);
}
