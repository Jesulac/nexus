/* ================================================================
   NEXUS · modales, paleta, panel, drag & drop, router, arranque
   ================================================================ */

/* ---------- rutas ---------- */
const ROUTES = [
  { k: 'dashboard', l: 'Panel', s: 'Resumen general', i: 'dashboard', kbd: '1' },
  { k: 'hoy', l: 'Hoy', s: 'Tu día en un vistazo', i: 'today', kbd: '2' },
  { k: 'calendario', l: 'Calendario', s: 'Mes, eventos y agenda', i: 'calendar', kbd: '3' },
  { k: 'tareas', l: 'Tareas', s: 'Todas tus pendientes', i: 'tasks', kbd: '4' },
  { k: 'proyectos', l: 'Proyectos', s: 'Tablero Kanban', i: 'projects', kbd: '5' },
  { k: 'notas', l: 'Notas', s: 'Ideas y documentación', i: 'notes', kbd: '6' },
  { k: 'estadisticas', l: 'Estadísticas', s: 'Rendimiento y constancia', i: 'stats', kbd: '7' },
  { k: 'ajustes', l: 'Ajustes', s: 'Apariencia y datos', i: 'settings', kbd: '' }
];

/* ---------- sidebar ---------- */
function buildNav() {
  const nt = DB.notifications.filter(n => !n.read).length;
  const badge = { hoy: openTasks().filter(t => t.date === todayISO()).length };

  $('#nav').innerHTML =
    `<div class="nav-label">Espacio personal</div>` +
    ROUTES.slice(0, 6).map(r => `
      <button class="nav-item ${S.route === r.k ? 'on' : ''}" data-act="go" data-id="${r.k}" title="${r.l}">
        ${icon(r.i)}<span class="t">${r.l}</span>
        ${badge[r.k] ? `<span class="nav-badge ${r.k === 'hoy' && badge[r.k] > 5 ? 'hot' : ''}">${badge[r.k]}</span>` : ''}
      </button>`).join('') +
    `<div class="nav-label">Sistema</div>` +
    ROUTES.slice(6).map(r => `
      <button class="nav-item ${S.route === r.k ? 'on' : ''}" data-act="go" data-id="${r.k}" title="${r.l}">
        ${icon(r.i)}<span class="t">${r.l}</span>
      </button>`).join('');
}

function paintNotifDot() {
  const n = DB.notifications.filter(x => !x.read).length;
  const dot = $('#notifDot');
  dot.hidden = n === 0;
}

/* ---------- render ---------- */
/* routeChanged=false: re-render dentro de la misma vista (completar una tarea,
   mover una tarjeta…). Sin animación de página y sin perder el scroll, para que
   el cambio sea instantáneo y no parezca un refresco. */
/* Vistas: se renderizan con la clase .silent ya puesta en el HTML. La animación
   de entrada solo debe ocurrir al cambiar de sección; si el nodo entra al DOM
   sin la clase, pageIn arranca y se ve como un parpadeo de refresco. */
const SILENT = 'silent';
function render(routeChanged = false) {
  const r = ROUTES.find(x => x.k === S.route) || ROUTES[0];
  $('#pageTitle').textContent = r.l;
  $('#pageSub').textContent = r.s;
  buildNav();
  buildTabbar();
  paintNotifDot();

  const view = $('#view');
  const scroll = view.scrollTop;
  let html = (VIEWS[S.route] || VIEWS.dashboard)();
  if (!routeChanged) html = html.replace('class="page"', 'class="page ' + SILENT + '"');
  view.innerHTML = html;
  if (S.route === 'dashboard') dashApplyOrder();
  view.scrollTop = routeChanged ? 0 : scroll;
  paintWeekBar();
}

/* actualiza la barra lateral, la inferior y los contadores visibles */
function paintWeekBar() {
  const wk = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 6)));
  const tot = wk.reduce((s, d) => s + tasksOfDay(d).length, 0);
  const fin = wk.reduce((s, d) => s + tasksOfDay(d).filter(x => x.done).length, 0);
  const p = tot ? Math.round(fin / tot * 100) : 0;
  $('#weekPct').textContent = p + '%';
  $('#weekBar').style.width = p + '%';
  // el badge de la barra inferior depende del mismo estado
  const badge = $('#tabbar .tab[data-id="tareas"] .badge');
  const pend = openTasks().length;
  if (badge) {
    badge.textContent = pend > 9 ? '9+' : pend;
    badge.hidden = pend === 0;
  } else if (pend) {
    buildTabbar();
  }
}

/* refresca SOLO los números visibles de la vista actual, sin tocar el resto.
   Se usa tras completar una tarea para que las cifras acompañen al clic. */
function paintStats() {
  const t = todayISO();
  const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  const inDash = S.route === 'dashboard';

  // panel: anillo de progreso del día
  if (inDash) {
    const pct = dayProgress(t);
    const b = $('#ringPct');
    if (b) b.textContent = pct + '%';
    const ring = $('.ring .fg');
    if (ring) {
      const C = 2 * Math.PI * 26;
      ring.style.strokeDasharray = C;
      ring.style.strokeDashoffset = C * (1 - pct / 100);
    }
  }
  // hoy: contadores superiores
  if (S.route === 'hoy') {
    const list = tasksOfDay(t);
    set('#statPend', list.filter(x => !x.done).length);
    set('#statDone', list.filter(x => x.done).length);
    const doneToday = list.filter(x => x.done).length;
    const prog = $('.card.kpi .prog i');
    if (prog) prog.style.width = dayProgress(t) + '%';
    set('#distDone', doneToday + ' de ' + list.length);
  }
  // tareas: contador de resultados
  if (S.route === 'tareas') {
    const n = document.querySelectorAll('#taskGroups .task').length;
    set('#taskCount', n + (n === 1 ? ' tarea' : ' tareas'));
  }
  paintWeekBar();
  buildNav();
  paintNotifDot();
}

/* repintado parcial: mantiene el foco/scroll en vistas con inputs */
function renderSoft() {
  const view = $('#view');
  const active = document.activeElement;
  const id = active && active.id;
  const pos = active && active.selectionStart;
  const scroll = view.scrollTop;
  view.innerHTML = (VIEWS[S.route] || VIEWS.dashboard)().replace('class="page"', 'class="page ' + SILENT + '"');
  view.scrollTop = scroll;
  buildNav(); paintNotifDot(); paintWeekBar();
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      if (pos != null && el.setSelectionRange && el.type !== 'range') {
        try { el.setSelectionRange(pos, pos); } catch (e) { }
      }
    }
  }
}

function go(route) {
  if (!ROUTES.some(r => r.k === route)) route = 'dashboard';
  S.route = route;
  render(true);
}

/* ================================================================
   cajón lateral (móvil / tableta <=1180px)
   En escritorio el comportamiento es el de siempre: sin cajón.
   ================================================================ */
const isDrawer = () => window.matchMedia('(max-width:1180px)').matches;

function openNav() {
  if (!isDrawer()) return;
  $('#sidebar').classList.add('in');
  document.body.classList.add('nav-open');
  $('#navToggle').setAttribute('aria-expanded', 'true');
}
function closeNav() {
  if (!document.body.classList.contains('nav-open')) return;
  document.body.classList.remove('nav-open');
  $('#navToggle').setAttribute('aria-expanded', 'false');
  // la clase .in se quita al terminar la salida, no antes (ver CSS)
  const sb = $('#sidebar');
  if (DB.settings.animations === false) sb.classList.remove('in');
  else setTimeout(() => { if (!document.body.classList.contains('nav-open')) sb.classList.remove('in'); }, 330);
}
function toggleNav() {
  document.body.classList.contains('nav-open') ? closeNav() : openNav();
}
/* si la ventana crece a escritorio el cajón debe cerrarse y no quedar colgado */
function syncNavToViewport() {
  if (!isDrawer()) { closeNav(); $('#sidebar').classList.remove('in'); }
}

/* ================================================================
   barra inferior (solo táctil)
   Los 4 destinos de uso diario + "más" que abre el cajón con el resto.
   ================================================================ */
