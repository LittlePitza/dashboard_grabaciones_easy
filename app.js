/* ═══════════════════════════════════════════════════════════
   GRABACIÓN OBRAS — app.js  v1.2
   ═══════════════════════════════════════════════════════════ */

// ─── CONFIG ──────────────────────────────────────────────────
// PINs definidos en la sección ROLES & AUTH
const SUPABASE_URL     = 'https://fpwttcyemwqfkjsvwxwz.supabase.co';
const SUPABASE_ANON_KEY= 'sb_publishable_izZUskrc3yT49khe14SptQ__YX9MGk3';
const USE_SUPABASE     = true;

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STATE ───────────────────────────────────────────────────
let locations        = [];
let checkins         = [];
let currentLocFilter = 'todas';
let currentRegFilter = 'todos';
let rutaSelected     = [];
let currentRutaTab   = 'sugerida';
let currentVideoFilter = 'todas';
let currentVideoLocId  = null;   // obra abierta en detalle

// ─── SEED DATA ───────────────────────────────────────────────
const SEED_LOCATIONS = [
  {id:'loc-1', name:'Academia Cenit',   address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-2', name:'Commosa',          address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-3', name:'Planta Mars',      address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-4', name:'Harmak',           address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-5', name:'Matera II',        address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-6', name:'Marques del Rio',  address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-7', name:'Granja Palenque',  address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-8', name:'Costco',           address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-9', name:'Finka',            address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-10',name:'Acceso Ammper',    address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-11',name:'La condesa III',   address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-12',name:'Noura',            address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-13',name:'Naara',            address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-14',name:'Bordos',           address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-15',name:'FGR',              address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-16',name:'Villa Almeria',    address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
  {id:'loc-17',name:'Biznaga',          address:'', responsable:'', freq_days:15, link_notion:'', playlist_url:'', last_checkin:null},
];

// ─── ROLES & AUTH ─────────────────────────────────────────────
// La app abre directamente en modo LECTOR (sin login).
// Admin entra desde el botón "Admin" en la barra superior → modal con email + contraseña de Supabase.
// El lector no necesita PIN — la app es de consulta pública interna.

let currentRole = 'lector'; // por defecto siempre lector

// Permisos por rol
function can(action) {
  const perms = {
    admin:  ['view','checkin','edit_loc','delete_loc','change_estado'],
    lector: ['view'],
  };
  return (perms[currentRole] || []).includes(action);
}

function applyRoleUI() {
  // Botones de edición: solo admin
  document.querySelectorAll('.role-editor').forEach(el => {
    el.style.display = can('edit_loc') ? '' : 'none';
  });

  // Chip en topbar
  const chip = document.getElementById('topbar-role-chip');
  if (chip) {
    if (currentRole === 'admin') {
      chip.textContent = 'Admin';
      chip.className   = 'topbar-role-chip chip-admin';
    } else {
      chip.textContent = 'Lectura';
      chip.className   = 'topbar-role-chip chip-lector';
    }
  }

  // Botón Admin (lector) / Salir (admin) en topbar
  const adminBtn  = document.getElementById('topbar-admin-btn');
  const logoutBtn = document.getElementById('topbar-logout-btn');
  if (adminBtn)  adminBtn.style.display  = currentRole === 'lector' ? '' : 'none';
  if (logoutBtn) logoutBtn.style.display = currentRole === 'admin'  ? '' : 'none';

  // Banner de solo lectura
  let banner = document.getElementById('readonly-banner');
  if (currentRole === 'lector') {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'readonly-banner';
      banner.style.cssText = [
        'position:fixed','top:56px','left:0','right:0','z-index:80',
        'background:var(--color-surface-offset)',
        'color:var(--color-text-faint)',
        'text-align:center','padding:5px',
        'font-size:var(--text-xs)',
        'border-bottom:1px solid var(--color-divider)',
      ].join(';');
      banner.innerHTML = 'Modo lectura · <button onclick="openAdminLogin()" style="background:none;border:none;color:var(--color-primary);font-size:inherit;cursor:pointer;font-weight:600;padding:0">Entrar como admin</button>';
      document.body.appendChild(banner);
    }
  } else if (banner) {
    banner.remove();
  }
}

// ── Abrir modal de login admin ────────────────────────────────
function openAdminLogin() {
  document.getElementById('admin-email').value    = '';
  document.getElementById('admin-password').value = '';
  document.getElementById('admin-error').textContent = '';
  openModal('modal-admin-login');
  setTimeout(() => document.getElementById('admin-email').focus(), 100);
}

// ── Login admin con Supabase Auth ─────────────────────────────
async function loginAdmin() {
  const email    = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errEl    = document.getElementById('admin-error');
  const btn      = document.getElementById('admin-login-btn');
  const label    = document.getElementById('admin-login-label');

  if (!email || !password) { errEl.textContent = 'Completa email y contraseña.'; return; }

  btn.disabled         = true;
  label.innerHTML      = '<span class="saving-spin"></span> Verificando…';
  errEl.textContent    = '';

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentRole = 'admin';
    sessionStorage.setItem('role', 'admin');
    closeModal('modal-admin-login');
    applyRoleUI();
    showToast('Bienvenido, admin', 'success');
  } catch {
    errEl.textContent = 'Email o contraseña incorrectos.';
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  } finally {
    btn.disabled      = false;
    label.textContent = 'Entrar como admin';
  }
}

function toggleAdminPassVis() {
  const inp = document.getElementById('admin-password');
  const eye = document.getElementById('admin-pass-eye');
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type = 'password';
    eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

// Enter en campo contraseña dispara login
document.addEventListener('DOMContentLoaded', () => {
  const passEl = document.getElementById('admin-password');
  if (passEl) passEl.addEventListener('keydown', e => { if (e.key === 'Enter') loginAdmin(); });
});

// ── Logout admin → volver a lector ───────────────────────────
function logout() {
  sb.auth.signOut();
  sessionStorage.removeItem('role');
  currentRole = 'lector';
  applyRoleUI();
  renderAll();
  showToast('Sesión de admin cerrada', 'info');
}

// ── Shell ────────────────────────────────────────────────────
let __appInitialized = false;
function openAppShell() {
  applyRoleUI();
  if (!__appInitialized) { __appInitialized = true; initApp(); }
}

// ── Inicialización ───────────────────────────────────────────
// La app siempre carga. Verificamos si hay sesión admin activa en Supabase.
(async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentRole = 'admin';
      sessionStorage.setItem('role', 'admin');
    } else {
      currentRole = 'lector';
      sessionStorage.removeItem('role');
    }
  } catch {
    currentRole = 'lector';
  }
  openAppShell();
})();

