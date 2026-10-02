/* ================================================================
   NEXUS · núcleo
   1. utilidades   2. iconos   3. store + persistencia   4. seed
   ================================================================ */
'use strict';

const App = {};
window.NEXUS = App;   // superficie de depuración / verificación

/* El modulo de nube (09-cloud.js) se ensambla justo despues de este bloque y
   se engancha aqui, de modo que NEXUS.cloud siempre apunta al objeto real. */
Object.defineProperty(App, 'cloud', {
  get: () => window.NEXUS_CLOUD,
  configurable: true
});

/* ---------- 1. utilidades ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pad2 = n => String(n).padStart(2, '0');

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const debounce = (fn, ms = 180) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* fechas en ISO local (evita el shift de toISOString con UTC) */
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => ymd(new Date());
const parseYMD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; };

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_C = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_C = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

function fmtFecha(iso, opts = {}) {
  if (!iso) return '—';
  const d = parseYMD(iso), hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((d - hoy) / 864e5);
  if (diff === 0 && !opts.force) return 'Hoy';
  if (diff === 1 && !opts.force) return 'Mañana';
  if (diff === -1 && !opts.force) return 'Ayer';
  if (Math.abs(diff) < 7 && !opts.force) return `${DIAS_C[(d.getDay() + 6) % 7]} ${pad2(d.getDate())}`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${pad2(d.getDate())} ${sameYear ? '' : d.getFullYear() + ' '} de ${MESES_C[d.getMonth()].toLowerCase()}`;
}
const fmtFechaLarga = iso => {
  if (!iso) return '—';
  const d = parseYMD(iso);
  return `${DIAS_C[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES_C[d.getMonth()].toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ' de ' + d.getFullYear() : ''}`;
};
function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'ahora mismo';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  if (d < 31) return `hace ${Math.floor(d / 7)} sem`;
  return `hace ${Math.floor(d / 30)} mes${Math.floor(d / 30) > 1 ? 'es' : ''}`;
}
const hhmm = t => (t || '00:00');
function relDia(iso) {
  if (!iso) return null;
  const d = parseYMD(iso), hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((d - hoy) / 864e5);
  if (diff < 0) return { txt: 'Vencida', late: true };
  if (diff === 0) return { txt: 'Hoy', late: false };
  if (diff === 1) return { txt: 'Mañana', late: false };
  return { txt: fmtFecha(iso), late: false };
}
function initials(s = '') {
  return s.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
const clampPct = n => clamp(Math.round(Number(n) || 0), 0, 100);

/* ---------- 2. iconos SVG (stroke, hereda currentColor) ---------- */
const I = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  dashboard: I('<rect x="3" y="3" width="7.5" height="8.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.6"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.6"/><rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6"/>'),
  today: I('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>'),
  calendar: I('<rect x="3" y="5" width="18" height="16" rx="2.2"/><path d="M3 9.6h18M8 3v4M16 3v4"/>'),
  tasks: I('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M3.5 6.4l1.2 1.2 2-2M3.5 11.9l1.2 1.2 2-2M3.5 17.4l1.2 1.2 2-2"/>'),
  projects: I('<rect x="3" y="4" width="5.2" height="16" rx="1.6"/><rect x="9.9" y="4" width="5.2" height="10.5" rx="1.6"/><rect x="16.8" y="4" width="4.2" height="7" rx="1.6"/>'),
  notes: I('<path d="M5 3.5h9.5L19 8v12.5H5z"/><path d="M14 3.5V8h5M8.5 12.5h7M8.5 16h4.5"/>'),
  stats: I('<path d="M3.5 20.5h17"/><rect x="5" y="12" width="3.6" height="6" rx="1"/><rect x="10.4" y="7.5" width="3.6" height="10.5" rx="1"/><rect x="15.8" y="10" width="3.6" height="8" rx="1"/>'),
  settings: I('<circle cx="12" cy="12" r="2.9"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a1.94 1.94 0 1 1-3.88 0v-.1A1.6 1.6 0 0 0 9.3 19.3a1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.75-2.75l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a1.94 1.94 0 1 1 0-3.88h.1a1.6 1.6 0 0 0 1.47-1.03 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.75-2.75l.06.06a1.6 1.6 0 0 0 1.77.32h.08A1.6 1.6 0 0 0 9.82 3.1V3a1.94 1.94 0 1 1 3.88 0v.1a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97H21a1.94 1.94 0 1 1 0 3.88h-.1a1.6 1.6 0 0 0-1.47.97z"/>'),
  search: I('<circle cx="10.8" cy="10.8" r="6.6"/><path d="M15.7 15.7 20.4 20.4"/>'),
  bell: I('<path d="M17.6 10.4a5.6 5.6 0 1 0-11.2 0c0 5-2 6.4-2 6.4h15.2s-2-1.4-2-6.4"/><path d="M13.7 20.2a2 2 0 0 1-3.4 0"/>'),
  plus: I('<path d="M12 5.5v13M5.5 12h13"/>'),
  x: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  check: I('<path d="M20 6.5 9.4 17.2 4 11.9"/>'),
  edit: I('<path d="M16.9 3.9a2.1 2.1 0 0 1 3 3L8.4 18.4l-4 1 1-4z"/>'),
  trash: I('<path d="M3.8 6.4h16.4M8.6 6.4V4.6a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6v1.8M18.4 6.4l-.8 13a1.6 1.6 0 0 1-1.6 1.5H8a1.6 1.6 0 0 1-1.6-1.5l-.8-13"/>'),
  clock: I('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>'),
  flag: I('<path d="M5 21.5V4.2M5 4.2h11.5l-1.8 4.2 1.8 4.2H5"/>'),
  star: I('<path d="m12 3.6 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 17.1l-5.3 2.79 1.01-5.9-4.29-4.18 5.93-.86z"/>'),
  pin: I('<path d="M12 17v4.5M8 3.5h8l-1 5.5 2.5 3v1.5H6.5V12l2.5-3z"/>'),
  folder: I('<path d="M3.5 6.8A1.8 1.8 0 0 1 5.3 5h3.4l2 2.6h7.9a1.8 1.8 0 0 1 1.8 1.8v8.4a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8z"/>'),
  left: I('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  menu: I('<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>'),
  right: I('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  up: I('<path d="M5.5 14.5 12 8l6.5 6.5"/>'),
  down: I('<path d="M5.5 9.5 12 16l6.5-6.5"/>'),
  fire: I('<path d="M12 22c3.9 0 6.5-2.6 6.5-6.2 0-4.6-4.4-6.4-3.6-11.3-2.6.7-4.4 3.1-4.4 5.6 0 1.4-.8 2-1.6 2-1 0-1.7-.9-1.6-2.4C6 11 5.5 13.2 5.5 15.8 5.5 19.4 8.1 22 12 22Z"/>'),
  zap: I('<path d="M13.2 2.5 4.5 13.4h5.6l-.8 8.1 8.9-11.1h-5.7z"/>'),
  target: I('<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>'),
  layers: I('<path d="m12 2.8 9 4.7-9 4.7-9-4.7z"/><path d="m3 12.5 9 4.7 9-4.7M3 17.2l9 4.7 9-4.7"/>'),
  users: I('<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16.5 5.1a3.4 3.4 0 0 1 0 5.8M17.6 14.4a6.2 6.2 0 0 1 3.6 5.6"/>'),
  book: I('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M4 17h15"/>'),
  palette: I('<path d="M12 3a9 9 0 1 0 0 18c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.6a4.6 4.6 0 0 0 4.6-4.6C20.6 6 16.7 3 12 3Z"/><circle cx="7.8" cy="11.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.6" cy="8.8" r="1.1" fill="currentColor" stroke="none"/>'),
  moon: I('<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z"/>'),
  cloud: I('<path d="M7.2 18.5a4.7 4.7 0 0 1-.4-9.4 5.8 5.8 0 0 1 11.1 1.5 4 4 0 0 1-.7 7.9z"/>'),
  volume: I('<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z"/><path d="M15.6 9.4a3.6 3.6 0 0 1 0 5.2M18.2 6.6a7.3 7.3 0 0 1 0 10.8"/>'),
  grid: I('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>'),
  list: I('<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12M3.6 6.5h.01M3.6 12h.01M3.6 17.5h.01"/>'),
  move: I('<path d="M12 3.5v17M3.5 12h17M9 6.5 12 3.5l3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3"/>'),
  sparkle: I('<path d="m12 2.8 1.9 5.3 5.3 1.9-5.3 1.9L12 17.2l-1.9-5.3-5.3-1.9 5.3-1.9z"/><path d="M18.6 16.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
  refresh: I('<path d="M20.4 11.6a8.4 8.4 0 1 0-1.2 5.4"/><path d="M20.6 5.4v5.4h-5.4"/>'),
  arrowUp: I('<path d="M12 20V4M5.5 10.5 12 4l6.5 6.5"/>'),
  arrowDown: I('<path d="M12 4v16M5.5 13.5 12 20l6.5-6.5"/>'),
  tag: I('<path d="M11.6 3.5H20v8.4l-8.9 8.9a1.6 1.6 0 0 1-2.3 0l-6.1-6.1a1.6 1.6 0 0 1 0-2.3z"/><circle cx="16.4" cy="7.6" r="1.3"/>'),
  filter: I('<path d="M3.5 5.5h17l-6.6 7.8V20l-3.8-2.3v-4.4z"/>'),
  lock: I('<rect x="4.8" y="10.5" width="14.4" height="10" rx="2"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/>'),
  eye: I('<path d="M1.8 12S5.4 5.6 12 5.6 22.2 12 22.2 12 18.6 18.4 12 18.4 1.8 12 1.8 12Z"/><circle cx="12" cy="12" r="3.1"/>'),
  download: I('<path d="M12 3.5v12M7 10.8l5 5 5-5M4 20.5h16"/>'),
  upload: I('<path d="M12 20.5v-12M7 12.7l5-5 5 5M4 3.5h16"/>'),
  coffee: I('<path d="M4 8.5h13v6.1a4.4 4.4 0 0 1-4.4 4.4H8.4A4.4 4.4 0 0 1 4 14.6z"/><path d="M17 10h1.6a2.4 2.4 0 0 1 0 4.8H17M6.5 3v2.2M10 2.6v2.6M13.5 3v2.2"/>'),
  bug: I('<path d="M8 6.5a4 4 0 0 1 8 0"/><rect x="6.5" y="6.5" width="11" height="12.5" rx="5.5"/><path d="M3.2 11h3.3M3.2 16h3.3M17.5 11h3.3M17.5 16h3.3M4.6 6.5 6.4 8M19.4 6.5 17.6 8M4.6 19.5l1.8-1.5M19.4 19.5l-1.8-1.5"/>'),
};
const icon = (n, cls = '') => ICON[n] ? ICON[n].replace('<svg ', `<svg class="${cls}" `) : '';

/* ---------- 3. store + persistencia ---------- */
const KEY = 'nexus.v1';
const DEFAULTS = {
  blur: 18, scale: 100, animations: true, sound: false,
  oled: true, density: 'normal', accent: 'blue', collapsed: false,
  greetingName: 'Jesús'
};

const DB = App.db = {
  tasks: [], events: [], projects: [], notes: [], activity: [], notifications: [],
  settings: { ...DEFAULTS }
};

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { console.warn('[nexus] persistencia falló', e); }
    // si hay nube conectada, se sube el cambio (debounced dentro de autosync)
    if (window.CLOUD && CLOUD.session) CLOUD.autosync();
  }, 140);
}
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { console.warn(e); }
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    ['tasks', 'events', 'projects', 'notes', 'activity', 'notifications'].forEach(k => {
      if (Array.isArray(data[k])) DB[k] = data[k];
    });
    if (data.settings) DB.settings = { ...DEFAULTS, ...data.settings };
    return true;
  } catch (e) {
    console.warn('[nexus] datos corruptos, se regeneran', e);
    return false;
  }
}

/* ---------- 4. datos semilla ---------- */
const CATS = ['Diseño', 'Desarrollo', 'Cliente', 'Personal', 'Salud', 'Estudio', 'Finanzas'];
const TAGSET = ['urgent', 'revisión', 'idea', 'cliente', 'interno', 'rápido', 'bloqueado'];

function seed() {
  const t = todayISO(), d = n => ymd(addDays(new Date(), n));
  const now = Date.now(), H = 3600e3;

  DB.settings = { ...DEFAULTS };

  DB.tasks = [
    { id: uid('t'), title: 'Revisar maqueta del dashboard de Luci', desc: 'Comprobar jerarquía visual y estados vacíos antes de la entrega del viernes.', prio: 'alta', cat: 'Diseño', date: t, time: '10:00', done: false, pct: 60, tags: ['cliente', 'revisión'], fav: true, created: now - 26 * H, due: t, notes: '' },
    { id: uid('t'), title: 'Llamar con el taller de la rueda trasera', desc: 'Preguntar por presupuesto y plazo de entrega.', prio: 'alta', cat: 'Personal', date: t, time: '13:30', done: false, pct: 0, tags: ['rápido'], fav: false, created: now - 5 * H, due: t, notes: '' },
    { id: uid('t'), title: 'Escribir documentación del endpoint /sync', desc: 'Falta cubrir los códigos de error y los límites de paginación.', prio: 'media', cat: 'Desarrollo', date: t, time: '16:00', done: false, pct: 25, tags: ['interno'], fav: false, created: now - 3 * H, due: t, notes: '' },
    { id: uid('t'), title: 'Pasear 30 minutos', desc: 'Ruta corta por el paseo de la Ribera.', prio: 'baja', cat: 'Salud', date: t, time: '20:00', done: false, pct: 0, tags: [], fav: false, created: now - 2 * H, due: t, notes: '' },
    { id: uid('t'), title: 'Preparar la agenda de la reunión de mañana', desc: 'Tres decisiones pendientes sobre el alcance del rediseño.', prio: 'media', cat: 'Cliente', date: t, time: null, done: true, pct: 100, tags: ['cliente'], fav: false, created: now - 30 * H, due: t, notes: '' },
    { id: uid('t'), title: 'Facturar la segunda entrega', desc: '', prio: 'media', cat: 'Finanzas', date: d(-1), time: null, done: true, pct: 100, tags: [], fav: true, created: now - 74 * H, due: d(-1), notes: '' },
    { id: uid('t'), title: 'Migrar los estilos a variables CSS', desc: 'Sustituir colores hardcodeados por tokens en los componentes del panel.', prio: 'media', cat: 'Desarrollo', date: d(1), time: '09:30', done: false, pct: 40, tags: ['interno'], fav: false, created: now - 20 * H, due: d(1), notes: '' },
    { id: uid('t'), title: 'Cerrar el presupuesto del curso', desc: '', prio: 'alta', cat: 'Finanzas', date: d(2), time: null, done: false, pct: 10, tags: ['urgent'], fav: false, created: now - 40 * H, due: d(2), notes: '' },
    { id: uid('t'), title: 'Leer capítulo 7 de "Refactoring UI"', desc: '', prio: 'baja', cat: 'Estudio', date: d(3), time: null, done: false, pct: 0, tags: [], fav: false, created: now - 60 * H, due: d(3), notes: '' },
    { id: uid('t'), title: 'Renovar el seguro del coche', desc: 'Comparar tres pólizas antes de decidir.', prio: 'media', cat: 'Personal', date: d(5), time: null, done: false, pct: 0, tags: [], fav: false, created: now - 90 * H, due: d(5), notes: '' },
    { id: uid('t'), title: 'Auditar la tienda de la peluquería', desc: 'Revisar kilos, tráfico y colores en móvil.', prio: 'baja', cat: 'Cliente', date: d(4), time: null, done: false, pct: 65, tags: ['cliente'], fav: false, created: now - 48 * H, due: d(4), notes: '' },
    { id: uid('t'), title: 'Backup del portátil', desc: '', prio: 'baja', cat: 'Personal', date: d(-2), time: null, done: true, pct: 100, tags: [], fav: false, created: now - 100 * H, due: d(-2), notes: '' },
  ];

  DB.events = [
    { id: uid('e'), title: 'Daily con el equipo de Luci', date: t, time: '09:30', dur: 30, color: 'accent', notes: 'Bloque de trabajo profundo' },
    { id: uid('e'), title: 'Comida con Marta', date: t, time: '14:00', dur: 90, color: 'mint', notes: 'Mesón de la Alameda' },
    { id: uid('e'), title: 'Gimnasio', date: t, time: '19:00', dur: 60, color: 'warn', notes: '' },
    { id: uid('e'), title: 'Revisión de sprint', date: d(1), time: '11:00', dur: 60, color: 'accent-2', notes: 'Traer métricas de la semana' },
    { id: uid('e'), title: 'Cena de aniversario', date: d(2), time: '21:00', dur: 150, color: 'bad', notes: 'Reservado' },
    { id: uid('e'), title: 'Dentista', date: d(4), time: '08:15', dur: 45, color: 'info', notes: 'Traer la última radiografía' },
    { id: uid('e'), title: 'Demo del rediseño a Floristería Bellido', date: d(5), time: '17:30', dur: 60, color: 'accent', notes: 'Presentación en pantalla' },
    { id: uid('e'), title: 'Paseo por la Sierra', date: d(6), time: '10:00', dur: 180, color: 'mint', notes: '' },
    { id: uid('e'), title: 'Entrega de la segunda entrega', date: d(-1), time: '17:00', dur: 30, color: 'ok', notes: '' },
  ];

  DB.projects = [
    { id: uid('p'), title: 'Rediseño web Luci', desc: 'Rehacer la tienda completa con un sistema de componentes propio.', prio: 'alta', col: 'doing', pct: 68, due: d(9), tags: ['cliente'], created: now - 22 * 24 * H },
    { id: uid('p'), title: 'Sincronización offline', desc: 'Cola de operaciones y resolución de conflictos en el cliente.', prio: 'alta', col: 'doing', pct: 35, due: d(16), tags: [], created: now - 12 * 24 * H },
    { id: uid('p'), title: 'Panel de analítica', desc: 'Métricas de conversión por canal con exportación a CSV.', prio: 'media', col: 'todo', pct: 0, due: d(24), tags: ['idea'], created: now - 5 * 24 * H },
    { id: uid('p'), title: 'Migrar el blog a Astro', desc: 'Sacar el contenido antiguo y ganar Core Web Vitals.', prio: 'baja', col: 'todo', pct: 0, due: null, tags: [], created: now - 9 * 24 * H },
    { id: uid('p'), title: 'Auditoría de accesibilidad', desc: 'Recorrer todas las vistas con teclado y lector de pantalla.', prio: 'media', col: 'doing', pct: 55, due: d(6), tags: ['interno'], created: now - 8 * 24 * H },
    { id: uid('p'), title: 'Lanzar la tienda de plantillas', desc: 'Catálogo inicial de 12 plantillas, pagos con Gumroad.', prio: 'alta', col: 'blocked', pct: 22, due: d(3), tags: ['urgent'], created: now - 15 * 24 * H },
    { id: uid('p'), title: 'Comparativa de Hosting', desc: 'Vercel vs Render vs Fly para el juego del tablero.', prio: 'media', col: 'blocked', pct: 40, due: d(7), tags: ['idea'], created: now - 4 * 24 * H },
    { id: uid('p'), title: 'Sistema de diseño v1', desc: 'Tokens, tipografía y los 30 componentes base.', prio: 'media', col: 'done', pct: 100, due: d(-4), tags: [], created: now - 40 * 24 * H },
    { id: uid('p'), title: 'Migrar los correos a SPF/DKIM', desc: 'Evitar que las newsletters caigan en spam.', prio: 'baja', col: 'done', pct: 100, due: d(-9), tags: [], created: now - 50 * 24 * H },
  ];

  DB.notes = [
    { id: uid('n'), title: 'Ideas para el dashboard', body: 'El usuario abre la app con una pregunta: ¿qué hago hoy?\n\nTres bloques y nada más:\n\n1. Lo que vence hoy\n2. Lo que está a la espera\n3. El próximo evento\n\nLa media hora y el porcentaje de avance van arriba, no repartidos.\n\nNada de gráficas decorativas sin un dato detrás.', folder: 'Diseño', pinned: true, updated: now - 40 * 60e3 },
    { id: uid('n'), title: 'Clientes activos', body: 'Luci — tienda de ropa, entrega el mes que viene.\nBellido — floristería, interested en el rediseño del catálogo.\nPeluquería Valverde — auditoría mensual.\n\nRegla: nunca prometer fechas, prometer avances.', folder: 'Cliente', pinned: false, updated: now - 5 * H },
    { id: uid('n'), title: 'Aprendizajes de rendimiento', body: 'Repintar en cada pointermove rompe el compositor.\nTransform y opacity son gratis; width y height no.\n\nMedir siempre: 60 fps con el devtools abierto ya esAcceptable.', folder: 'Estudio', pinned: false, updated: now - 26 * H },
    { id: uid('n'), title: 'Checklist de entrega web', body: '- [ ] Comprobar en 1366×768\n- [ ] Teclado: tab, enter, escape\n- [ ] Sin scroll horizontal\n- [ ] Estados vacíos\n- [ ] Colores contrastados\n- [ ] Backup antes de publicar', folder: 'Diseño', pinned: true, updated: now - 3 * 24 * H },
    { id: uid('n'), title: 'Gastos del mes', body: 'Suministros, gasolina, una suscripción que no uso y el taller.', folder: 'Personal', pinned: false, updated: now - 2 * 24 * H },
    { id: uid('n'), title: 'Palabras clave 2026', body: '收纳, tidy, minimal, dark first. El negro absoluto sigue siendo la tendencia.', folder: 'Idea', pinned: false, updated: now - 6 * 24 * H },
  ];

  const acts = [
    ['Completó', 'Migrar los correos a SPF/DKIM', 2 * H, 'check'],
    ['Subió al 68%', 'Rediseño web Luci', 4 * H, 'upload'],
    ['Creó la nota', 'Ideas para el dashboard', 40 * 60e3, 'notes'],
    ['Programó', 'Demo del rediseño a Floristería Bellido', 7 * H, 'calendar'],
    ['Movió a bloqueado', 'Lanzar la tienda de plantillas', 9 * H, 'lock'],
    ['Completó', 'Facturar la segunda entrega', 26 * H, 'check'],
    ['Actualizó', 'Comparativa de Hosting', 30 * H, 'edit'],
  ];
  DB.activity = acts.map(([kind, what, ago, ic], i) => ({
    id: uid('a'), kind, what, icon: ic, ts: now - ago, user: 'Jesús'
  })).sort((a, b) => b.ts - a.ts);

  DB.notifications = [
    { id: uid('n'), type: 'warn', title: 'Presupuesto del curso', body: 'Vence en 2 días. Aún no has subido el desglose.', ts: now - 20 * 60e3, read: false },
    { id: uid('n'), type: 'ok', title: 'Sincronización completada', body: 'El backup del portátil terminó sin errores.', ts: now - 3 * H, read: true },
    { id: uid('n'), type: 'info', title: 'Reunión mañana a las 11:00', body: 'Revisión de sprint. No olvides las métricas de la semana.', ts: now - 8 * H, read: false },
    { id: uid('n'), type: 'info', title: '4 tareas vencidas', body: 'Puedes revisarlas o moverlas a la próxima semana.', ts: now - 28 * H, read: true },
    { id: uid('n'), type: 'ok', title: 'Nuevo comentario de Marta', body: '"El prototipo va muy bien, ¿lo vemos el jueves?"', ts: now - 50 * H, read: true },
  ];
  saveNow();
}