const TABS = [
  { k: 'dashboard', l: 'Panel', i: 'dashboard' },
  { k: 'hoy', l: 'Hoy', i: 'today' },
  { k: 'tareas', l: 'Tareas', i: 'tasks' },
  { k: 'calendario', l: 'Calendario', i: 'calendar' }
];

function buildTabbar() {
  const bar = $('#tabbar');
  if (!bar) return;
  const pend = openTasks().length;
  bar.innerHTML = TABS.map(t => {
    const badge = t.k === 'tareas' && pend ? `<i class="badge">${pend > 9 ? '9+' : pend}</i>` : '';
    return `<button class="tab ${S.route === t.k ? 'on' : ''}" data-act="go" data-id="${t.k}"
      aria-label="${t.l}" aria-current="${S.route === t.k ? 'page' : 'false'}">
      ${icon(t.i)}${badge}<span>${t.l}</span></button>`;
  }).join('') +
    `<button class="tab more" data-act="nav-toggle" aria-label="Más secciones">
      <span class="dots"><i></i><i></i><i></i></span><span>Más</span></button>`;
}

/* ================================================================
   MODALES
   ================================================================ */
let modalCloser = null;
function openModal({ title, sub = '', body, footer = '', wide = false, onMount }) {
  closeModal(true);
  const root = $('#modalRoot');
  root.hidden = false;
  root.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h"><b>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</b>
        <button class="icon-btn sm x" data-act="modal-close" aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-b">${body}</div>
      ${footer ? `<div class="modal-f">${footer}</div>` : ''}
    </div>`;
  modalCloser = e => { if (e.target === root) closeModal(); };
  root.addEventListener('click', modalCloser);
  if (onMount) onMount(root);
  const first = root.querySelector('input,textarea,select');
  if (first) setTimeout(() => first.focus(), 60);
}
function closeModal(instant = false) {
  const root = $('#modalRoot');
  if (root.hidden) return;
  const m = root.querySelector('.modal');
  if (modalCloser) { root.removeEventListener('click', modalCloser); modalCloser = null; }
  const done = () => { root.hidden = true; root.innerHTML = ''; };
  if (instant || DB.settings.animations === false) { done(); return; }
  if (m) m.classList.add('out');
  setTimeout(done, 200);
}

/* ---------- modal: tarea ---------- */
function taskModal(task, presetDate) {
  const t = task || { id: uid('t'), title: '', desc: '', prio: 'media', cat: 'Diseño', date: presetDate || todayISO(), time: '', done: false, pct: 0, tags: [], fav: false, created: Date.now() };
  const isNew = !task;
  openModal({
    title: isNew ? 'Nueva tarea' : 'Editar tarea',
    sub: isNew ? 'Los cambios se guardan automáticamente' : 'Creada ' + relTime(t.created || Date.now()),
    body: `
      <div class="field"><label>Título</label>
        <input class="input" id="fTitle" value="${esc(t.title)}" placeholder="¿Qué hay que hacer?" /></div>
      <div class="field"><label>Descripción</label>
        <textarea class="textarea" id="fDesc" placeholder="Detalles, enlaces, contexto…">${esc(t.desc || '')}</textarea></div>
      <div class="frow">
        <div class="field"><label>Prioridad</label>
          <div class="pickrow" id="fPrio">
            ${PRIOS.map(p => `<button class="pick ${t.prio === p.k ? 'on p-' + p.k : ''}" data-p="${p.k}">${p.l}</button>`).join('')}
          </div></div>
        <div class="field"><label>Categoría</label>
          <select class="select" id="fCat">${CATS.map(c => `<option ${c === t.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="frow-3">
        <div class="field"><label>Fecha</label><input class="input" type="date" id="fDate" value="${t.date || ''}" /></div>
        <div class="field"><label>Hora</label><input class="input" type="time" id="fTime" value="${t.time || ''}" /></div>
        <div class="field"><label>Estado</label>
          <select class="select" id="fDone">
            <option value="0" ${t.done ? '' : 'selected'}>Pendiente</option>
            <option value="1" ${t.done ? 'selected' : ''}>Completada</option>
          </select></div>
      </div>
      <div class="field"><label>Avance · <span id="fPctV" class="mono">${t.pct || 0}%</span></label>
        <div class="range-row"><input type="range" class="range" id="fPct" min="0" max="100" step="5" value="${t.pct || 0}" /></div></div>
      <div class="field"><label>Etiquetas</label>
        <div class="tagpick" id="fTags">
          ${TAGSET.map(g => `<button class="tg ${(t.tags || []).includes(g) ? 'on' : ''}" data-tag="${g}">${g}</button>`).join('')}
        </div></div>
      <div class="row">
        <button class="chip ${t.fav ? 'on' : ''}" id="fFav">${icon('star')} Favorita</button>
        <span class="grow"></span>
        <span class="muted" style="font-size:.68rem">${(t.tags || []).length} etiquetas</span>
      </div>`,
    footer: `
      ${isNew ? '' : `<button class="btn danger" data-act="task-del" data-id="${t.id}">${icon('trash')}Eliminar</button>`}
      <span class="sp"></span>
      <button class="btn ghost" data-act="modal-close">Cancelar</button>
      <button class="btn primary" data-act="${isNew ? 'task-save-new' : 'task-save'}" data-id="${t.id}">${icon('check')}${isNew ? 'Crear tarea' : 'Guardar'}</button>`,
    onMount(root) {
      root.querySelector('#fPct').addEventListener('input', e => {
        $('#fPctV').textContent = e.target.value + '%';
      });
      root.querySelector('#fPrio').addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        $$('#fPrio .pick').forEach(x => { x.className = 'pick'; });
        b.className = 'pick on p-' + b.dataset.p;
      });
      root.querySelector('#fTags').addEventListener('click', e => {
        const b = e.target.closest('[data-tag]'); if (!b) return;
        b.classList.toggle('on');
      });
      root.querySelector('#fFav').addEventListener('click', () => root.querySelector('#fFav').classList.toggle('on'));
      const ti = root.querySelector('#fTitle');
      ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); root.querySelector(`[data-act="${isNew ? 'task-save-new' : 'task-save'}"]`).click(); } });
    }
  });
}
function readTaskForm() {
  return {
    title: $('#fTitle').value.trim() || 'Sin título',
    desc: $('#fDesc').value.trim(),
    prio: ($('#fPrio .pick.on') || {}).dataset?.p || 'media',
    cat: $('#fCat').value,
    date: $('#fDate').value,
    time: $('#fTime').value,
    done: $('#fDone').value === '1',
    pct: clampPct($('#fPct').value),
    tags: $$('#fTags .tg.on').map(x => x.dataset.tag),
    fav: $('#fFav').classList.contains('on')
  };
}

/* ---------- modal: evento ---------- */
function eventModal(ev, presetDate) {
  const e0 = ev || { id: uid('e'), title: '', date: presetDate || S.calSel, time: '09:00', dur: 60, color: 'accent', notes: '' };
  const isNew = !ev;
  openModal({
    title: isNew ? 'Nuevo evento' : 'Editar evento',
    sub: isNew ? 'Se añadirá a la agenda del día' : 'Agenda del ' + fmtFecha(e0.date, { force: true }),
    body: `
      <div class="field"><label>Título</label>
        <input class="input" id="eTitle" value="${esc(e0.title)}" placeholder="¿Qué ocurre?" /></div>
      <div class="frow-3">
        <div class="field"><label>Fecha</label><input class="input" type="date" id="eDate" value="${e0.date || todayISO()}" /></div>
        <div class="field"><label>Hora</label><input class="input" type="time" id="eTime" value="${e0.time || '09:00'}" /></div>
        <div class="field"><label>Duración</label>
          <select class="select" id="eDur">
            ${[15, 30, 45, 60, 90, 120, 180].map(m => `<option value="${m}" ${m === e0.dur ? 'selected' : ''}>${m < 60 ? m + ' min' : (m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '')}</option>`).join('')}
          </select></div>
      </div>
      <div class="field"><label>Color</label>
        <div class="pickrow" id="eColor">
          ${EVENT_COLORS.map(c => `<button class="pick ${e0.color === c ? 'on' : ''}" data-c="${c}"
            style="--pc:var(--${c === 'mint' ? 'ok' : c === 'accent' ? 'accent' : c === 'accent-2' ? 'accent-2' : c})">
            <span style="width:.5rem;height:.5rem;border-radius:50%;background:currentColor"></span>${c}</button>`).join('')}
        </div></div>
      <div class="field"><label>Notas</label>
        <textarea class="textarea" id="eNotes" placeholder="Lugar, personas, material…">${esc(e0.notes || '')}</textarea></div>`,
    footer: `
      ${isNew ? '' : `<button class="btn danger" data-act="event-del" data-id="${e0.id}">${icon('trash')}Eliminar</button>`}
      <span class="sp"></span>
      <button class="btn ghost" data-act="modal-close">Cancelar</button>
      <button class="btn primary" data-act="${isNew ? 'ev-save-new' : 'ev-save'}" data-id="${e0.id}">${icon('check')}${isNew ? 'Crear evento' : 'Guardar'}</button>`,
    onMount(root) {
      root.querySelector('#eColor').addEventListener('click', ev => {
        const b = ev.target.closest('[data-c]'); if (!b) return;
        $$('#eColor .pick').forEach(x => { x.className = 'pick'; x.removeAttribute('style'); });
        b.className = 'pick on';
        b.style.setProperty('--pc', `var(--${b.dataset.c === 'mint' ? 'ok' : b.dataset.c})`);
      });
    }
  });
}
const readEventForm = () => ({
  title: $('#eTitle').value.trim() || 'Sin título',
  date: $('#eDate').value || todayISO(),
  time: $('#eTime').value || '09:00',
  dur: Number($('#eDur').value),
  color: ($('#eColor .pick.on') || {}).dataset?.c || 'accent',
  notes: $('#eNotes').value.trim()
});