// ─── INIT ─────────────────────────────────────────────────────
async function initApp() {
  setupThemeToggle();
  setupFotoPreview();
  applyRoleUI();   // apply role before data loads
  await loadAll();
  renderAll();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        // Revisar actualizaciones cada vez que se carga la app
        reg.update();
        // Cuando hay una nueva versión instalada y esperando
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Hay update listo — mostrar banner
              const banner = document.getElementById('update-banner');
              if (banner) banner.style.display = 'flex';
              window.__newWorker = newWorker;
            }
          });
        });
      })
      .catch(() => {});

    // Si el SW tomó control (después de actualizar), recargar
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; location.reload(); }
    });
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
      showToast('Error Supabase: ' + e.message, 'error');
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
  el.textContent = state === 'online' ? '⬤ sync' : state === 'local' ? '⬤ local' : '⬤ offline';
  el.classList.add('sync-' + state);
}

async function refreshAll() {
  showToast('Actualizando…', 'info');
  await loadAll();
  renderAll();
  if (currentVideoLocId) renderVideoDetail(currentVideoLocId);
  showToast('Datos actualizados', 'success');
}

function renderAll() {
  renderKPIs();
  renderLocaciones();
  renderVencer();
  renderRegistro();
  renderRutaAll();
  renderCorriente();
  renderVideosGrid();
  updateBadges();
  document.getElementById('sidebar-loc-count').textContent = locations.length;
}