/* ---------- modal: proyecto ---------- */
function projectModal(p, presetCol) {
  const p0 = p || { id: uid('p'), title: '', desc: '', prio: 'media', col: presetCol || 'todo', pct: 0, due: '', tags: [], created: Date.now() };
  const isNew = !p;
  openModal({
    title: isNew ? 'Nuevo proyecto' : 'Editar proyecto',
    sub: isNew ? 'Arrastra su tarjeta para moverla' : 'Creado ' + relTime(p0.created || Date.now()),
    body: `
      <div class="field"><label>Título</label>
        <input class="input" id="pTitle" value="${esc(p0.title)}" placeholder="Nombre del proyecto" /></div>
      <div class="field"><label>Descripción</label>
        <textarea class="textarea" id="pDesc" placeholder="Objetivo y alcance">${esc(p0.desc || '')}</textarea></div>
      <div class="frow">
        <div class="field"><label>Columna</label>
          <select class="select" id="pCol">${COLS.map(c => `<option value="${c.k}" ${c.k === p0.col ? 'selected' : ''}>${c.l}</option>`).join('')}</select></div>
        <div class="field"><label>Prioridad</label>
          <div class="pickrow" id="pPrio">${PRIOS.map(x => `<button class="pick ${p0.prio === x.k ? 'on p-' + x.k : ''}" data-p="${x.k}">${x.l}</button>`).join('')}</div></div>
      </div>
      <div class="field"><label>Avance · <span id="pPctV" class="mono">${p0.pct || 0}%</span></label>
        <div class="range-row"><input type="range" class="range" id="pPct" min="0" max="100" step="5" value="${p0.pct || 0}" /></div></div>
      <div class="frow">
        <div class="field"><label>Fecha límite</label><input class="input" type="date" id="pDue" value="${p0.due || ''}" /></div>
        <div class="field"><label>Etiquetas</label>
          <div class="tagpick" id="pTags">${TAGSET.map(g => `<button class="tg ${(p0.tags || []).includes(g) ? 'on' : ''}" data-tag="${g}">${g}</button>`).join('')}</div></div>
      </div>`,
    footer: `
      ${isNew ? '' : `<button class="btn danger" data-act="project-del" data-id="${p0.id}">${icon('trash')}Eliminar</button>`}
      <span class="sp"></span>
      <button class="btn ghost" data-act="modal-close">Cancelar</button>
      <button class="btn primary" data-act="${isNew ? 'pr-save-new' : 'pr-save'}" data-id="${p0.id}">${icon('check')}${isNew ? 'Crear' : 'Guardar'}</button>`,
    onMount(root) {
      root.querySelector('#pPct').addEventListener('input', e => { $('#pPctV').textContent = e.target.value + '%'; });
      root.querySelector('#pPrio').addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        $$('#pPrio .pick').forEach(x => { x.className = 'pick'; });
        b.className = 'pick on p-' + b.dataset.p;
      });
      root.querySelector('#pTags').addEventListener('click', e => {
        const b = e.target.closest('[data-tag]'); if (!b) return;
        b.classList.toggle('on');
      });
    }
  });
}
const readProjectForm = () => ({
  title: $('#pTitle').value.trim() || 'Sin título',
  desc: $('#pDesc').value.trim(),
  col: $('#pCol').value,
  prio: ($('#pPrio .pick.on') || {}).dataset?.p || 'media',
  pct: clampPct($('#pPct').value),
  due: $('#pDue').value,
  tags: $$('#pTags .tg.on').map(x => x.dataset.tag)
});

/* ---------- confirmación ---------- */
function confirmModal({ title, body, danger = true, onYes }) {
  openModal({
    title,
    body: `<p style="font-size:.83rem;color:var(--txt-2);line-height:1.6">${body}</p>`,
    footer: `<span class="sp"></span>
      <button class="btn ghost" data-act="modal-close">Cancelar</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" id="confirmYes">${icon('check')}Confirmar</button>`,
    onMount(root) { root.querySelector('#confirmYes').addEventListener('click', () => { closeModal(); onYes(); }); }
  });
}

/* ================================================================
   COMMAND PALETTE
   ================================================================ */
let palItems = [], palSel = 0, palOpen = false;

function paletteCommands() {
  const cmds = [
    { g: 'Acciones', ic: 'plus', t: 'Crear tarea', s: 'Añade una tarea nueva', run: () => taskModal(null), rt: 'N' },
    { g: 'Acciones', ic: 'notes', t: 'Crear nota', s: 'Nota en blanco', run: () => newNote(), rt: 'N' },
    { g: 'Acciones', ic: 'calendar', t: 'Crear evento', s: 'Programa un bloque de tiempo', run: () => eventModal(null), rt: 'E' },
    { g: 'Acciones', ic: 'projects', t: 'Crear proyecto', s: 'Nuevo proyecto en el tablero', run: () => projectModal(null), rt: 'P' },
    { g: 'Ir a', ic: 'dashboard', t: 'Panel', s: 'Resumen general', run: () => go('dashboard'), rt: '1' },
    { g: 'Ir a', ic: 'today', t: 'Hoy', s: 'Tu día en un vistazo', run: () => go('hoy'), rt: '2' },
    { g: 'Ir a', ic: 'calendar', t: 'Calendario', s: 'Mes y agenda', run: () => go('calendario'), rt: '3' },
    { g: 'Ir a', ic: 'tasks', t: 'Tareas', s: 'Gestor de tareas', run: () => go('tareas'), rt: '4' },
    { g: 'Ir a', ic: 'projects', t: 'Proyectos', s: 'Tablero Kanban', run: () => go('proyectos'), rt: '5' },
    { g: 'Ir a', ic: 'notes', t: 'Notas', s: 'Editor de notas', run: () => go('notas'), rt: '6' },
    { g: 'Ir a', ic: 'stats', t: 'Estadísticas', s: 'Rendimiento', run: () => go('estadisticas'), rt: '7' },
    { g: 'Ir a', ic: 'settings', t: 'Ajustes', s: 'Apariencia y datos', run: () => go('ajustes'), rt: '' },
    { g: 'Apariencia', ic: 'palette', t: 'Cambiar tema de acento', s: 'Elige un color', run: () => go('ajustes'), rt: '' },
    ...['blue', 'violet', 'mint', 'amber', 'ice'].map(a => ({
      g: 'Apariencia', ic: 'sparkle', t: 'Acento ' + a, s: 'Aplicar color ' + a,
      run: () => { setSetting('accent', a); go('ajustes'); toast('Tema actualizado', a, 'ok'); }, rt: ''
    })),
    { g: 'Apariencia', ic: 'moon', t: 'Alternar modo OLED', s: 'Negro absoluto o gris suave', run: () => { setSetting('oled', !DB.settings.oled); }, rt: '' },
    { g: 'Apariencia', ic: 'move', t: 'Colapsar barra lateral', s: 'Más espacio de trabajo', run: () => setSetting('collapsed', !DB.settings.collapsed), rt: '' },
    { g: 'Apariencia', ic: 'zap', t: 'Alternar animaciones', s: 'Reduce el movimiento', run: () => setSetting('animations', !DB.settings.animations), rt: '' },
    { g: 'Apariencia', ic: 'grid', t: 'Cambiar densidad', s: 'Cómoda, normal o amplia', run: () => {
        const o = ['compact', 'normal', 'roomy']; setSetting('density', o[(o.indexOf(DB.settings.density) + 1) % 3]); toast('Densidad cambiada', DB.settings.density, 'ok');
      }, rt: '' },
    { g: 'Datos', ic: 'download', t: 'Exportar datos', s: 'Descarga una copia JSON', run: exportData, rt: '' },
    { g: 'Datos', ic: 'refresh', t: 'Restablecer datos de ejemplo', s: 'Borra todo lo actual', run: () => confirmModal({
      title: '¿Restablecer NEXUS?', body: 'Se borrarán todas las tareas, eventos, proyectos y notas, y se volverán a crear los datos de ejemplo. No se puede deshacer.',
      onYes: () => { localStorage.removeItem(KEY); location.reload(); }
    }), rt: '' },
    { g: 'Datos', ic: 'lock', t: 'Cerrar sesión del panel', s: 'Vuelve a la pantalla de bloqueo', run: lockApp, rt: '' }
  ];

  const content = [
    ...DB.tasks.slice(0, 40).map(t => ({
      g: 'Tareas', ic: 'check', t: t.title, s: `${prioLabel(t.prio)}${t.cat ? ' · ' + t.cat : ''}${t.date ? ' · ' + fmtFecha(t.date) : ''}`,
      run: () => { closePalette(); go('tareas'); taskModal(t); }, rt: t.done ? 'hecha' : `${t.pct || 0}%`
    })),
    ...DB.notes.map(n => ({
      g: 'Notas', ic: 'notes', t: n.title || 'Sin título', s: (n.body || '').slice(0, 60).replace(/\n+/g, ' '),
      run: () => { closePalette(); S.noteSel = n.id; S.noteFolder = 'todas'; go('notas'); }, rt: n.folder
    })),
    ...DB.projects.map(p => ({
      g: 'Proyectos', ic: 'projects', t: p.title, s: `${colLabel(p.col)} · ${p.pct}%`,
      run: () => { closePalette(); go('proyectos'); projectModal(p); }, rt: p.due ? fmtFecha(p.due) : ''
    })),
    ...DB.events.slice(0, 20).map(e => ({
      g: 'Eventos', ic: 'calendar', t: e.title, s: `${fmtFecha(e.date, { force: true })} · ${hhmm(e.time)}`,
      run: () => { closePalette(); go('calendario'); S.calSel = e.date; render(); eventModal(e); }, rt: e.dur + 'm'
    }))
  ];
  return cmds.concat(content);
}

function fuzzy(q, s) {
  if (!q) return { ok: true, score: 0 };
  const t = s.toLowerCase(), n = q.toLowerCase();
  const i = t.indexOf(n);
  if (i === 0) return { ok: true, score: 100 };
  if (i > 0) return { ok: true, score: 70 - i };
  // subsecuencia
  let ti = 0, gaps = 0;
  for (const ch of n) {
    const f = t.indexOf(ch, ti);
    if (f === -1) return { ok: false };
    gaps += f - ti; ti = f + 1;
  }
  return { ok: true, score: 30 - gaps * 0.4 };
}

function openPalette() {
  palOpen = true; palSel = 0;
  const w = $('#paletteWrap');
  w.hidden = false;
  $('#palInput').value = '';
  paintPalette('');
  setTimeout(() => $('#palInput').focus(), 40);
}
function closePalette() {
  palOpen = false;
  $('#paletteWrap').hidden = true;
}
function paintPalette(q) {
  const all = paletteCommands();
  const scored = all.map(c => {
    const a = fuzzy(q, c.t), b = fuzzy(q, c.s);
    if (!a.ok && !b.ok) return null;
    return { c, score: Math.max(a.score, b.score / 2) };
  }).filter(Boolean).sort((x, y) => y.score - x.score).slice(0, 40);

  palItems = scored.map(x => x.c);
  palSel = clamp(palSel, 0, Math.max(0, palItems.length - 1));

  let html = '', lastG = null;
  palItems.forEach((c, i) => {
    if (c.g !== lastG) { html += `<div class="pal-group">${esc(c.g)}</div>`; lastG = c.g; }
    html += `<button class="pal-item ${i === palSel ? 'on' : ''}" data-pi="${i}">
      <span class="ic">${icon(c.ic)}</span>
      <span class="tx"><b>${esc(c.t)}</b>${c.s ? `<small>${esc(c.s)}</small>` : ''}</span>
      ${c.rt ? `<span class="rt">${esc(c.rt)}</span>` : ''}</button>`;
  });

  $('#palList').innerHTML = html || `<div class="pal-none">Sin resultados para «${esc(q)}»</div>`;
  $('#palCount').textContent = `${palItems.length} de ${all.length}`;
}
function palMove(d) {
  if (!palItems.length) return;
  palSel = clamp(palSel + d, 0, palItems.length - 1);
  $$('#palList .pal-item').forEach((el, i) => el.classList.toggle('on', i === palSel));
  const on = $(`#palList .pal-item[data-pi="${palSel}"]`);
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function palRun() {
  const c = palItems[palSel];
  if (!c) return;
  closePalette();
  setTimeout(() => c.run(), 20);
}

/* ================================================================
   PANEL DE NOTIFICACIONES
   ================================================================ */
function openPanel() {
  const p = $('#notifPanel');
  p.classList.remove('out');
  p.classList.add('open');
  p.setAttribute('aria-hidden', 'false');
  $('#scrim').hidden = false;
  paintNotifs();
}
function closePanel() {
  const p = $('#notifPanel');
  p.setAttribute('aria-hidden', 'true');
  $('#scrim').hidden = true;
  if (!DB.settings.animations) { p.classList.remove('open', 'out'); return; }
  p.classList.remove('open');
  p.classList.add('out');
  setTimeout(() => p.classList.remove('out'), 270);
}
function paintNotifs() {
  const list = DB.notifications;
  const nc = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)' };
  const ni = { ok: 'check', warn: 'flag', bad: 'bug', info: 'bell' };
  $('#notifList').innerHTML = list.length ? list.map(n => `
    <div class="nt ${n.read ? '' : 'unread'}" style="--nc:${nc[n.type] || nc.info}" data-act="nt-read" data-id="${n.id}">
      <span class="nt-ic">${icon(ni[n.type] || 'bell')}</span>
      <div class="nt-b"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><time>${relTime(n.ts)}</time></div>
      <button class="icon-btn sm x" data-act="nt-del" data-id="${n.id}" title="Eliminar">${icon('x')}</button>
    </div>`).join('')
    : `<div class="empty">${icon('bell')}<b>Todo al día</b><p>No tienes notificaciones pendientes.</p></div>`;
  $('#notifCount').textContent = `${list.filter(n => !n.read).length} sin leer de ${list.length}`;
  paintNotifDot();
}

/* ================================================================
   DRAG & DROP (pointer events) · kanban
   Dos modos:
   - raton: al mover el boton se arrastra al instante (umbral 5px)
   - tactil: pulsacion larga (420ms) sin movimiento -> se arma el arrastre.
     Si el dedo se mueve antes de eso, es scroll y no se toca nada.
   ================================================================ */
const DRAG_THRESHOLD = 5;
const HOLD_MS = 420;
const drag = {
  active: false, armed: false, longPress: false, id: null, fromCol: null,
  ghost: null, origin: null, ph: null, startX: 0, startY: 0, offX: 0, offY: 0, width: 0,
  holdTimer: null, pointerId: null
};
const isTouch = () => window.matchMedia('(hover:none) and (pointer:coarse)').matches;