// ─── UTILS ────────────────────────────────────────────────────
const today      = () => new Date().toISOString().slice(0, 10);
const daysAgo    = (d) => d ? Math.floor((new Date(today()) - new Date(d)) / 86400000) : null;
const daysUntilDue = (loc) => loc.last_checkin ? loc.freq_days - daysAgo(loc.last_checkin) : null;
const locStatus  = (loc) => {
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
const genId   = () => crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(36).slice(2);
const esc     = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const getLocName = (id) => (locations.find(l => l.id === id) || {}).name || id;

function updateLastCheckins() {
  locations.forEach(loc => {
    const lc = checkins.filter(c => c.location_id === loc.id).sort((a,b) => b.date.localeCompare(a.date));
    if (lc.length > 0) loc.last_checkin = lc[0].date;
  });
}

// Extrae ID de video YouTube de cualquier URL
function ytVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function ytThumb(url) {
  const id = ytVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

// ─── KPIs ─────────────────────────────────────────────────────
function renderKPIs() {
  const total     = locations.length;
  const vencidas  = locations.filter(l => locStatus(l) === 'overdue').length;
  const pronto    = locations.filter(l => locStatus(l) === 'soon').length;
  const ok        = locations.filter(l => locStatus(l) === 'ok').length;
  const sinGrabar = locations.filter(l => locStatus(l) === 'never').length;
  const pct       = total > 0 ? Math.round((ok / total) * 100) : 0;
  document.getElementById('kpi-strip').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value">${total}</div><div class="kpi-sub">locaciones</div></div>
    <div class="kpi-card"><div class="kpi-label">Vencidas</div><div class="kpi-value" style="color:var(--color-error)">${vencidas}</div><div class="kpi-sub">requieren visita</div></div>
    <div class="kpi-card"><div class="kpi-label">Por vencer</div><div class="kpi-value" style="color:var(--color-gold)">${pronto}</div><div class="kpi-sub">próx. 3 días</div></div>
    <div class="kpi-card"><div class="kpi-label">Al corriente</div><div class="kpi-value" style="color:var(--color-success)">${ok}</div><div class="kpi-sub">${pct}%</div></div>
    <div class="kpi-card"><div class="kpi-label">Sin grabar</div><div class="kpi-value">${sinGrabar}</div><div class="kpi-sub">primera visita</div></div>
    <div class="kpi-card"><div class="kpi-label">Check-ins</div><div class="kpi-value" style="color:var(--color-primary)">${checkins.length}</div><div class="kpi-sub">registros</div></div>
  `;
}

function updateBadges() {
  const urgentes = locations.filter(l => ['overdue','soon'].includes(locStatus(l))).length;
  const bv = document.getElementById('badge-vencer');
  bv.textContent = urgentes;
  bv.classList.toggle('zero', urgentes === 0);

  const br = document.getElementById('badge-ruta');
  br.textContent = rutaSelected.length;
  br.classList.toggle('zero', rutaSelected.length === 0);

  // Videos pendientes (grabado o en_edicion o editado pero no publicado)
  const pendVideos = checkins.filter(c => c.estado !== 'publicado').length;
  const bvid = document.getElementById('badge-videos');
  bvid.textContent = pendVideos;
  bvid.classList.toggle('zero', pendVideos === 0);
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
    if (st==='never')    { statusLabel='Sin grabar';               statusClass='chip-never'; }
    else if (st==='overdue') { statusLabel=`${Math.abs(due)}d vencida`; statusClass='chip-overdue'; }
    else if (st==='soon')    { statusLabel=`${due}d p/vencer`;          statusClass='chip-soon'; }
    else                     { statusLabel='Al corriente';              statusClass='chip-ok'; }
    const dotClass = {never:'status-never',overdue:'status-overdue',soon:'status-soon',ok:'status-ok'}[st];
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
          ${can('checkin') ? `<button class="icon-btn" onclick="openCheckinModal('${loc.id}')" title="Nuevo check-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>` : ''}
          ${can('edit_loc') ? `<button class="icon-btn" onclick="openLocModal('${loc.id}')" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>` : ''}
          ${can('delete_loc') ? `<button class="icon-btn danger" onclick="deleteLoc('${loc.id}')" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── VENCER ───────────────────────────────────────────────────
function renderVencer() {
  const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const sorted = [...locations].filter(l => l.last_checkin)
    .map(l => ({...l, dueIn: daysUntilDue(l)})).sort((a,b) => a.dueIn-b.dueIn);
  const never = locations.filter(l => !l.last_checkin);
  const all   = [...sorted, ...never.map(l => ({...l, dueIn: null}))];
  const el = document.getElementById('vencer-list');
  if (!all.length) {
    el.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <h3>Sin locaciones</h3><p>Agrega locaciones para ver sus fechas de vencimiento.</p>
    </div>`;
    return;
  }
  el.innerHTML = all.map(loc => {
    const due = loc.dueIn;
    let nextDate = null;
    if (loc.last_checkin) {
      const d = new Date(loc.last_checkin + 'T00:00:00');
      d.setDate(d.getDate() + loc.freq_days);
      nextDate = d;
    }
    let badgeClass, badgeText;
    if (due === null)   { badgeClass='vencer-badge-never';   badgeText='Sin grabar'; }
    else if (due < 0)   { badgeClass='vencer-badge-overdue'; badgeText=`Venció hace ${Math.abs(due)}d`; }
    else if (due === 0) { badgeClass='vencer-badge-overdue'; badgeText='Vence hoy'; }
    else if (due <= 3)  { badgeClass='vencer-badge-soon';    badgeText=`En ${due} día${due===1?'':'s'}`; }
    else                { badgeClass='vencer-badge-ok';      badgeText=`En ${due} días`; }
    const freqText = loc.freq_days===7?'Semanal':loc.freq_days===15?'Quincenal':loc.freq_days===30?'Mensual':`Cada ${loc.freq_days}d`;
    return `<div class="vencer-card" onclick="openCheckinModal('${loc.id}')">
      <div class="vencer-cal">
        ${nextDate
          ? `<div class="vencer-cal-day">${nextDate.getDate()}</div>
             <div class="vencer-cal-month">${MONTHS[nextDate.getMonth()]}</div>`
          : `<div class="vencer-cal-day" style="font-size:var(--text-lg)">?</div>
             <div class="vencer-cal-month">---</div>`
        }
      </div>
      <div class="vencer-info">
        <div class="vencer-name">${esc(loc.name)}</div>
        <div class="vencer-sub">${freqText}${loc.address ? ' · ' + esc(loc.address) : ''}</div>
      </div>
      <span class="vencer-badge ${badgeClass}">${badgeText}</span>
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
  let list = [...checkins].sort((a,b) => b.date.localeCompare(a.date));
  if (currentRegFilter !== 'todos') list = list.filter(c => c.estado === currentRegFilter);
  if (q) list = list.filter(c => getLocName(c.location_id).toLowerCase().includes(q) || (c.notes||'').toLowerCase().includes(q));
  const tbody = document.getElementById('registro-tbody');
  const empty = document.getElementById('registro-empty');
  if (!list.length) { tbody.innerHTML=''; if(empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display = 'none';
  const estadoLabel = {grabado:'Grabado',en_edicion:'En edición',editado:'Editado',publicado:'Publicado'};
  tbody.innerHTML = list.map(ci => {
    const thumb = ytThumb(ci.link);
    const fotoSrc = ci.foto_url || thumb;
    return `<tr>
      <td style="font-weight:600">${esc(getLocName(ci.location_id))}</td>
      <td style="font-family:var(--font-mono);color:var(--color-text-muted)">${fmtDate(ci.date)}</td>
      <td><span class="chip chip-${ci.estado}">${estadoLabel[ci.estado]||ci.estado}</span></td>
      <td>${fotoSrc ? `<img src="${esc(fotoSrc)}" style="height:36px;border-radius:4px;object-fit:cover;cursor:pointer" onclick="window.open('${esc(fotoSrc)}','_blank')" loading="lazy">` : '—'}</td>
      <td style="color:var(--color-text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ci.notes||'')}</td>
      <td>${ci.link ? `<a href="${esc(ci.link)}" target="_blank" rel="noopener" class="text-link">Ver ↗</a>` : ''}</td>
      ${can('edit_loc') ? `<td><div class="td-actions">
        <button class="icon-btn" onclick="openCheckinModal(null,'${ci.id}')" title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" onclick="deleteCheckin('${ci.id}')" title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>` : '<td></td>'}
    </tr>`;
  }).join('');
}

// ─── MI RUTA — TABS ───────────────────────────────────────────
function switchRutaTab(tab, btn) {
  currentRutaTab = tab;
  document.querySelectorAll('.ruta-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ruta-tab-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('ruta-panel-' + tab)?.classList.add('active');
  if (tab==='sugerida') renderRutaSugerida();
  if (tab==='crear')    renderRutaPool();
  if (tab==='semanas')  renderRutaSemanas();
}
function renderRutaAll() { renderRutaSugerida(); renderRutaPool(); renderRutaSemanas(); }

function buildSuggestedRoute() {
  return [...locations].map(loc => {
    const st=locStatus(loc), due=daysUntilDue(loc);
    let score=0;
    if (st==='overdue') score=10000+Math.abs(due)*10;
    else if (st==='soon')  score=5000+(3-(due||0))*100;
    else if (st==='never') score=3000;
    else score=Math.max(0,100-(due||99));
    return {...loc,st,due,score};
  }).sort((a,b) => b.score-a.score);
}

function renderRutaSugerida() {
  const list = document.getElementById('ruta-sugerida-list');
  if (!list) return;
  const suggested = buildSuggestedRoute();
  if (!suggested.length) { list.innerHTML='<div class="empty-state"><h3>Sin locaciones</h3></div>'; return; }
  list.innerHTML = suggested.map((loc,i) => {
    const rankCls = i<3?'rank-critical':i<6?'rank-urgent':'rank-normal';
    let urgencyTxt, urgencyCls;
    if (loc.st==='overdue')    { urgencyTxt=`Vencida hace ${Math.abs(loc.due)}d`; urgencyCls='urgency-critical'; }
    else if (loc.st==='soon')  { urgencyTxt=`Vence en ${loc.due}d`;               urgencyCls='urgency-high'; }
    else if (loc.st==='never') { urgencyTxt='Primera visita';                      urgencyCls='urgency-medium'; }
    else                       { urgencyTxt=`${loc.due}d restantes`;              urgencyCls='urgency-medium'; }
    return `<div class="ruta-sug-item">
      <div class="ruta-sug-rank ${rankCls}">${i+1}</div>
      <div class="ruta-sug-info">
        <div class="ruta-sug-name">${esc(loc.name)}</div>
        <div class="ruta-sug-meta">
          <span class="ruta-sug-urgency ${urgencyCls}">${urgencyTxt}</span>
          <span>Cada ${loc.freq_days}d · ${fmtDate(loc.last_checkin)}</span>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="addToRuta('${loc.id}')">+ Ruta</button>
        ${can('checkin') ? `<button class="btn btn-primary btn-sm" onclick="openCheckinModal('${loc.id}')">Check-in</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderRutaPool() {
  const q = (document.getElementById('ruta-pool-search')?.value||'').toLowerCase();
  const poolList = document.getElementById('ruta-pool-list');
  if (!poolList) return;
  const sorted = [...locations]
    .filter(l => !q || l.name.toLowerCase().includes(q) || (l.address||'').toLowerCase().includes(q))
    .map(l => ({...l,st:locStatus(l),due:daysUntilDue(l)}))
    .sort((a,b) => {
      const order={overdue:0,soon:1,never:2,ok:3};
      return ((order[a.st]??9)-(order[b.st]??9)) || a.name.localeCompare(b.name);
    });
  if (!sorted.length) { poolList.innerHTML='<div style="padding:var(--space-8);text-align:center;color:var(--color-text-faint);font-size:var(--text-sm)">Sin resultados</div>'; return; }
  poolList.innerHTML = sorted.map(loc => {
    const inRuta = rutaSelected.includes(loc.id);
    let stTxt,stCls;
    if (loc.st==='overdue')    {stTxt=`Vencida ${Math.abs(loc.due)}d`;stCls='chip-overdue';}
    else if(loc.st==='soon')   {stTxt=`${loc.due}d p/vencer`;         stCls='chip-soon';}
    else if(loc.st==='never')  {stTxt='Primera visita';                stCls='chip-never';}
    else                       {stTxt=`${loc.due}d restantes`;        stCls='chip-ok';}
    return `<div class="pool-item ${inRuta?'in-ruta':''}" onclick="addToRuta('${loc.id}')">
      <div class="pool-item-main">
        <div class="pool-item-name">${esc(loc.name)}</div>
        <div class="pool-item-meta"><span class="chip ${stCls}">${stTxt}</span>${loc.address?' · '+esc(loc.address):''}</div>
      </div>
      ${inRuta?`<span style="font-size:var(--text-xs);color:var(--color-success)">✓</span>`
        :`<button class="pool-add-btn" onclick="addToRuta('${loc.id}');event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Agregar
          </button>`}
    </div>`;
  }).join('');
}

function renderSelectedOrder() {
  const container = document.getElementById('ruta-selected-order');
  const empty     = document.getElementById('ruta-selected-empty');
  const shareBt   = document.getElementById('ruta-share-btn');
  const countBdg  = document.getElementById('ruta-count-badge');
  if (!container) return;
  if (countBdg) countBdg.textContent = rutaSelected.length;
  if (shareBt)  shareBt.disabled = rutaSelected.length===0;
  container.querySelectorAll('.ruta-order-item').forEach(el => el.remove());
  if (!rutaSelected.length) { if(empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display='none';
  rutaSelected.forEach((id,i) => {
    const loc = locations.find(l=>l.id===id); if (!loc) return;
    const div = document.createElement('div');
    div.className='ruta-order-item';
    div.innerHTML=`<span class="ruta-order-num">${i+1}</span><span class="ruta-order-name">${esc(loc.name)}</span>
      <button class="icon-btn ruta-order-remove" onclick="removeFromRuta('${id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    container.appendChild(div);
  });
}

function addToRuta(id) { if(!rutaSelected.includes(id)) rutaSelected.push(id); renderRutaPool(); renderSelectedOrder(); updateBadges(); }
function removeFromRuta(id) { rutaSelected=rutaSelected.filter(x=>x!==id); renderRutaPool(); renderSelectedOrder(); updateBadges(); }
function clearRuta() { rutaSelected=[]; renderRutaPool(); renderSelectedOrder(); updateBadges(); }

function renderRutaSemanas() {
  const q=( document.getElementById('ruta-search')?.value||'').toLowerCase();
  const filtered=locations.filter(l=>!q||l.name.toLowerCase().includes(q)||(l.address||'').toLowerCase().includes(q));
  const groups={};
  filtered.forEach(loc => {
    const planDate=getPlannedDate(loc), week=startOfWeek(planDate).toISOString().slice(0,10);
    if(!groups[week]) groups[week]=[];
    groups[week].push({...loc,planDate});
  });
  const weeks=Object.keys(groups).sort();
  const timeline=document.getElementById('ruta-timeline');
  const wc=document.getElementById('ruta-weeks-count');
  if(wc) wc.textContent=weeks.length;
  if(!weeks.length){timeline.innerHTML=`<div class="empty-state"><h3>Sin resultados</h3></div>`;return;}
  const currentWeek=startOfWeek(today()).toISOString().slice(0,10);
  timeline.innerHTML=weeks.map(week=>{
    const items=groups[week].sort((a,b)=>a.planDate.localeCompare(b.planDate)||a.name.localeCompare(b.name));
    const sample=items[0], due=daysUntilDue(sample);
    let cls='ok';
    if(week===currentWeek) cls='current';
    else if(due!==null&&due<0) cls='overdue';
    else if(due!==null&&due<=3) cls='soon';
    const weekTitle=formatWeekLabel(new Date(week+'T00:00:00'));
    let meta=week===currentWeek?'<span class="soon">Esta semana</span>':due!==null&&due<0?`<span class="warn">Venció hace ${Math.abs(due)}d</span>`:due!==null&&due<=3?`<span class="soon">Vence en ${due}d</span>`:`<span class="ok">Próximo: ${fmtDate(sample.planDate)}</span>`;
    return `<div class="ruta-week"><span class="ruta-week-marker ${cls}"></span>
      <div class="ruta-week-card">
        <div class="ruta-week-head">
          <div><div class="ruta-week-kicker">${week===currentWeek?'Esta semana':weekTitle.toUpperCase()}</div>
          <div class="ruta-week-title">${items.length===1?esc(items[0].name):items.length+' locaciones'}</div></div>
          <div class="ruta-week-meta">${meta}</div>
        </div>
        <div class="ruta-week-list">${items.map(loc=>{
          const st=locStatus(loc),stText={never:'Primera visita',overdue:'Vencida',soon:'Por vencer',ok:'Al corriente'}[st];
          return `<div class="ruta-item"><div class="ruta-item-main"><div class="ruta-item-name">${esc(loc.name)}</div>
            <div class="ruta-item-sub">${loc.address?esc(loc.address)+' · ':''}${stText} · ${fmtDate(loc.planDate)}</div></div>
            <div class="ruta-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="addToRuta('${loc.id}')">+ Ruta</button>
              <button class="btn btn-ghost btn-sm" onclick="openCheckinModal('${loc.id}')">Check-in</button>
            </div></div>`;
        }).join('')}</div>
      </div></div>`;
  }).join('');
}

function exportRuta(type) {
  let ids=type==='sugerida'?buildSuggestedRoute().slice(0,10).map(l=>l.id):rutaSelected;
  if(!ids.length){showToast('No hay locaciones en la ruta','error');return;}
  const text=ids.map((id,i)=>`${i+1}. ${getLocName(id)}`).join('\n');
  if(navigator.share) navigator.share({title:'Mi ruta',text});
  else navigator.clipboard.writeText(text).then(()=>showToast('Ruta copiada ✓','success'));
}

// ─── RUTA UTILS ───────────────────────────────────────────────
function getPlannedDate(loc) {
  if (!loc.last_checkin) return today();
  const d=new Date(loc.last_checkin+'T00:00:00');
  d.setDate(d.getDate()+(loc.freq_days||15));
  return d.toISOString().slice(0,10);
}
function startOfWeek(dateStr) {
  const d=new Date(dateStr+'T00:00:00'),day=d.getDay();
  d.setDate(d.getDate()-day+(day===0?-6:1));
  return d;
}
function formatWeekLabel(d) {
  const m=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `Semana ${String(d.getDate()).padStart(2,'0')} ${m[d.getMonth()]}`;
}

// ─── CORRIENTE ────────────────────────────────────────────────
function renderCorriente() {
  const ok=locations.filter(l=>locStatus(l)==='ok');
  const grid=document.getElementById('corriente-grid'),empty=document.getElementById('corriente-empty');
  if(!ok.length){grid.innerHTML='';if(empty)empty.style.display='flex';return;}
  if(empty)empty.style.display='none';
  grid.innerHTML=ok.map(loc=>`<div class="corriente-card">
    <div class="corriente-name">${esc(loc.name)}</div>
    <div class="corriente-date">Último: ${fmtDate(loc.last_checkin)}</div>
    <div style="font-size:var(--text-xs);color:var(--color-success)">✓ ${daysUntilDue(loc)}d restantes</div>
  </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// PRODUCCIÓN DE VIDEOS
// ═══════════════════════════════════════════════════════════════

function setVideosFilter(f, btn) {
  currentVideoFilter = f;
  document.querySelectorAll('[data-vfilter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderVideosGrid();
}

function renderVideosGrid() {
  const q    = (document.getElementById('videos-search')?.value || '').toLowerCase();
  const grid = document.getElementById('videos-obra-grid');
  if (!grid) return;

  let locs = locations.filter(l => !q || l.name.toLowerCase().includes(q));

  if (currentVideoFilter === 'pendiente') {
    locs = locs.filter(l => checkins.some(c => c.location_id===l.id && c.estado!=='publicado'));
  } else if (currentVideoFilter === 'publicado') {
    locs = locs.filter(l => checkins.some(c => c.location_id===l.id && c.estado==='publicado'));
  }

  if (!locs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      <h3>Sin obras</h3><p>No hay obras con ese filtro.</p>
    </div>`;
    return;
  }

  grid.innerHTML = locs.map(loc => {
    const locCIs   = checkins.filter(c => c.location_id===loc.id);
    const total    = locCIs.length;
    const grabado  = locCIs.filter(c=>c.estado==='grabado').length;
    const enEd     = locCIs.filter(c=>c.estado==='en_edicion').length;
    const editado  = locCIs.filter(c=>c.estado==='editado').length;
    const publicado= locCIs.filter(c=>c.estado==='publicado').length;

    // Thumbnail: última foto o thumbnail de YouTube
    const withMedia = [...locCIs].sort((a,b)=>b.date.localeCompare(a.date))
      .find(c => c.foto_url || ytThumb(c.link));
    let thumbSrc = withMedia ? (withMedia.foto_url || ytThumb(withMedia.link)) : null;

    const pct = total>0 ? Math.round(publicado/total*100) : 0;

    return `<div class="video-obra-card" onclick="openVideoDetail('${loc.id}')">
      <div class="voc-thumb">
        ${thumbSrc
          ? `<img src="${esc(thumbSrc)}" alt="${esc(loc.name)}" loading="lazy">`
          : `<div class="voc-thumb-placeholder">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
             </div>`}
        ${loc.playlist_url ? `<div class="voc-thumb-playlist">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 12L9 6v12l10.59-6z"/></svg>
          Playlist
        </div>` : ''}
      </div>
      <div class="voc-body">
        <div class="voc-name">${esc(loc.name)}</div>
        <div class="voc-stats">
          ${grabado   ? `<span class="voc-stat"><span class="voc-stat-dot grabado"></span>${grabado} grab.</span>`   : ''}
          ${enEd      ? `<span class="voc-stat"><span class="voc-stat-dot en_edicion"></span>${enEd} edic.</span>`   : ''}
          ${editado   ? `<span class="voc-stat"><span class="voc-stat-dot editado"></span>${editado} listo</span>`   : ''}
          ${publicado ? `<span class="voc-stat"><span class="voc-stat-dot publicado"></span>${publicado} pub.</span>` : ''}
          ${!total    ? `<span class="voc-stat" style="color:var(--color-text-faint)">Sin videos aún</span>`          : ''}
        </div>
        <div class="voc-progress-bar">
          ${total ? `
            <div class="voc-progress-seg" style="width:${grabado/total*100}%;background:var(--color-primary)"></div>
            <div class="voc-progress-seg" style="width:${enEd/total*100}%;background:var(--color-gold)"></div>
            <div class="voc-progress-seg" style="width:${editado/total*100}%;background:var(--color-orange)"></div>
            <div class="voc-progress-seg" style="width:${publicado/total*100}%;background:var(--color-success)"></div>
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openVideoDetail(locId) {
  currentVideoLocId = locId;
  document.getElementById('videos-grid-panel').style.display    = 'none';
  document.getElementById('videos-detail-panel').style.display  = 'block';
  document.getElementById('btn-back-videos').style.display      = 'inline-flex';
  renderVideoDetail(locId);
}

function closeVideoDetail() {
  currentVideoLocId = null;
  document.getElementById('videos-grid-panel').style.display    = 'block';
  document.getElementById('videos-detail-panel').style.display  = 'none';
  document.getElementById('btn-back-videos').style.display      = 'none';
}

function renderVideoDetail(locId) {
  const loc     = locations.find(l => l.id === locId);
  if (!loc) return;
  const locCIs  = checkins.filter(c => c.location_id===locId).sort((a,b) => b.date.localeCompare(a.date));
  const total   = locCIs.length;
  const grabado = locCIs.filter(c=>c.estado==='grabado').length;
  const enEd    = locCIs.filter(c=>c.estado==='en_edicion').length;
  const editado = locCIs.filter(c=>c.estado==='editado').length;
  const pub     = locCIs.filter(c=>c.estado==='publicado').length;

  // Header
  document.getElementById('video-detail-title').textContent = loc.name;
  document.getElementById('video-detail-meta').innerHTML = [
    loc.address    ? `<span class="vd-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${esc(loc.address)}</span>` : '',
    loc.responsable? `<span class="vd-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${esc(loc.responsable)}</span>` : '',
    `<span class="vd-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>${total} check-in${total!==1?'s':''}</span>`,
  ].filter(Boolean).join('');

  // Playlist destacada
  const playlistEl = document.getElementById('video-detail-playlist');
  playlistEl.innerHTML = loc.playlist_url
    ? `<a href="${esc(loc.playlist_url)}" target="_blank" rel="noopener">
         <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 12L9 6v12l10.59-6z"/></svg>
         Ver playlist completa
       </a>`
    : `<button class="btn btn-ghost btn-sm" onclick="openLocModal('${loc.id}')">
         + Agregar playlist
       </button>`;

  // Stats
  document.getElementById('video-detail-stats').innerHTML = `
    <div class="vds-card"><div class="vds-num" style="color:var(--color-primary)">${grabado}</div><div class="vds-label">Grabados</div></div>
    <div class="vds-card"><div class="vds-num" style="color:var(--color-gold)">${enEd}</div><div class="vds-label">En edición</div></div>
    <div class="vds-card"><div class="vds-num" style="color:var(--color-orange)">${editado}</div><div class="vds-label">Editados</div></div>
    <div class="vds-card"><div class="vds-num" style="color:var(--color-success)">${pub}</div><div class="vds-label">Publicados</div></div>
    <div class="vds-card"><div class="vds-num">${total}</div><div class="vds-label">Total</div></div>
  `;

  // Lista de check-ins
  const listEl = document.getElementById('video-checkins-list');
  if (!locCIs.length) {
    listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      <h3>Sin grabaciones aún</h3>
      <p>Haz el primer check-in de esta obra.</p>
      <button class="btn btn-primary" onclick="openCheckinModal('${loc.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo check-in
      </button>
    </div>`;
    return;
  }

  const estados = [
    { key:'grabado',    label:'Grabado' },
    { key:'en_edicion', label:'En edición' },
    { key:'editado',    label:'Editado' },
    { key:'publicado',  label:'Publicado' },
  ];

  listEl.innerHTML = locCIs.map(ci => {
    const thumb   = ytThumb(ci.link);
    const fotoSrc = ci.foto_url || thumb;
    return `<div class="video-ci-card" id="ci-card-${ci.id}">
      <div class="video-ci-body">
        <div class="video-ci-foto">
          ${fotoSrc
            ? `<img src="${esc(fotoSrc)}" alt="foto" loading="lazy" onclick="window.open('${esc(fotoSrc)}','_blank')" style="cursor:pointer">`
            : `<div class="video-ci-foto-placeholder">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
               </div>`}
        </div>
        <div class="video-ci-content">
          <div class="video-ci-top">
            <span class="video-ci-date">${fmtDate(ci.date)}</span>
            ${can('edit_loc') ? `<button class="icon-btn" onclick="openCheckinModal(null,'${ci.id}')" title="Editar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>` : ''}
          </div>
          ${ci.notes ? `<div class="video-ci-notes">${esc(ci.notes)}</div>` : ''}
          <div class="video-ci-bottom">
            <div class="estado-selector" id="estado-sel-${ci.id}">
              ${estados.map(e => `
                <button
                  class="estado-btn ${ci.estado===e.key?'active-'+e.key:''}"
                  onclick="updateCheckinEstado('${ci.id}','${e.key}',this)"
                  title="${e.label}"
                  ${!can('change_estado') ? 'disabled style="opacity:.5;cursor:default;pointer-events:none"' : ''}
                >${e.label}</button>
              `).join('')}
            </div>
            <div class="video-ci-link">
              ${ci.link ? `<a href="${esc(ci.link)}" target="_blank" rel="noopener">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                Ver video
              </a>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Actualizar estado de video inline ─────────────────────────
async function updateCheckinEstado(ciId, nuevoEstado, btnEl) {
  if (!can('change_estado')) { showToast('Sin permisos para cambiar estado', 'error'); return; }
  const ci = checkins.find(c => c.id === ciId);
  if (!ci || ci.estado === nuevoEstado) return;

  // Mostrar spinner en botón activo
  const sel = document.getElementById('estado-sel-' + ciId);
  if (sel) {
    sel.querySelectorAll('.estado-btn').forEach(b => b.disabled = true);
    btnEl.innerHTML = btnEl.innerHTML + ' <span class="saving-spin"></span>';
  }

  if (USE_SUPABASE) {
    const { error } = await sb.from('checkins')
      .update({ estado: nuevoEstado })
      .eq('id', ciId);
    if (error) {
      showToast('Error guardando: ' + error.message, 'error');
      if (sel) sel.querySelectorAll('.estado-btn').forEach(b => b.disabled = false);
      return;
    }
  }

  // Actualizar estado local
  ci.estado = nuevoEstado;

  // Re-renderizar solo esa tarjeta de check-in y los badges
  updateBadges();
  if (currentVideoLocId) renderVideoDetail(currentVideoLocId);
  renderVideosGrid();
  showToast(`Estado actualizado: ${nuevoEstado}`, 'success');
}

// ─── MODALS: LOCACIÓN ─────────────────────────────────────────
function openLocModal(id) {
  if (!can('edit_loc')) { showToast('Modo lectura — sin permisos para editar', 'error'); return; }
  const isEdit = !!id;
  document.getElementById('modal-loc-title').textContent = isEdit ? 'Editar locación' : 'Nueva locación';
  if (isEdit) {
    const loc = locations.find(l => l.id===id); if (!loc) return;
    document.getElementById('loc-id').value          = loc.id;
    document.getElementById('loc-name').value        = loc.name;
    document.getElementById('loc-responsable').value = loc.responsable||'';
    document.getElementById('loc-freq').value        = loc.freq_days;
    document.getElementById('loc-address').value     = loc.address||'';
    document.getElementById('loc-notion').value      = loc.link_notion||'';
    document.getElementById('loc-playlist').value    = loc.playlist_url||'';
  } else {
    ['loc-id','loc-name','loc-responsable','loc-address','loc-notion','loc-playlist'].forEach(id => document.getElementById(id).value='');
    document.getElementById('loc-freq').value = 15;
  }
  openModal('modal-loc');
}

async function saveLoc() {
  if (!can('edit_loc')) { showToast('Sin permisos para editar locaciones', 'error'); return; }
  const id   = document.getElementById('loc-id').value;
  const name = document.getElementById('loc-name').value.trim();
  const freq = parseInt(document.getElementById('loc-freq').value);
  if (!name)       { showToast('El nombre es obligatorio','error'); return; }
  if (!freq||freq<1) { showToast('La frecuencia debe ser ≥ 1 día','error'); return; }
  const obj = {
    id: id||genId(), name,
    responsable:  document.getElementById('loc-responsable').value.trim(),
    freq_days:    freq,
    address:      document.getElementById('loc-address').value.trim(),
    link_notion:  document.getElementById('loc-notion').value.trim(),
    playlist_url: document.getElementById('loc-playlist').value.trim(),
    last_checkin: id ? (locations.find(l=>l.id===id)||{}).last_checkin : null,
    created_at:   id ? (locations.find(l=>l.id===id)||{}).created_at   : new Date().toISOString(),
  };
  if (USE_SUPABASE) {
    const { error } = await sb.from('locations').upsert(obj);
    if (error) { showToast('Error: '+error.message,'error'); return; }
  }
  const idx = locations.findIndex(l=>l.id===obj.id);
  if (idx>-1) locations[idx]=obj; else locations.push(obj);
  closeModal('modal-loc');
  renderAll();
  showToast(id?'Locación actualizada':'Locación creada','success');
}

// ─── FOTO UPLOAD ──────────────────────────────────────────────
const STORAGE_BUCKET = 'checkin-fotos';
let _fotoFile        = null;
let _fotoPreviewUrl  = null;

function setupFotoPreview() {
  const fileInput = document.getElementById('ci-foto-file');
  const dropArea  = document.getElementById('ci-foto-drop');
  if (!fileInput || !dropArea) return;

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) setFotoFile(file);
  });

  dropArea.addEventListener('dragover',  e => { e.preventDefault(); dropArea.classList.add('dragging'); });
  dropArea.addEventListener('dragleave', ()=> dropArea.classList.remove('dragging'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault(); dropArea.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) setFotoFile(file);
  });
}

function setFotoFile(file) {
  if (file.size > 5 * 1024 * 1024) { showToast('La foto no debe superar 5 MB', 'error'); return; }
  _fotoFile = file;
  const reader = new FileReader();
  reader.onload = e => { _fotoPreviewUrl = e.target.result; showFotoPreview(_fotoPreviewUrl); };
  reader.readAsDataURL(file);
}

function showFotoPreview(src) {
  const ph  = document.getElementById('ci-foto-placeholder');
  const img = document.getElementById('ci-foto-preview');
  const rm  = document.getElementById('ci-foto-remove');
  if (!img) return;
  img.src = src; img.style.display = 'block';
  if (ph) ph.style.display  = 'none';
  if (rm) rm.style.display  = 'inline-flex';
}

function removeFoto() {
  _fotoFile = null; _fotoPreviewUrl = null;
  document.getElementById('ci-foto-url').value       = '';
  const img = document.getElementById('ci-foto-preview');
  if (img) { img.src=''; img.style.display='none'; }
  const ph = document.getElementById('ci-foto-placeholder');
  if (ph) ph.style.display = 'flex';
  const rm = document.getElementById('ci-foto-remove');
  if (rm) rm.style.display = 'none';
  const fi = document.getElementById('ci-foto-file');
  if (fi) fi.value = '';
}

function resetFotoUI() {
  _fotoFile = null; _fotoPreviewUrl = null;
  const img = document.getElementById('ci-foto-preview');
  if (img) { img.src=''; img.style.display='none'; }
  const ph = document.getElementById('ci-foto-placeholder');
  if (ph) ph.style.display = 'flex';
  const rm = document.getElementById('ci-foto-remove');
  if (rm) rm.style.display = 'none';
  const fi = document.getElementById('ci-foto-file');
  if (fi) fi.value = '';
  const hu = document.getElementById('ci-foto-url');
  if (hu) hu.value = '';
}

async function uploadFotoToSupabase(file, checkinId) {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${checkinId}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── MODALS: CHECK-IN ─────────────────────────────────────────
function openCheckinModal(locId, ciId) {
  if (!can('checkin')) { showToast('Modo lectura — sin permisos para check-ins', 'error'); return; }
  const sel = document.getElementById('ci-loc');
  sel.innerHTML = '<option value="">— Selecciona —</option>' +
    locations.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('');

  resetFotoUI();

  if (ciId) {
    const ci = checkins.find(c=>c.id===ciId); if (!ci) return;
    document.getElementById('modal-checkin-title').textContent = 'Editar check-in';
    document.getElementById('ci-id').value     = ci.id;
    sel.value = ci.location_id;
    document.getElementById('ci-date').value   = ci.date;
    document.getElementById('ci-estado').value = ci.estado;
    document.getElementById('ci-link').value   = ci.link||'';
    document.getElementById('ci-notes').value  = ci.notes||'';
    if (ci.foto_url) {
      document.getElementById('ci-foto-url').value = ci.foto_url;
      showFotoPreview(ci.foto_url);
    }
  } else {
    document.getElementById('modal-checkin-title').textContent = 'Nuevo check-in';
    document.getElementById('ci-id').value = '';
    if (locId) sel.value = locId;
    document.getElementById('ci-date').value   = today();
    document.getElementById('ci-estado').value = 'grabado';
    document.getElementById('ci-link').value   = '';
    document.getElementById('ci-notes').value  = '';
  }
  openModal('modal-checkin');
}

async function saveCheckin() {
  if (!can('checkin')) { showToast('Sin permisos para registrar check-ins', 'error'); return; }
  const id    = document.getElementById('ci-id').value;
  const locId = document.getElementById('ci-loc').value;
  const date  = document.getElementById('ci-date').value;
  const estado= document.getElementById('ci-estado').value;
  if (!locId) { showToast('Selecciona una locación','error'); return; }
  if (!date)  { showToast('La fecha es obligatoria','error'); return; }

  const checkinId = id || genId();
  let foto_url = document.getElementById('ci-foto-url').value || null;

  // Subir foto si hay archivo nuevo seleccionado
  if (_fotoFile && USE_SUPABASE) {
    // Mostrar overlay de subida
    const dropArea = document.getElementById('ci-foto-drop');
    const overlay  = document.createElement('div');
    overlay.className = 'foto-uploading';
    overlay.innerHTML = '<span class="foto-uploading-text"><span class="saving-spin"></span> Subiendo foto…</span>';
    if (dropArea) dropArea.appendChild(overlay);
    try {
      foto_url = await uploadFotoToSupabase(_fotoFile, checkinId);
    } catch(e) {
      if (dropArea) overlay.remove();
      showToast('Error subiendo foto: ' + e.message, 'error');
      return;
    }
    if (dropArea) overlay.remove();
  } else if (_fotoFile && !USE_SUPABASE) {
    // Modo offline: usar data URL (no persiste entre sesiones, pero funciona)
    foto_url = _fotoPreviewUrl;
  }

  const obj = {
    id: checkinId, location_id: locId, date, estado,
    foto_url,
    link:   document.getElementById('ci-link').value.trim()||null,
    notes:  document.getElementById('ci-notes').value.trim()||null,
    created_at: id?(checkins.find(c=>c.id===id)||{}).created_at:new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const { error } = await sb.from('checkins').upsert(obj);
    if (error) { showToast('Error: '+error.message,'error'); return; }
    updateLastCheckins();
    const loc = locations.find(l=>l.id===locId);
    if (loc) await sb.from('locations').update({last_checkin:loc.last_checkin}).eq('id',locId);
  }

  const idx = checkins.findIndex(c=>c.id===obj.id);
  if (idx>-1) checkins[idx]=obj; else checkins.push(obj);
  updateLastCheckins();
  closeModal('modal-checkin');
  renderAll();
  if (currentVideoLocId===locId) renderVideoDetail(locId);
  showToast(id?'Check-in actualizado':'Check-in registrado ✓','success');
}

// ─── DELETE ───────────────────────────────────────────────────
function deleteLoc(id) {
  if (!can('delete_loc')) { showToast('Solo el admin puede eliminar locaciones', 'error'); return; }
  const loc=locations.find(l=>l.id===id);
  confirmDialog(`Eliminar "${loc?.name}"`, '¿Seguro? Se eliminarán también sus check-ins.', async () => {
    if (USE_SUPABASE) {
      const {error}=await sb.from('locations').delete().eq('id',id);
      if (error) { showToast('Error: '+error.message,'error'); return; }
    }
    locations=locations.filter(l=>l.id!==id);
    checkins =checkins.filter(c=>c.location_id!==id);
    rutaSelected=rutaSelected.filter(x=>x!==id);
    renderAll();
    showToast('Locación eliminada','success');
  });
}
function deleteCheckin(id) {
  if (!can('delete_loc')) { showToast('Solo el admin puede eliminar registros', 'error'); return; }
  confirmDialog('Eliminar check-in','¿Eliminar este registro?', async () => {
    if (USE_SUPABASE) {
      const {error}=await sb.from('checkins').delete().eq('id',id);
      if (error) { showToast('Error: '+error.message,'error'); return; }
    }
    checkins=checkins.filter(c=>c.id!==id);
    updateLastCheckins();
    renderAll();
    showToast('Check-in eliminado','success');
  });
}

// ─── EXPORT CSV ───────────────────────────────────────────────
function exportCSV(type) {
  let rows, filename;
  if (type==='locaciones') {
    rows=[['Nombre','Dirección','Responsable','Frecuencia','Último check-in','Estado','Playlist']];
    locations.forEach(l=>rows.push([l.name,l.address||'',l.responsable||'',l.freq_days,l.last_checkin||'',locStatus(l),l.playlist_url||'']));
    filename=`locaciones-${today()}.csv`;
  } else {
    rows=[['Locación','Fecha','Estado','Foto URL','Notas','Link']];
    checkins.sort((a,b)=>b.date.localeCompare(a.date)).forEach(c=>rows.push([getLocName(c.location_id),c.date,c.estado,c.foto_url||'',c.notes||'',c.link||'']));
    filename=`registro-${today()}.csv`;
  }
  const csv =rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast(`${filename} descargado`,'success');
}

// ─── NAVIGATION ───────────────────────────────────────────────
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+viewId)?.classList.add('active');
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');
  if (viewId==='videos' && !currentVideoLocId) renderVideosGrid();
  if (window.innerWidth<=768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  }
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

// ─── MODAL UTILS ──────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeOnOverlay(e,id) { if(e.target===e.currentTarget) closeModal(id); }
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open,.confirm-overlay.open').forEach(el=>el.classList.remove('open'));
});

let confirmCallback=null;
function confirmDialog(title,msg,cb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  confirmCallback=cb;
  document.getElementById('confirm-overlay').classList.add('open');
  document.getElementById('confirm-ok-btn').onclick=()=>{closeConfirm();cb();};
}
function closeConfirm(){document.getElementById('confirm-overlay').classList.remove('open');confirmCallback=null;}

// ─── THEME TOGGLE ─────────────────────────────────────────────
function setupThemeToggle() {
  const btn=document.querySelector('[data-theme-toggle]'); if(!btn) return;
  const html=document.documentElement;
  let dark=html.getAttribute('data-theme')==='dark';
  const upd=()=>{
    btn.innerHTML=dark
      ?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      :'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.setAttribute('aria-label',dark?'Cambiar a modo claro':'Cambiar a modo oscuro');
  };
  upd();
  btn.addEventListener('click',()=>{dark=!dark;html.setAttribute('data-theme',dark?'dark':'light');upd();});
}

// ─── SW UPDATE ────────────────────────────────────────────────
function applyUpdate() {
  if (window.__newWorker) {
    window.__newWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    location.reload();
  }
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg,type='info'){
  const icons={
    success:'<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error:  '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:   '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  const t=document.createElement('div');
  t.className=`toast toast-${type}`;
  t.innerHTML=(icons[type]||icons.info)+`<span>${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(()=>{t.classList.add('exit');setTimeout(()=>t.remove(),250);},3500);
}