function onPointerDown(e) {
  if (e.button != null && e.button > 0) return;
  const card = e.target.closest('.kcard');
  if (!card || S.route !== 'proyectos') return;
  if (e.target.closest('button')) return;
  const r = card.getBoundingClientRect();
  drag.armed = true; drag.active = false;
  drag.longPress = isTouch();
  drag.id = card.dataset.id;
  drag.fromCol = card.dataset.col;
  drag.origin = card;
  drag.startX = e.clientX; drag.startY = e.clientY;
  drag.offX = e.clientX - r.left; drag.offY = e.clientY - r.top;
  drag.width = r.width;
  drag.pointerId = e.pointerId;

  // en tactil hay que mantener pulsado; el dedo ya define el offset
  if (drag.longPress) {
    card.classList.add('pressing');
    clearTimeout(drag.holdTimer);
    drag.holdTimer = setTimeout(() => {
      if (!drag.armed || drag.active) return;
      card.classList.remove('pressing');
      card.classList.add('dragging-active');
      activateDrag(e);                       // arma el arrastre con el dedo
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { } }
    }, HOLD_MS);
  }

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);

  // en tactil, con setPointerCapture los eventos van a la tarjeta, no al
  // document: hay que escucharlos ahi durante el arrastre
  if (drag.longPress) {
    const follow = ev => { if (drag.active) onPointerMove(ev); };
    const release = () => {
      card.removeEventListener('pointermove', follow);
      card.removeEventListener('pointerup', release);
      card.removeEventListener('pointercancel', release);
    };
    drag.follow = follow; drag.release = release; drag.followCard = card;
    card.addEventListener('pointermove', follow, { passive: true });
    card.addEventListener('pointerup', release, { passive: true });
    card.addEventListener('pointercancel', release, { passive: true });
  }
}

function activateDrag(e) {
  if (drag.active) return;                 // evita doble activación
  drag.active = true;
  const card = drag.origin, r = card.getBoundingClientRect();

  const g = card.cloneNode(true);
  g.classList.add('drag-ghost');
  g.classList.remove('ghosting', 'pressing', 'dragging-active');
  g.style.setProperty('--kw', drag.width + 'px');
  g.style.width = drag.width + 'px';
  g.style.left = '0px'; g.style.top = '0px';
  g.style.transform = `translate3d(${e.clientX - drag.offX}px,${e.clientY - drag.offY}px,0) rotate(1.6deg) scale(1.02)`;
  document.body.appendChild(g);
  drag.ghost = g;

  card.classList.add('ghosting');         // opacity, nunca display:none
  card.style.height = r.height + 'px';

  const ph = document.createElement('div');
  ph.className = 'ph';
  ph.dataset.id = 'placeholder';
  ph.style.height = r.height + 'px';
  card.after(ph);
  drag.ph = ph;
  document.body.style.cursor = 'grabbing';
  document.body.classList.add('is-dragging');

  // Retener el puntero: sin esto, en tactil el navegador se queda con el
  // gesto para hacer scroll y dispara pointercancel al mover el dedo.
  try { card.setPointerCapture(drag.pointerId); } catch (err) { }
}

function onPointerMove(e) {
  if (!drag.armed) return;
  if (!drag.active) {
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    // En tactil solo se arrastra si la pulsacion larga YA se armo (drag.active
    // lo pone activateDrag). Si el dedo se mueve antes de eso, es scroll.
    if (drag.longPress) {
      if (dist > 12) cancelHold();
      return;
    }
    if (dist < DRAG_THRESHOLD) return;
    activateDrag(e);
    return;                       // el primer movimiento solo arma, no posiciona
  }
  drag.ghost.style.transform = `translate3d(${e.clientX - drag.offX}px,${e.clientY - drag.offY}px,0) rotate(1.6deg) scale(1.02)`;

  // En movil las columnas van apiladas: al arrastrar hacia abajo hay que
  // desplazar la vista para que la columna destino llegue al dedo.
  autoScrollDuringDrag(e.clientY);

  // bajo el puntero: ignore el ghost con pointer-events:none
  drag.ghost.style.display = 'none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  drag.ghost.style.display = '';
  const body = under && under.closest('.col-b');
  if (!body) return;

  $$('.col-b').forEach(b => b.classList.remove('over'));
  body.classList.add('over');

  const cards = [...body.querySelectorAll('.kcard:not(.ghosting)')];
  let target = null;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { target = c; break; }
  }
  if (target) body.insertBefore(drag.ph, target);
  else body.appendChild(drag.ph);
}

/* desplaza la vista mientras el dedo esta cerca del borde, para alcanzar
   columnas que quedan fuera de pantalla en el tablero apilado */
function autoScrollDuringDrag(clientY) {
  const view = $('#view');
  if (!view) return;
  const r = view.getBoundingClientRect();
  const EDGE = 72, MAX = 16;
  if (clientY > r.bottom - EDGE) view.scrollTop += MAX;
  else if (clientY < r.top + EDGE) view.scrollTop -= MAX;
}

function finishDrag() {
  const board = $('#board');
  if (!board || !drag.id) return;
  const moving = getProject(drag.id);
  if (!moving) return;

  // reconstruye el estado leyendo el DOM de cada columna. El placeholder marca
  // la posición final; la original (.ghosting) se ignora para no duplicarla.
  const order = [];
  let placed = false;
  $$('.col-b', board).forEach(b => {
    const col = b.dataset.col;
    $$(':scope > .kcard, :scope > .ph', b).forEach(node => {
      if (node.classList.contains('ghosting')) return;   // la original, se ignora
      if (node.dataset.id === 'placeholder') {
        if (placed) return;
        placed = true;
        moving.col = col;
        order.push(moving);
        return;
      }
      const p = getProject(node.dataset.id);
      if (!p || p.id === moving.id) return;
      p.col = col;
      order.push(p);
    });
  });
  if (!placed) {                        // soltada fuera de una columna
    moving.col = drag.fromCol;
  }
  // los que no estén en el DOM (seguridad) se conservan detrás
  DB.projects.forEach(p => { if (!order.includes(p)) order.push(p); });
  DB.projects = order;
  save();
}

function cancelHold() {
  clearTimeout(drag.holdTimer);
  if (drag.origin) drag.origin.classList.remove('pressing');
  drag.armed = false;
}

function cleanupDrag() {
  clearTimeout(drag.holdTimer);
  // soltar los listeners enganchados a la tarjeta y el puntero retenido
  if (drag.release) drag.release();
  if (drag.origin && drag.pointerId != null) {
    try { drag.origin.releasePointerCapture(drag.pointerId); } catch (err) { }
  }
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerCancel);
  if (drag.ghost) { drag.ghost.remove(); drag.ghost = null; }
  if (drag.ph) { drag.ph.remove(); drag.ph = null; }
  if (drag.origin) {
    drag.origin.classList.remove('ghosting', 'pressing', 'dragging-active');
    drag.origin.style.height = '';
  }
  $$('.col-b').forEach(b => b.classList.remove('over'));
  document.body.style.cursor = '';
  document.body.classList.remove('is-dragging');
  const wasActive = drag.active;
  drag.armed = false; drag.active = false; drag.id = null; drag.longPress = false;
  drag.origin = null; drag.fromCol = null; drag.follow = null; drag.release = null; drag.followCard = null;
  return wasActive;
}

function onPointerUp() {
  const wasActive = drag.active;
  const moved = drag.id ? getProject(drag.id) : null;
  if (wasActive) finishDrag();
  cleanupDrag();
  if (wasActive && moved) {
    render();                 // silencioso: sin transición de página
    toast('Tarjeta movida', `${moved.title} · ${colLabel(moved.col)}`, 'ok', 2200);
    beep('tick');
  }
}

function onPointerCancel() {
  cleanupDrag();
}

/* ---------- reordenar tarjetas del dashboard (drag & drop) ---------- */
/* Las tarjetas del panel se pueden reordenar arrastrándolas. Guarda el orden
   por clave de sección, así sobrevive al re-render. */
const DASH_KEYS = ['hero', 'kpis', 'tareas', 'ritmo', 'eventos', 'proyectos', 'actividad'];
const dashDnd = { active: false, key: null, ghost: null, ph: null, origin: null, x: 0, y: 0, w: 0, h: 0 };

function dashOrderKey(card) {
  if (card.querySelector('.hero, .kpis')) return null;
  const h3 = card.querySelector('.card-h h3');
  if (!h3) return null;
  const t = h3.textContent.replace(/\s+/g, ' ').trim();
  if (t.includes('Tareas de hoy')) return 'tareas';
  if (t.includes('Ritmo semanal')) return 'ritmo';
  if (t.includes('Próximos eventos')) return 'eventos';
  if (t.includes('Proyectos activos')) return 'proyectos';
  if (t.includes('Actividad')) return 'actividad';
  return null;
}
function dashStoreOrder() {
  const order = [];
  $$('#view .page > *').forEach(node => {
    const c = node.classList.contains('grid') ? $$(':scope > .card', node)[0] : node;
    if (!c) return;
    const k = dashOrderKey(c);
    if (k) order.push(k);
  });
  if (order.length) DB.settings.dashOrder = order;
  save();
}
function dashApplyOrder() {
  const order = DB.settings.dashOrder;
  if (!Array.isArray(order) || !order.length) return;
  const page = $('#view .page');
  if (!page) return;
  const findCard = k => $$(':scope > .card, :scope > .grid', page).find(n => dashOrderKey(n) === k);
  // reordena dentro de cada grid conservando el orden de las claves
  $$(':scope > .grid', page).forEach(grid => {
    const kids = $$(':scope > .card', grid);
    if (kids.length < 2) return;
    const sorted = order.map(k => kids.find(c => dashOrderKey(c) === k)).filter(Boolean);
    sorted.forEach(c => grid.appendChild(c));
  });
  // orden entre bloques de primer nivel
  const blocks = $$(':scope > *', page).filter(n => dashOrderKey(n));
  order.forEach(k => {
    const n = blocks.find(b => dashOrderKey(b) === k);
    if (n) page.appendChild(n);
  });
}
function dashPointerDown(e) {
  if (S.route !== 'dashboard') return;
  if (e.button != null && e.button !== 0) return;
  if (e.target.closest('button,a,input,select,textarea')) return;
  const card = e.target.closest('.card');
  if (!card || !dashOrderKey(card)) return;
  const r = card.getBoundingClientRect();
  const dx = e.clientX - r.left, dy = e.clientY - r.top;
  if (dx > 44 && dy < 44) return;   // la esquina superior derecha es zona de botones

  const sx = e.clientX, sy = e.clientY;
  let armed = true;
  const parent = card.parentElement;

  const move = ev => {
    if (!armed) return;
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    armed = false;
    // activa
    const g = card.cloneNode(true);
    g.classList.add('drag-ghost');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.style.left = '0px'; g.style.top = '0px';
    g.style.transform = `translate3d(${ev.clientX - dx}px,${ev.clientY - dy}px,0) scale(1.015) rotate(.7deg)`;
    document.body.appendChild(g);
    const ph = document.createElement('div');
    ph.className = 'card card-ghost-slot';
    ph.style.height = r.height + 'px';
    ph.style.minHeight = '3rem';
    card.after(ph);
    dashDnd.active = true; dashDnd.ghost = g; dashDnd.ph = ph; dashDnd.origin = card;
    card.classList.add('ghosting');
    card.style.height = r.height + 'px';
    document.body.style.cursor = 'grabbing';

    const mm = e2 => {
      g.style.transform = `translate3d(${e2.clientX - dx}px,${e2.clientY - dy}px,0) scale(1.015) rotate(.7deg)`;
      g.style.display = 'none';
      const under = document.elementFromPoint(e2.clientX, e2.clientY);
      g.style.display = '';
      const zone = under && under.closest('.page');
      if (!zone) return;
      const sibs = [...zone.children].filter(n => n !== ph && (n.classList.contains('card') || n.classList.contains('grid')));
      let target = null;
      for (const s of sibs) {
        const sr = s.getBoundingClientRect();
        if (e2.clientY < sr.top + sr.height / 2) { target = s; break; }
      }
      if (target) zone.insertBefore(ph, target);
      else zone.appendChild(ph);
    };
    const up = () => {
      document.removeEventListener('pointermove', mm);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (ph.parentElement && card.parentElement) ph.replaceWith(card);
      else if (ph.parentElement) { card.remove(); ph.parentElement.appendChild(card); }
      g.remove();
      card.classList.remove('ghosting');
      card.style.height = '';
      document.body.style.cursor = '';
      dashDnd.active = false; dashDnd.ghost = null; dashDnd.ph = null; dashDnd.origin = null;
      dashStoreOrder();
      toast('Panel reorganizado', 'El orden se ha guardado', 'info', 1800);
    };
    document.addEventListener('pointermove', mm);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };
  const cancel = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', cancel); };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointercancel', cancel);
}

/* ================================================================
   ACCIONES
   ================================================================ */
const ACT = {
  /* navegación */
  go: (el) => { go(el.dataset.id); closeNav(); },
  collapse: () => setSetting('collapsed', !DB.settings.collapsed),
  'nav-toggle': () => toggleNav(),
  'modal-close': () => closeModal(),

  /* tareas */
  'task-new': (el) => taskModal(null, el.dataset.id),
  'task-edit': (el) => { const t = getTask(el.dataset.id); if (t) taskModal(t); },
  'task-toggle': (el) => toggleTask(el.dataset.id),
  'task-fav': (el) => {
    const t = getTask(el.dataset.id); if (!t) return;
    t.fav = !t.fav;
    el.classList.toggle('pulse', true);
    setTimeout(() => el.classList.remove('pulse'), 440);
    save(); render(); beep('ok');
  },
  'task-del': (el) => {
    const id = el.dataset.id;
    confirmModal({
      title: '¿Eliminar la tarea?', danger: true,
      body: 'Se borrará de la lista y de las estadísticas. Esta acción no se puede deshacer.',
      onYes: () => {
        const i = DB.tasks.findIndex(t => t.id === id); if (i >= 0) DB.tasks.splice(i, 1);
        closeModal(); save(); render();
        toast('Tarea eliminada', '', 'bad');
      }
    });
  },
  'task-save-new': () => {
    const v = readTaskForm();
    DB.tasks.unshift({ id: uid('t'), ...v, created: Date.now(), doneAt: v.done ? Date.now() : null });
    if (v.done) v.pct = 100;
    closeModal(); save(); render();
    logActivity('Creó', v.title, 'plus');
    notify('info', 'Tarea creada', v.title);
    toast('Tarea creada', v.title, 'ok');
    beep('ok');
  },
  'task-save': (el) => {
    const t = getTask(el.dataset.id); if (!t) return;
    const wasDone = t.done;
    Object.assign(t, readTaskForm());
    if (t.done) { t.pct = 100; t.doneAt = t.doneAt || Date.now(); }
    closeModal(); save(); render();
    toast(wasDone === t.done ? 'Cambios guardados' : t.done ? 'Tarea completada' : 'Tarea reabierta', t.title, t.done ? 'ok' : 'info');
    beep(t.done ? 'ok' : 'tick');
  },
  'task-prio': (el) => { S.taskFilter.prio = el.dataset.id; render(); },
  'task-range': (el) => { S.taskFilter.range = el.dataset.id; render(); },
  'task-reset': () => { S.taskFilter = { q: '', prio: 'all', range: 'abiertas', sort: 'date', view: 'all' }; render(); },

  /* calendario */
  'cal-prev': () => { if (--S.calMonth < 0) { S.calMonth = 11; S.calYear--; } render(); },
  'cal-next': () => { if (++S.calMonth > 11) { S.calMonth = 0; S.calYear++; } render(); },
  'cal-today': () => { S.calMonth = new Date().getMonth(); S.calYear = new Date().getFullYear(); S.calSel = todayISO(); render(); },
  'cal-pick': (el) => { S.calSel = el.dataset.id; render(); },
  'event-new': (el) => eventModal(null, el.dataset.id),
  'event-edit': (el) => { const e = getEvent(el.dataset.id); if (e) { S.calSel = e.date; eventModal(e); } },
  'event-del': (el) => {
    const i = DB.events.findIndex(e => e.id === el.dataset.id);
    if (i >= 0) { DB.events.splice(i, 1); closeModal(); save(); render(); toast('Evento eliminado', '', 'bad'); }
  },
  'ev-save-new': () => {
    const v = readEventForm();
    DB.events.push({ id: uid('e'), ...v });
    S.calSel = v.date; S.calMonth = parseYMD(v.date).getMonth(); S.calYear = parseYMD(v.date).getFullYear();
    closeModal(); save(); render();
    logActivity('Programó', v.title, 'calendar');
    toast('Evento creado', `${fmtFecha(v.date, { force: true })} · ${v.time}`, 'ok');
    beep('ok');
  },
  'ev-save': (el) => {
    const e = getEvent(el.dataset.id); if (!e) return;
    Object.assign(e, readEventForm());
    S.calSel = e.date;
    closeModal(); save(); render();
    toast('Evento actualizado', e.title, 'ok');
  },

  /* proyectos */
  'project-new': (el) => projectModal(null, el.dataset.id),
  'project-edit': (el) => { const p = getProject(el.dataset.id); if (p) projectModal(p); },
  'project-del': (el) => {
    const i = DB.projects.findIndex(p => p.id === el.dataset.id);
    if (i >= 0) { DB.projects.splice(i, 1); closeModal(); save(); render(); toast('Proyecto eliminado', '', 'bad'); }
  },
  'pr-save-new': () => {
    const v = readProjectForm();
    const p = { id: uid('p'), ...v, created: Date.now() };
    DB.projects.unshift(p);
    closeModal(); save(); render();
    logActivity('Creó', v.title, 'projects');
    toast('Proyecto creado', v.title, 'ok');
    beep('ok');
  },
  'pr-save': (el) => {
    const p = getProject(el.dataset.id); if (!p) return;
    Object.assign(p, readProjectForm());
    closeModal(); save(); render();
    toast('Proyecto guardado', p.title, 'ok');
  },
  /* mueve una tarjeta de columna sin arrastrar: accesible con el dedo */
  'project-move': (el) => {
    const p = getProject(el.dataset.id); if (!p) return;
    const i = COLS.findIndex(c => c.k === p.col);
    const j = i + Number(el.dataset.dir);
    if (j < 0 || j >= COLS.length) return;
    const destino = COLS[j].k;
    // reordena la lista global para que la tarjeta quede en su columna
    const actual = DB.projects.findIndex(x => x.id === p.id);
    p.col = destino;
    DB.projects.splice(actual, 1);
    const ultima = DB.projects.reduce((acc, x, idx) => (x.col === destino ? idx : acc), -1);
    DB.projects.splice(ultima + 1, 0, p);
    save(); render();
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { } }
    toast(p.title, `→ ${colLabel(destino)}`, 'ok', 2000);
  },

  /* notas */
  'note-new': () => newNote(),
  'note-pick': (el) => { S.noteSel = el.dataset.id; render(); },
  'note-folder': (el) => { S.noteFolder = el.dataset.id; S.noteSel = null; render(); },
  'note-pin': (el) => { const n = getNote(el.dataset.id); if (!n) return; n.pinned = !n.pinned; save(); render(); toast(n.pinned ? 'Nota fijada' : 'Nota desfijada', n.title, 'info', 2000); },
  'note-del': (el) => {
    const i = DB.notes.findIndex(n => n.id === el.dataset.id);
    if (i >= 0) { DB.notes.splice(i, 1); if (S.noteSel === el.dataset.id) S.noteSel = null; save(); render(); toast('Nota eliminada', '', 'bad'); }
  },

  /* notificaciones */
  notif: () => openPanel(),
  'notif-close': () => closePanel(),
  'notif-read-all': () => {
    DB.notifications.forEach(n => { n.read = true; });
    save(); paintNotifs();
    toast('Todas marcadas como leídas', '', 'ok', 2000);
  },
  'nt-read': (el, e) => {
    if (e.target.closest('[data-act="nt-del"]')) return;
    const n = DB.notifications.find(x => x.id === el.dataset.id);
    if (!n) return;
    n.read = !n.read;
    save(); paintNotifs();
  },
  'nt-del': (el, e) => {
    e.stopPropagation();
    const row = el.closest('.nt');
    const i = DB.notifications.findIndex(x => x.id === el.dataset.id);
    if (i < 0) return;
    row.classList.add('removing');
    setTimeout(() => { DB.notifications.splice(i, 1); save(); paintNotifs(); }, 220);
  },

  /* ajustes */
  'set-toggle': (el) => {
    const k = el.dataset.id;
    if (k === 'collapsed') { setSetting('collapsed', !DB.settings.collapsed); return; }
    setSetting(k, !DB.settings[k]);
  },
  'set-dens': (el) => setSetting('density', el.dataset.id),
  'set-accent': (el) => { setSetting('accent', el.dataset.id); toast('Acento aplicado', el.dataset.id, 'ok', 1800); },
  'data-export': () => exportData(),
  'data-reset': () => confirmModal({
    title: '¿Restablecer NEXUS?',
    body: 'Se borrarán todas las tareas, eventos, proyectos y notas, y se recuperarán los datos de ejemplo. No se puede deshacer.',
    onYes: () => { localStorage.removeItem(KEY); location.reload(); }
  }),

  palette: () => openPalette()
};

/* ---------- toggle de tarea, sin re-render ---------- */
/* Al completar no reconstruimos la vista: se actualiza la fila en el sitio y
   solo los contadores afectados. Así no hay parpadeo ni salto de scroll. */
function toggleTask(id) {
  const t = getTask(id);
  if (!t) return;
  const btn = $(`.chk[data-id="${id}"]`);
  const row = btn ? btn.closest('.task') : null;
  const next = !t.done;

  t.done = next;
  t.doneAt = next ? Date.now() : null;
  if (next) t.pct = 100; else if (t.pct === 100) t.pct = 60;

  if (next) {
    logActivity('Completó', t.title, 'check');
    notify('ok', 'Tarea completada', t.title);
    toast('Completada', t.title, 'ok');
    beep('ok');
  } else {
    toast('Reabierta', t.title, 'info', 2000);
    beep('tick');
  }
  save();

  // la fila actualiza en el sitio: check, tachado, porcentaje y chips
  if (row) {
    row.classList.toggle('done', next);
    btn.classList.add('burst');
    if (next) btn.classList.add('on');
    else btn.classList.remove('on');
    const pct = $('.task-pct', row);
    if (pct) pct.textContent = (next ? 100 : t.pct || 0) + '%';
    // una tarea completada deja de mostrar la barra de avance
    const bar = row.querySelector(':scope > .prog');
    if (bar) bar.remove();
    // marca de completada
    let done = row.querySelector('.task-meta .m.done');
    if (next && !done) {
      const m = document.createElement('span');
      m.className = 'm done';
      m.style.color = 'var(--ok)';
      m.innerHTML = icon('check') + 'Completada';
      $('.task-meta', row).appendChild(m);
    } else if (!next && done) done.remove();
  }

  // Actualización en sitio: el check, el tachado y los contadores responden al
  // clic. Después, un re-render SILENCIOSO y diferido (ya sin anillo visible)
  // refresca lo que depende del estado: actividad, KPIs, regroupación.
  if (S.route === 'dashboard' || S.route === 'hoy') paintStats();

  if (DB.settings.animations) setTimeout(() => render(), 700);
  else render();
}

/* ---------- crear nota ---------- */
function newNote() {
  const n = { id: uid('n'), title: 'Nueva nota', body: '', folder: S.noteFolder === 'todas' ? 'Personal' : S.noteFolder, pinned: false, updated: Date.now() };
  DB.notes.unshift(n);
  S.noteSel = n.id;
  save(); go('notas');
  setTimeout(() => { const t = $('#noteTitle'); if (t) { t.focus(); t.select(); } }, 80);
}

/* ---------- ajustes ---------- */
function setSetting(k, v) {
  DB.settings[k] = v;
  save(); applySettings(); render();
}
function applySettings() {
  const s = DB.settings;
  const root = document.documentElement;
  root.style.setProperty('--blur', s.blur + 'px');
  root.style.setProperty('--fs', (s.scale / 100).toFixed(2));
  document.body.classList.toggle('oled', !!s.oled);
  document.body.classList.toggle('no-anim', !s.animations);
  document.body.classList.toggle('collapse', !!s.collapsed);
  document.body.dataset.dens = s.density || 'normal';
  document.body.dataset.accent = s.accent || 'blue';
  // hint del teclado según plataforma
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $('#kbdHint').textContent = mac ? '⌘K' : 'Ctrl K';
}
function exportData() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nexus-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Datos exportados', a.download, 'ok');
}

/* ---------- bloqueo ---------- */
function lockApp() {
  const root = document.createElement('div');
  root.className = 'too-small';
  root.style.cssText = 'display:grid;z-index:960;background:rgba(0,0,0,.9)';
  root.innerHTML = `<div class="ts-card">
    <div class="ts-mark">NEXUS</div>
    <h1>Sesión bloqueada</h1>
    <p>Pulsa para volver a tu espacio de trabajo.</p>
    <button class="btn primary" id="unlock" style="margin-top:.8rem">Desbloquear</button></div>`;
  document.body.appendChild(root);
  const ul = () => { root.remove(); window.removeEventListener('keydown', ul); };
  root.addEventListener('click', ul);
  window.addEventListener('keydown', ul);
  setTimeout(ul, 6000);
}

/* ================================================================
   EVENTOS GLOBALES
   ================================================================ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

/* reloj */
function tickClock() {
  const d = new Date();
  $('#clockTime').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  $('#clockDate').textContent = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* inputs con persistencia en caliente. Se guardan referencias y no el evento,
   para que dos ediciones seguidas en el mismo tick no se pisen entre sí. */
const pendingInputs = new Map();
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'taskQ' || t.id === 'noteQ') {
    pendingInputs.set(t.id, t.value);
    return;
  }
  if (t.id === 'noteTitle' || t.id === 'noteBody') {
    pendingInputs.set(t.id, t.value);
  }
}, { passive: true });

function flushInputs() {
  if (pendingInputs.has('taskQ')) {
    S.taskFilter.q = pendingInputs.get('taskQ');
    pendingInputs.delete('taskQ');
    renderSoft();
    return;                                  // el render recrea los demás campos
  }
  if (pendingInputs.has('noteQ')) {
    S.noteQ = pendingInputs.get('noteQ');
    pendingInputs.delete('noteQ');
    renderSoft();
    return;
  }
  const n = getNote(S.noteSel);
  if (n) {
    if (pendingInputs.has('noteTitle')) { n.title = pendingInputs.get('noteTitle'); n.updated = Date.now(); }
    if (pendingInputs.has('noteBody')) { n.body = pendingInputs.get('noteBody'); n.updated = Date.now(); }
    if (pendingInputs.has('noteTitle') || pendingInputs.has('noteBody')) {
      const chip = $('#noteSaved');
      if (chip) chip.innerHTML = icon('check') + 'Guardado';
      const foot = $('.note-foot');
      if (foot && pendingInputs.has('noteBody')) {
        const txt = n.body;
        foot.querySelector('span').textContent =
          `${txt.length} caracteres · ${txt.trim().split(/\s+/).filter(Boolean).length} palabras`;
      }
    }
  }
  pendingInputs.clear();
  save();
}
document.addEventListener('input', debounce(flushInputs, 260));

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'taskSort') { S.taskFilter.sort = t.value; render(); }
  if (t.dataset && t.dataset.act === 'set-range') {
    const k = t.dataset.id, v = Number(t.value);
    DB.settings[k] = v; save(); applySettings();
    const num = t.parentElement.querySelector('.num');
    if (num) num.textContent = k === 'blur' ? v + 'px' : v + '%';
  }
  if (t.dataset && t.dataset.act === 'set-name') {
    DB.settings.greetingName = t.value.trim() || 'Jesús'; save(); applySettings();
  }
});

/* scroll de la vista → sombra suave en la topbar.
   Se cachean los nodos y se comprueban: si el DOM cambia (por ejemplo tras
   un re-render), un $() directo sobre un elemento ausente lanza TypeError. */
const viewEl = $('#view'), topbarEl = $('#topbar');
if (viewEl && topbarEl) {
  viewEl.addEventListener('scroll', () => {
    topbarEl.style.boxShadow = viewEl.scrollTop > 4
      ? '0 1px 0 var(--stroke), 0 10px 30px -20px rgba(0,0,0,.9)' : '';
  }, { passive: true });
}

/* teclado */
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palOpen ? closePalette() : openPalette(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); closePalette(); taskModal(null); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); setSetting('collapsed', !DB.settings.collapsed); return; }

  if (palOpen) {
    if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); palRun(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'Tab') { e.preventDefault(); palMove(e.shiftKey ? -1 : 1); }
    return;
  }

  if (e.key === 'Escape') {
    if (!$('#modalRoot').hidden) { closeModal(); return; }
    if ($('#notifPanel').getAttribute('aria-hidden') === 'false') { closePanel(); return; }
    return;
  }

  if (typing) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;

  const byKey = ROUTES.find(r => r.kbd === e.key);
  if (byKey) { go(byKey.k); return; }
  if (e.key === '?') { openPalette(); }
});

/* cerrar el panel al hacer clic en el velo */
$('#scrim').addEventListener('click', closePanel);

/* ================================================================
   ARRANQUE
   ================================================================ */
function boot() {
  const fresh = !load();
  if (fresh) seed();

  applySettings();
  S.route = ROUTES.some(r => r.k === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  render(true);
  tickClock();
  setInterval(tickClock, 1000);

  // iconos que el markup no puede generar por sí solo
  $('.collapse').innerHTML = icon('left');
  $('.icon-btn.sm[data-act="notif-close"]').innerHTML = icon('x');
  $('#navToggle').innerHTML = icon('menu');
  $('#mobileSearch').innerHTML = icon('search');

  // cajón móvil: velo, gesto de arrastre y sincronización con el ancho
  $('#navScrim').addEventListener('click', closeNav);
  window.addEventListener('resize', debounce(syncNavToViewport, 120));
  let navStartX = null, navStartY = null, navTracking = false;
  $('#sidebar').addEventListener('pointerdown', e => {
    if (!document.body.classList.contains('nav-open')) return;
    navStartX = e.clientX; navStartY = e.clientY; navTracking = true;
  }, { passive: true });
  document.addEventListener('pointerup', e => {
    if (!navTracking) return;
    navTracking = false;
    const dx = e.clientX - navStartX, dy = e.clientY - navStartY;
    // arrastre horizontal jelasimo hacia la izquierda = cerrar
    if (dx < -55 && Math.abs(dy) < 45) closeNav();
  }, { passive: true });

  // drag & drop del tablero y de las tarjetas del panel
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerdown', dashPointerDown);

  // paleta: entrada y navegación con ratón
  $('#palInput').addEventListener('input', debounce(e => { palSel = 0; paintPalette(e.target.value); }, 90));
  $('#palList').addEventListener('click', e => {
    const b = e.target.closest('[data-pi]');
    if (!b) return;
    palSel = Number(b.dataset.pi);
    palRun();
  });
  $('#paletteWrap').addEventListener('click', e => { if (e.target === $('#paletteWrap')) closePalette(); });

  // recordatorio suave al final del día
  setTimeout(() => {
    const h = new Date().getHours();
    const pend = openTasks().filter(t => t.date <= todayISO()).length;
    if (pend && h >= 18 && h < 22) {
      notify('info', 'Pendientes de hoy', `${pend} ${pend === 1 ? 'tarea sigue' : 'tareas siguen'} abierta${pend === 1 ? '' : 's'}.`);
      paintNotifDot();
    }
  }, 9000);

  // avisos de cambios en las tareas (patrón ocupado / esperando)
  const blocked = DB.projects.filter(p => p.col === 'blocked').length;
  if (blocked) {
    setTimeout(() => toast(`${blocked} ${blocked === 1 ? 'proyecto bloqueado' : 'proyectos bloqueados'}`,
      'Revisa si siguen needing algo', 'warn', 4200), 1400);
  }

  App.postLoad = () => { render(); };
  document.body.dataset.ready = '1';
  console.log('[nexus] listo ·', DB.tasks.length, 'tareas ·', DB.projects.length, 'proyectos');
}
boot();