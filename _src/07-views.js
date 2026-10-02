/* ================================================================
   NEXUS · estado de UI, router y vistas
   ================================================================ */

const S = App.state = {
  route: 'dashboard',
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  calSel: todayISO(),
  taskFilter: { q: '', prio: 'all', range: 'abiertas', sort: 'date', view: 'all' },
  noteFolder: 'todas', noteQ: '', noteSel: null,
  boardCol: null,
  statsRange: 7
};

/* ---------- toasts ---------- */
const TCOLOR = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)', accent: 'var(--accent)' };
const TICON = { ok: 'check', warn: 'flag', bad: 'bug', info: 'bell', accent: 'sparkle' };
function toast(title, sub = '', type = 'ok', ms = 3200) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.setProperty('--tc', TCOLOR[type] || TCOLOR.accent);
  el.style.setProperty('--td', ms + 'ms');
  el.innerHTML = `<span class="tic">${icon(TICON[type] || 'sparkle')}</span>
    <span class="tx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, ms);
  return el;
}

/* ---------- sonido (WebAudio, sin ficheros) ---------- */
let audioCtx = null;
function beep(kind = 'ok') {
  if (!DB.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = kind === 'ok' ? [660, 880] : kind === 'bad' ? [340, 240] : [520];
    seq.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * .07);
      g.gain.exponentialRampToValueAtTime(.05, audioCtx.currentTime + i * .07 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + i * .07 + .16);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + i * .07); o.stop(audioCtx.currentTime + i * .07 + .18);
    });
  } catch (e) { /* sin audio disponible */ }
}

/* ---------- actividad ---------- */
function logActivity(kind, what, ic = 'sparkle') {
  DB.activity.unshift({ id: uid('a'), kind, what, icon: ic, ts: Date.now(), user: 'Jesús' });
  DB.activity = DB.activity.slice(0, 40);
}
function notify(type, title, body) {
  DB.notifications.unshift({ id: uid('n'), type, title, body, ts: Date.now(), read: false });
  DB.notifications = DB.notifications.slice(0, 30);
  save(); paintNotifDot();
}

/* ---------- selects ---------- */
const PRIOS = [{ k: 'alta', l: 'Alta', c: 'p-alta' }, { k: 'media', l: 'Media', c: 'p-media' }, { k: 'baja', l: 'Baja', c: 'p-baja' }];
const prioLabel = k => (PRIOS.find(p => p.k === k) || {}).l || 'Media';
const prioChip = k => `<span class="chip ${k === 'alta' ? 'p-alta' : k === 'baja' ? 'p-baja' : 'p-media'}"><i class="dot"></i>${prioLabel(k)}</span>`;
const COLS = [
  { k: 'todo', l: 'Pendiente', c: 'var(--txt-3)' },
  { k: 'doing', l: 'En progreso', c: 'var(--accent)' },
  { k: 'blocked', l: 'Bloqueado', c: 'var(--bad)' },
  { k: 'done', l: 'Completado', c: 'var(--ok)' }
];
const colLabel = k => (COLS.find(c => c.k === k) || COLS[0]).l;
const EVENT_COLORS = ['accent', 'mint', 'warn', 'bad', 'info', 'accent-2', 'ok'];

/* ---------- selectores derivados ---------- */
const openTasks = () => DB.tasks.filter(t => !t.done);
const tasksOfDay = iso => DB.tasks.filter(t => t.date === iso);
const eventsOfDay = iso => DB.events.filter(e => e.date === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
const projectsOf = col => DB.projects.filter(p => p.col === col);
const getTask = id => DB.tasks.find(t => t.id === id);
const getEvent = id => DB.events.find(e => e.id === id);
const getProject = id => DB.projects.find(p => p.id === id);
const getNote = id => DB.notes.find(n => n.id === id);
const ntOfCol = col => DB.projects.filter(p => p.col === col).length;

function dayProgress(iso) {
  const list = tasksOfDay(iso);
  if (!list.length) return 0;
  return Math.round(list.reduce((s, t) => s + (t.done ? 100 : (t.pct || 0)), 0) / list.length);
}
function upcomingEvents(limit = 4) {
  const t = todayISO();
  const future = DB.events.filter(e => e.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = DB.events.filter(e => e.date < t).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  return future.concat(past).slice(0, limit);
}
function greeting() {
  const h = new Date().getHours();
  const n = esc(DB.settings.greetingName || 'Jesús');
  if (h < 6) return `Buenas noches, ${n}`;
  if (h < 13) return `Buenos días, ${n}`;
  if (h < 20) return `Buenas tardes, ${n}`;
  return `Buenas noches, ${n}`;
}

/* ================================================================
   VISTAS
   ================================================================ */
const VIEWS = {};

/* ---------------- DASHBOARD ---------------- */
VIEWS.dashboard = function () {
  const t = todayISO();
  const today = tasksOfDay(t), open = openTasks();
  const doneToday = today.filter(x => x.done).length;
  const pct = dayProgress(t);
  const overdue = open.filter(x => x.due && x.due < t);
  const evs = upcomingEvents(5);
  const active = DB.projects.filter(p => p.col !== 'done').sort((a, b) => b.pct - a.pct).slice(0, 4);
  const acts = DB.activity.slice(0, 6);

  // serie de 7 días: % de completado
  const serie = Array.from({ length: 7 }, (_, i) => {
    const d = ymd(addDays(new Date(), i - 6));
    return { d, v: dayProgress(d) };
  });

  const spark = serie.map((p, i) => `<rect class="bar" x="${i * 8.4}" y="${22 - p.v * .2}" width="5.6" height="${Math.max(2, p.v * .2)}" rx="1.6"><title>${fmtFecha(p.d, { force: true })} · ${p.v}%</title></rect>`).join('');

  const ringC = 2 * Math.PI * 26;
  const kpiCard = (label, val, delta, deltaDir, ic) => `
    <div class="card kpi hoverable">
      <div class="kpi-top">
        <div class="stat"><b>${val}</b><span>${label}</span></div>
        <div class="ico">${icon(ic)}</div>
      </div>
      ${delta ? `<div><span class="delta ${deltaDir}">${delta}</span></div>` : '<div class="muted" style="font-size:.68rem">&nbsp;</div>'}
    </div>`;

  return `
  <div class="page">
    <div class="hero">
      <div>
        <div class="eyebrow" style="margin-bottom:.4rem">${fmtFechaLarga(t)}</div>
        <h1>${greeting()}</h1>
        <p>${
          open.length === 0
            ? 'No te queda nada pendiente. Buen momento para mirar el calendario.'
            : `Tienes <b>${open.length}</b> ${open.length === 1 ? 'tarea abierta' : 'tareas abiertas'}${overdue.length ? ` y <b>${overdue.length}</b> ${overdue.length === 1 ? 'vencida' : 'vencidas'}` : ''}.`
        }</p>
        <div class="hero-acts">
          <button class="btn primary" data-act="task-new">${icon('plus')}Nueva tarea</button>
          <button class="btn" data-act="note-new">${icon('notes')}Nueva nota</button>
          <button class="btn ghost" data-act="go" data-id="hoy">${icon('today')}Ver mi día</button>
        </div>
      </div>
      <div class="ring">
        <svg width="100%" height="100%" viewBox="0 0 60 60">
          
          <circle class="bg" cx="30" cy="30" r="26"/>
          <circle class="fg" cx="30" cy="30" r="26" stroke-dasharray="${ringC}" stroke-dashoffset="${ringC * (1 - pct / 100)}"/>
        </svg>
        <div class="ring-txt"><b id="ringPct">${pct}%</b><span>hoy</span></div>
      </div>
    </div>

    <div class="kpis">
      ${kpiCard('completadas hoy', doneToday + '/' + today.length, pct + '%', 'up', 'check')}
      ${kpiCard('abiertas', open.length, overdue.length ? overdue.length + ' vencidas' : 'al día', overdue.length ? 'dn' : 'up', 'list')}
      ${kpiCard('eventos hoy', eventsOfDay(t).length, null, '', 'calendar')}
      ${kpiCard('proyectos', DB.projects.filter(p => p.col !== 'done').length, `${DB.projects.filter(p => p.col === 'done').length} cerrados`, 'up', 'projects')}
    </div>

    <div class="grid g-3">
      <div class="card span-2">
        <div class="card-h">
          <h3>${icon('tasks')}Tareas de hoy</h3>
          <span class="hint">${doneToday}/${today.length}</span>
          <button class="btn ghost xs" data-act="go" data-id="tareas">Ver todas</button>
        </div>
        <div class="card-b tight">
          <div class="lst" id="dashTasks">
            ${today.length ? today.map(taskRow).join('') :
              `<div class="empty">${icon('sparkle')}<b>Hoy no hay tareas</b><p>Crea la primera y aparecerá aquí con su progreso.</p></div>`}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>${icon('fire')}Ritmo semanal</h3><span class="hint">7 días</span></div>
        <div class="card-b">
          <svg class="chart" viewBox="0 0 54 26" style="height:5.6rem" preserveAspectRatio="none">
            
            ${spark}
          </svg>
          <div class="row" style="margin-top:.5rem;justify-content:space-between;font-size:.6rem;color:var(--txt-4)">
            ${serie.map(p => `<span>${DIAS_C[(parseYMD(p.d).getDay() + 6) % 7][0]}</span>`).join('')}
          </div>
          <div class="row" style="margin-top:.7rem;gap:.45rem;flex-wrap:wrap">
            <span class="chip"><i class="dot" style="background:var(--accent)"></i>Media ${Math.round(serie.reduce((s, p) => s + p.v, 0) / 7)}%</span>
            <span class="chip">${tasksOfDay(todayISO()).filter(x => x.done).length} de ${tasksOfDay(todayISO()).length}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid g-3">
      <div class="card">
        <div class="card-h"><h3>${icon('calendar')}Próximos eventos</h3>
          <button class="btn ghost xs" data-act="go" data-id="calendario">Abrir</button></div>
        <div class="card-b tight">
          ${evs.length ? evs.map(evRow).join('') :
            `<div class="empty">${icon('calendar')}<b>Sin eventos</b><p>Abre el calendario y programa el próximo.</p></div>`}
        </div>
      </div>

      <div class="card span-2">
        <div class="card-h"><h3>${icon('projects')}Proyectos activos</h3>
          <button class="btn ghost xs" data-act="go" data-id="proyectos">Tablero</button></div>
        <div class="card-b" style="display:flex;flex-direction:column;gap:.7rem">
          ${active.length ? active.map(p => `
            <div class="lst-row" data-act="project-edit" data-id="${p.id}" style="cursor:pointer">
              <span style="width:.42rem;height:.42rem;border-radius:50%;flex:none;background:${p.col === 'blocked' ? 'var(--bad)' : 'var(--accent)'};box-shadow:0 0 8px currentColor"></span>
              <span class="tt">
                <b>${esc(p.title)}</b>
                <small><span class="prog" style="flex:1;max-width:9rem"><i style="width:${p.pct}%"></i></span>
                <span class="mono">${p.pct}%</span><span class="sep">·</span>${colLabel(p.col)}</small>
              </span>
              ${prioChip(p.prio)}
            </div>`).join('') :
            `<div class="empty">${icon('projects')}<b>Sin proyectos activos</b><p>Crea uno para empezar a seguir el avance.</p></div>`}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>${icon('zap')}Actividad reciente</h3>
        <span class="hint">${DB.activity.length} registros</span></div>
      <div class="card-b">
        <div class="feed">
          ${acts.length ? acts.map(a => `
            <div class="feed-row">
              <span class="feed-ico">${icon(a.icon || 'sparkle')}</span>
              <div class="feed-b"><p><b>${esc(a.user || 'Jesús')}</b> ${esc(a.kind.toLowerCase())} <b>${esc(a.what)}</b></p>
              <time>${relTime(a.ts)}</time></div>
            </div>`).join('') :
            `<div class="empty">${icon('zap')}<b>Sin actividad</b><p>Lo que vayas haciendo aparecerá en este registro.</p></div>`}
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------------- HOY ---------------- */
VIEWS.hoy = function () {
  const t = todayISO();
  const list = tasksOfDay(t);
  const pend = list.filter(x => !x.done), done = list.filter(x => x.done);
  const evs = eventsOfDay(t);
  const mins = list.reduce((s, x) => s + (x.done ? (x.time ? 45 : 0) : 0), 0);
  const pct = dayProgress(t);

  return `
  <div class="page">
    <div class="grid g-4">
      <div class="card kpi"><div class="stat"><b id="statPend">${pend.length}</b><span>Pendientes</span></div>
              <div class="prog"><i style="width:${pct}%"></i></div></div>
            <div class="card kpi"><div class="stat"><b id="statDone">${done.length}</b><span>Completadas</span></div>
              <div class="muted" style="font-size:.76rem" id="distDone">${list.length ? Math.round(done.length / list.length * 100) : 0}% del día</div></div>
      <div class="card kpi"><div class="stat"><b>${evs.length}</b><span>Eventos</span></div>
        <div class="muted" style="font-size:.68rem">${evs.length ? 'Próximo a las ' + (evs[0].time || '—') : 'Día despejado'}</div></div>
      <div class="card kpi"><div class="stat"><b>${mins}</b><span>Minutos hechos</span></div>
        <div class="muted" style="font-size:.68rem">Tiempo estimado cerrado</div></div>
    </div>

    <div class="grid g-3">
      <div class="card span-2">
        <div class="card-h"><h3>${icon('today')}Agenda de hoy</h3>
          <span class="hint">${fmtFechaLarga(t)}</span>
          <button class="btn primary xs" data-act="task-new">${icon('plus')}Añadir</button></div>
        <div class="card-b" style="display:flex;flex-direction:column;gap:.45rem">
          ${pend.length ? pend.map(taskRow).join('') : ''}
          ${done.length ? `<div class="eyebrow" style="margin-top:.5rem">Completadas · ${done.length}</div>` : ''}
          ${done.map(taskRow).join('')}
          ${!list.length ? `<div class="empty">${icon('sparkle')}<b>Día vacío</b><p>Añade una tarea o evento para empezar el día.</p>
            <button class="btn xs" data-act="task-new" style="margin-top:.4rem">${icon('plus')}Crear tarea</button></div>` : ''}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:var(--gap)">
        <div class="card">
          <div class="card-h"><h3>${icon('calendar')}Línea de tiempo</h3></div>
          <div class="card-b tight">
            ${evs.length ? evs.map(e => `
              <div class="lst-row" data-act="event-edit" data-id="${e.id}" style="cursor:pointer">
                <span class="mono" style="font-size:.72rem;color:var(--txt-3);min-width:2.6rem">${hhmm(e.time)}</span>
                <span class="tt"><b>${esc(e.title)}</b><small>${e.dur} min${e.notes ? ' · ' + esc(e.notes) : ''}</small></span>
                <span style="width:.42rem;height:.42rem;border-radius:50%;flex:none;background:var(--${e.color === 'mint' ? 'ok' : e.color === 'accent' ? 'accent' : e.color});box-shadow:0 0 8px currentColor"></span>
              </div>`).join('') :
              `<div class="empty">${icon('calendar')}<b>Sin eventos hoy</b><p>Un día sin citas es un día para avanzar trabajo.</p></div>`}
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h3>${icon('target')}Distribución</h3></div>
          <div class="card-b">
            ${(() => {
              const byP = PRIOS.map(p => ({ ...p, n: list.filter(x => x.prio === p.k && !x.done).length }));
              const tot = byP.reduce((s, p) => s + p.n, 0) || 1;
              const col = { alta: 'var(--bad)', media: 'var(--warn)', baja: 'var(--ok)' };
              return `<div class="hbar">${byP.map(p => `
                <div class="hbar-row">
                  <span class="l">${p.l}</span>
                  <span class="prog"><i style="width:${p.n / tot * 100}%;background:${col[p.k]}"></i></span>
                  <span class="v">${p.n}</span>
                </div>`).join('')}</div>`;
            })()}
          </div>
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------------- TAREAS ---------------- */
VIEWS.tareas = function () {
  const f = S.taskFilter;
  let list = openTasks();
  if (f.range === 'todas') list = DB.tasks.slice();
  if (f.prio !== 'all') list = list.filter(t => t.prio === f.prio);
  const t0 = todayISO();
  if (f.range === 'hoy') list = list.filter(t => t.date === t0);
  if (f.range === 'semana') list = list.filter(t => t.due && t.due >= t0 && t.due <= ymd(addDays(new Date(), 7)));
  if (f.range === 'vencidas') list = list.filter(t => t.due && t.due < t0);
  if (f.range === 'fav') list = list.filter(t => t.fav);

  const q = f.q.trim().toLowerCase();
  if (q) list = list.filter(t =>
    t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q) ||
    (t.cat || '').toLowerCase().includes(q) || (t.tags || []).join(' ').toLowerCase().includes(q));

  const prioRank = { alta: 0, media: 1, baja: 2 };
  const cmp = {
    fecha: (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99'),
    prioridad: (a, b) => prioRank[a.prio] - prioRank[b.prio],
    progreso: (a, b) => (a.pct || 0) - (b.pct || 0),
    titulo: (a, b) => a.title.localeCompare(b.title, 'es'),
    creado: (a, b) => (b.created || 0) - (a.created || 0)
  };
  list = list.slice().sort(cmp[f.sort] || cmp.fecha);

  const groups = f.range === 'todas'
    ? [['hoy', 'Hoy', list.filter(t => t.date === t0)], ['futuro', 'Próximos días', list.filter(t => t.date > t0)],
       ['vencido', 'Vencidos', list.filter(t => t.date && t.date < t0)], ['sin', 'Sin fecha', list.filter(t => !t.date)]]
    : [['todo', f.range === 'todas' ? 'Todas' : 'Resultados', list]];

  return `
  <div class="page">
    <div class="card toolbar">
      <div class="search-i"><span class="ic"></span>
        <input id="taskQ" type="text" placeholder="Buscar por título, descripción, categoría o etiqueta…" value="${esc(f.q)}" /></div>
      <div class="seg" id="prioSeg">
        ${['all', 'alta', 'media', 'baja'].map(k =>
          `<button data-act="task-prio" data-id="${k}" class="${f.prio === k ? 'on' : ''}">${k === 'all' ? 'Todas' : prioLabel(k)}</button>`).join('')}
      </div>
      <div class="seg" id="rangeSeg">
        ${[['abiertas', 'Abiertas'], ['hoy', 'Hoy'], ['semana', 'Semana'], ['vencidas', 'Vencidas'], ['fav', 'Favoritas'], ['todas', 'Completadas']].map(([k, l]) =>
          `<button data-act="task-range" data-id="${k}" class="${f.range === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <select class="select" id="taskSort" style="width:auto;height:1.95rem;font-size:.76rem">
        ${[['fecha', 'Por fecha'], ['prioridad', 'Por prioridad'], ['progreso', 'Por progreso'], ['titulo', 'Alfabética'], ['creado', 'Más recientes']].map(([k, l]) =>
          `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <button class="btn primary" data-act="task-new">${icon('plus')}Nueva</button>
    </div>

    <div class="row wrap" style="gap:.4rem">
      <span class="eyebrow" id="taskCount">${list.length} ${list.length === 1 ? 'tarea' : 'tareas'}</span>
      ${CATS.filter(c => DB.tasks.some(t => t.cat === c)).map(c => `<span class="chip">${c}</span>`).join('')}
    </div>

    <div class="grid g-3" id="taskGroups">
      ${groups.map(([k, label, items]) => {
        if (!items.length) return '';
        return `<div class="card ${k === 'todo' ? 'span-3' : ''}">
          <div class="card-h"><h3>${icon(k === 'vencido' ? 'flag' : 'list')}${label}</h3><span class="hint">${items.length}</span></div>
          <div class="card-b" style="display:flex;flex-direction:column;gap:.42rem">${items.map(taskRow).join('')}</div>
        </div>`;
      }).join('')}
      ${!list.length ? `<div class="card span-3"><div class="empty">${icon('search')}
        <b>Nada coincide</b><p>Prueba con otro texto, quita el filtro de prioridad o crea la tarea que buscas.</p>
        <div class="row" style="margin-top:.5rem;gap:.4rem">
          <button class="btn xs" data-act="task-reset">${icon('refresh')}Limpiar filtros</button>
          <button class="btn primary xs" data-act="task-new">${icon('plus')}Nueva tarea</button>
        </div></div></div>` : ''}
    </div>
  </div>`;
};

/* fila de tarea reutilizada en dashboard / hoy / tareas */
function taskRow(t) {
  const rel = relDia(t.due);
  return `
  <div class="task p-${t.prio} ${t.done ? 'done' : ''}" data-id="${t.id}">
    <button class="chk ${t.done ? 'on' : ''}" data-act="task-toggle" data-id="${t.id}" aria-label="Completar tarea">
      <span class="ringfx"></span>${icon('check')}
    </button>
    <div class="task-b">
      <h4><span class="t">${esc(t.title)}</span>
        ${t.fav ? `<span class="star on" data-act="task-fav" data-id="${t.id}" style="width:.75rem;height:.75rem">${icon('star')}</span>` : ''}
      </h4>
      ${t.desc ? `<p class="desc">${esc(t.desc)}</p>` : ''}
      <div class="task-meta">
        ${prioChip(t.prio)}
        ${t.cat ? `<span class="chip">${esc(t.cat)}</span>` : ''}
        ${(t.tags || []).slice(0, 2).map(g => `<span class="tag">${esc(g)}</span>`).join('')}
        ${rel ? `<span class="m ${rel.late ? 'late' : ''}">${icon('clock')}${rel.txt}${t.time ? ' · ' + hhmm(t.time) : ''}</span>` : ''}
        ${t.done ? `<span class="m" style="color:var(--ok)">${icon('check')}Completada</span>` : ''}
      </div>
    </div>
    ${!t.done && t.pct > 0 ? `<span class="prog" style="width:4.2rem;flex:none"><i style="width:${t.pct}%"></i></span>` : ''}
    <span class="task-pct">${t.done ? '100' : t.pct || 0}%</span>
    <div class="task-acts">
      <button class="icon-btn sm" data-act="task-edit" data-id="${t.id}" title="Editar">${icon('edit')}</button>
      <button class="icon-btn sm" data-act="task-del" data-id="${t.id}" title="Eliminar">${icon('trash')}</button>
    </div>
  </div>`;
}

function evRow(e) {
  const c = { accent: 'var(--accent)', mint: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)', 'accent-2': 'var(--accent-2)', ok: 'var(--ok)' }[e.color] || 'var(--accent)';
  return `
  <div class="lst-row" data-act="event-edit" data-id="${e.id}" style="cursor:pointer">
    <span style="width:.4rem;height:.4rem;border-radius:50%;flex:none;background:${c};box-shadow:0 0 8px ${c}"></span>
    <span class="tt"><b>${esc(e.title)}</b>
      <small><span class="mono">${hhmm(e.time)}</span><span class="sep">·</span>${fmtFecha(e.date)}${e.date === todayISO() ? '' : ''}</small></span>
    <span class="muted" style="font-size:.65rem">${e.dur}m</span>
  </div>`;
}

/* ---------------- CALENDARIO ---------------- */
VIEWS.calendario = function () {
  const y = S.calYear, m = S.calMonth, t = todayISO();
  const first = new Date(y, m, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const monthEvents = DB.events.filter(e => { const d = parseYMD(e.date); return d.getFullYear() === y && d.getMonth() === m; });

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const iso = ymd(d);
    const out = d.getMonth() !== m;
    const evs = eventsOfDay(iso);
    const shown = evs.slice(0, 3);
    const esHoy = iso === t;
    cells += `
      <div class="cal-cell ${out ? 'out' : ''} ${esHoy ? 'today' : ''} ${iso === S.calSel ? 'sel' : ''} ${evs.length ? 'has-ev' : ''} ${esHoy && evs.length ? 'has-today-ev' : ''}" data-act="cal-pick" data-id="${iso}">
        <span class="dn">${d.getDate()}</span>
        ${shown.map(e => `<span class="ev-dot" style="--ec:var(--${e.color === 'mint' ? 'ok' : e.color === 'accent' ? 'accent' : e.color === 'accent-2' ? 'accent-2' : e.color})" data-act="event-edit" data-id="${e.id}">${esc(e.title)}</span>`).join('')}
        ${evs.length > 3 ? `<span class="ev-dot more" data-act="cal-pick" data-id="${iso}">+${evs.length - 3} más</span>` : ''}
      </div>`;
  }

  const selEvs = eventsOfDay(S.calSel);
  const selTasks = tasksOfDay(S.calSel);

  return `
  <div class="page">
    <div class="cal-wrap">
      <div class="card">
        <div class="card-h">
          <div class="cal-nav">
            <button class="icon-btn sm" data-act="cal-prev" title="Mes anterior">${icon('left')}</button>
            <h3>${MESES_C[m]} ${y}</h3>
            <button class="icon-btn sm" data-act="cal-next" title="Mes siguiente">${icon('right')}</button>
            <button class="btn ghost xs" data-act="cal-today">Hoy</button>
          </div>
          <span class="grow"></span>
          <span class="hint">${monthEvents.length} eventos este mes</span>
          <button class="btn primary xs" data-act="event-new">${icon('plus')}Nuevo evento</button>
        </div>
        <div class="cal-grid">
          ${DIAS_C.map(d => `<div class="cal-dow">${d[0]}${d[1]}${d[2]}</div>`).join('')}
          ${cells}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:var(--gap)">
        <div class="card agenda">
          <div class="agenda-date">${fmtFechaLarga(S.calSel).split(' ').slice(0, 3).join(' ')}
            <small>${selEvs.length} ${selEvs.length === 1 ? 'evento' : 'eventos'}${selTasks.length ? ` · ${selTasks.length} tareas` : ''}</small></div>
          <div class="agenda-list">
            ${selEvs.length ? selEvs.map(e => `
              <div class="agenda-ev" style="--ec:var(--${e.color === 'mint' ? 'ok' : e.color === 'accent' ? 'accent' : e.color === 'accent-2' ? 'accent-2' : e.color})" data-act="event-edit" data-id="${e.id}">
                <div class="t"><b>${esc(e.title)}</b><small class="mono">${hhmm(e.time)} · ${e.dur} min</small></div>
                <button class="icon-btn sm x" data-act="event-del" data-id="${e.id}">${icon('x')}</button>
              </div>`).join('') :
              `<div class="empty" style="padding:1.4rem .5rem">${icon('calendar')}<b>Día libre</b><p>Sin eventos programados.</p></div>`}
          </div>
          <div class="row" style="gap:.4rem">
            <button class="btn xs" style="flex:1" data-act="event-new" data-id="${S.calSel}">${icon('plus')}Añadir evento</button>
            <button class="btn ghost xs" data-act="task-new" data-id="${S.calSel}">${icon('tasks')}Tarea</button>
          </div>
        </div>

        <div class="card">
          <div class="card-h"><h3>${icon('tasks')}Tareas del día</h3><span class="hint">${selTasks.filter(x => x.done).length}/${selTasks.length}</span></div>
          <div class="card-b tight">
            ${selTasks.length ? selTasks.map(taskRow).join('') :
              `<div class="empty" style="padding:1.2rem .5rem">${icon('list')}<b>Sin tareas</b><p>Este día no tiene tareas asignadas.</p></div>`}
          </div>
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------------- PROYECTOS ---------------- */
VIEWS.proyectos = function () {
  return `
  <div class="page">
    <div class="card toolbar">
      <div class="row grow" style="gap:.5rem">
        <span class="eyebrow">Tablero</span>
        <span class="muted" style="font-size:.72rem">Arrastra las tarjetas para cambiar de columna</span>
      </div>
      <span class="chip">${DB.projects.filter(p => p.col === 'doing').length} en curso</span>
      <span class="chip" style="color:#a9e8c9">${Math.round(DB.projects.reduce((s, p) => s + p.pct, 0) / (DB.projects.length || 1))}% medio</span>
      <button class="btn primary" data-act="project-new">${icon('plus')}Nuevo proyecto</button>
    </div>

    <div class="board" id="board">
      ${COLS.map(c => {
        const items = projectsOf(c.k);
        return `
        <div class="col" data-col="${c.k}" style="--cc:${c.c}">
          <div class="col-h"><span class="cd"></span><b>${c.l}</b><span class="n">${items.length}</span>
            <button class="icon-btn sm" data-act="project-new" data-id="${c.k}" title="Añadir en ${c.l}">${icon('plus')}</button></div>
          <div class="col-b" data-col="${c.k}">
            ${items.map(kcard).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
};

function kcard(p) {
  const idx = COLS.findIndex(c => c.k === p.col);
  const prev = COLS[idx - 1], next = COLS[idx + 1];
  return `
  <div class="kcard ${p.col === 'blocked' ? 'blocked' : ''} ${p.col === 'done' ? 'done-card' : ''}" data-id="${p.id}" data-col="${p.col}">
    <span class="grip">${icon('move')}</span>
    <div class="kcard-top">${prioChip(p.prio)}${(p.tags || []).slice(0, 1).map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>
    <h5><span class="t">${esc(p.title)}</span></h5>
    ${p.desc ? `<p class="kd">${esc(p.desc)}</p>` : ''}
    <div class="kcard-bot">
      ${p.col !== 'done' ? `<span class="prog"><i style="width:${p.pct}%"></i></span><span class="pc">${p.pct}%</span>` : `<span class="chip" style="color:#a9e8c9">${icon('check')}100%</span>`}
      ${p.due ? `<span class="muted mono" style="font-size:.71rem">${fmtFecha(p.due)}</span>` : ''}
    </div>
    <div class="kcard-bot" style="justify-content:space-between">
      <div class="kmove">
        <button data-act="project-move" data-id="${p.id}" data-dir="-1" ${prev ? '' : 'disabled'}
          title="${prev ? 'Mover a ' + prev.l : 'Ya está en la primera columna'}" aria-label="Mover a ${prev ? prev.l : 'inicio'}">${icon('up')}</button>
        <button data-act="project-move" data-id="${p.id}" data-dir="1" ${next ? '' : 'disabled'}
          title="${next ? 'Mover a ' + next.l : 'Ya está en la última columna'}" aria-label="Mover a ${next ? next.l : 'fin'}">${icon('down')}</button>
      </div>
      <div class="kacts">
        <button class="icon-btn sm" data-act="project-edit" data-id="${p.id}" title="Editar">${icon('edit')}</button>
        <button class="icon-btn sm" data-act="project-del" data-id="${p.id}" title="Eliminar">${icon('trash')}</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- NOTAS ---------------- */
VIEWS.notas = function () {
  const q = S.noteQ.toLowerCase().trim();
  const folders = ['todas', ...new Set(DB.notes.map(n => n.folder).filter(Boolean))];
  let list = DB.notes.filter(n => S.noteFolder === 'todas' || n.folder === S.noteFolder);
  if (q) list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  list = list.slice().sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));

  let sel = S.noteSel ? getNote(S.noteSel) : null;
  if (!sel) sel = list[0] || null;
  if (sel) S.noteSel = sel.id;

  return `
  <div class="page">
    <div class="notes">
      <div class="card notes-list">
        <div class="folders">
          ${folders.map(f => `
            <button class="folder ${S.noteFolder === f ? 'on' : ''}" data-act="note-folder" data-id="${esc(f)}">
              ${icon(f === 'todas' ? 'layers' : 'folder')}<span>${f === 'todas' ? 'Todas' : esc(f)}</span>
              <span class="n">${f === 'todas' ? DB.notes.length : DB.notes.filter(n => n.folder === f).length}</span>
            </button>`).join('')}
        </div>
        <div class="card-b tight" style="padding:.55rem;border-bottom:1px solid var(--stroke)">
          <div class="search-i" style="width:100%"><span class="ic"></span>
            <input id="noteQ" type="text" placeholder="Buscar notas…" value="${esc(S.noteQ)}" /></div>
        </div>
        <div class="card-b tight scroll-y notes-scroll">
          ${list.length ? list.map(n => `
            <button class="note-item ${sel && sel.id === n.id ? 'on' : ''}" data-act="note-pick" data-id="${n.id}">
              <b>${n.pinned ? icon('pin') : ''}${esc(n.title || 'Sin título')}</b>
              <p>${esc((n.body || '').replace(/\n+/g, ' ').slice(0, 70) || 'Vacía')}</p>
              <time>${relTime(n.updated)}</time>
            </button>`).join('') :
            `<div class="empty" style="padding:1.6rem .5rem">${icon('notes')}<b>Sin notas</b><p>No hay nada en esta carpeta todavía.</p></div>`}
        </div>
        <div class="card-f">
          <button class="btn primary xs" data-act="note-new" style="flex:1">${icon('plus')}Nueva nota</button>
        </div>
      </div>

      <div class="card note-edit">
        ${sel ? `
          <div class="note-head">
            <button class="icon-btn sm" data-act="note-pin" data-id="${sel.id}" title="Fijar" style="${sel.pinned ? 'color:var(--warn)' : ''}">${icon('pin')}</button>
            <input class="note-title" id="noteTitle" value="${esc(sel.title)}" placeholder="Título de la nota" />
            <span class="chip">${esc(sel.folder)}</span>
            <button class="icon-btn sm" data-act="note-del" data-id="${sel.id}" title="Eliminar">${icon('trash')}</button>
          </div>
          <div class="note-body">
            <textarea class="ntext" id="noteBody" placeholder="Escribe aquí…">${esc(sel.body || '')}</textarea>
          </div>
          <div class="note-foot">
            <span class="muted" style="font-size:.66rem">${sel.body.length} caracteres · ${(sel.body.trim().split(/\s+/).filter(Boolean).length)} palabras</span>
            <span class="grow"></span>
            <span class="muted" style="font-size:.66rem">Editada ${relTime(sel.updated)}</span>
            <span class="chip" id="noteSaved">${icon('check')}Guardado</span>
          </div>
        ` : `<div class="empty" style="margin:auto">${icon('notes')}<b>Selecciona una nota</b><p>O crea una nueva para empezar a escribir.</p>
          <button class="btn primary xs" data-act="note-new" style="margin-top:.5rem">${icon('plus')}Nueva nota</button></div>`}
      </div>
    </div>
  </div>`;
};

/* ---------------- ESTADÍSTICAS ---------------- */
VIEWS.estadisticas = function () {
  const t = todayISO();
  const doneTotal = DB.tasks.filter(x => x.done).length;
  const win = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 6)));
  const prevWin = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 13)));

  const rate = arr => { const c = arr.reduce((s, d) => s + tasksOfDay(d).filter(x => x.done).length, 0); return c; };
  const wk = rate(win), pw = rate(prevWin);
  const diff = pw ? Math.round((wk - pw) / pw * 100) : (wk ? 100 : 0);

  // barras 14 días
  const days = Array.from({ length: 14 }, (_, i) => ymd(addDays(new Date(), i - 13)));
  const counts = days.map(d => tasksOfDay(d).filter(x => x.done).length);
  const maxC = Math.max(4, ...counts);
  const bars = counts.map((c, i) => {
    const h = c / maxC * 76;
    const x = i * 21.4 + 2;
    return `<rect class="bar" x="${x}" y="${86 - h}" width="14" height="${Math.max(1.5, h)}" rx="3"><title>${fmtFecha(days[i], { force: true })} · ${c} completadas</title></rect>` +
      (i % 2 === 0 ? `<text class="lb" x="${x + 7}" y="97" text-anchor="middle">${days[i].slice(8)}</text>` : '');
  }).join('');

  // donut por categoría
  const catCount = CATS.map(c => ({ c, n: DB.tasks.filter(x => x.cat === c).length })).filter(x => x.n);
  const total = catCount.reduce((s, x) => s + x.n, 0) || 1;
  const palette = ['var(--accent)', 'var(--accent-2)', 'var(--ok)', 'var(--warn)', 'var(--bad)', 'var(--info)', 'var(--txt-3)'];
  let acc = 0;
  const R = 42, C = 2 * Math.PI * R;
  const donut = catCount.map((x, i) => {
    const len = x.n / total * C, off = -acc;
    acc += len;
    return `<circle cx="50" cy="50" r="${R}" stroke="${palette[i % palette.length]}"
      stroke-dasharray="${len - 2.5} ${C - len + 2.5}" stroke-dashoffset="${off}" stroke-linecap="butt">
      <title>${x.c}: ${x.n}</title></circle>`;
  }).join('');

  // heatmap 12 semanas
  const heat = [];
  for (let i = 83; i >= 0; i--) {
    const d = ymd(addDays(new Date(), -i));
    const n = tasksOfDay(d).filter(x => x.done).length;
    heat.push(`<i data-l="${Math.min(4, n)}" title="${fmtFecha(d, { force: true })} · ${n} completadas"></i>`);
  }

  const byPrio = PRIOS.map(p => ({ ...p, n: DB.tasks.filter(x => x.prio === p.k).length }));
  const colOf = { alta: 'var(--bad)', media: 'var(--warn)', baja: 'var(--ok)' };
  const best = (() => {
    const counts2 = {};
    DB.tasks.filter(x => x.done).forEach(x => { if (x.doneAt) { const h = new Date(x.doneAt).getHours(); counts2[h] = (counts2[h] || 0) + 1; } });
    const arr = Object.entries(counts2).sort((a, b) => b[1] - a[1]);
    return arr.length ? arr[0] : null;
  })();

  return `
  <div class="page">
    <div class="kpis">
      <div class="card kpi"><div class="kpi-top"><div class="stat"><b>${doneTotal}</b><span>Tareas completadas</span></div>
        <div class="ico">${icon('check')}</div></div>
        <div class="row"><span class="delta ${diff >= 0 ? 'up' : 'dn'}">${diff >= 0 ? '+' : ''}${diff}%</span>
        <span class="muted" style="font-size:.66rem">vs. semana previa</span></div></div>
      <div class="card kpi"><div class="kpi-top"><div class="stat"><b>${wk}</b><span>Esta semana</span></div>
        <div class="ico">${icon('calendar')}</div></div>
        <div class="muted" style="font-size:.68rem">${pw} la anterior</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="stat"><b>${DB.tasks.length}</b><span>Tareas totales</span></div>
        <div class="ico">${icon('list')}</div></div>
        <div class="muted" style="font-size:.68rem">${openTasks().length} abiertas</div></div>
      <div class="card kpi"><div class="kpi-top"><div class="stat"><b>${Math.round(DB.projects.reduce((s, p) => s + p.pct, 0) / (DB.projects.length || 1))}%</b><span>Avance medio</span></div>
        <div class="ico">${icon('target')}</div></div>
        <div class="row"><span class="muted" style="font-size:.66rem">${DB.projects.filter(p => p.col === 'done').length} de ${DB.projects.length} proyectos cerrados</span></div></div>
    </div>

    <div class="grid g-3">
      <div class="card span-2">
        <div class="card-h"><h3>${icon('stats')}Completadas · 14 días</h3><span class="hint">máx ${maxC}</span></div>
        <div class="card-b">
          <svg class="chart" viewBox="0 0 300 102" style="height:9.5rem">
            
            <line class="gl" x1="0" y1="10" x2="300" y2="10"/><line class="gl" x1="0" y1="48" x2="300" y2="48"/><line class="gl" x1="0" y1="86" x2="300" y2="86"/>
            ${bars}
          </svg>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>${icon('layers')}Por categoría</h3></div>
        <div class="card-b row" style="gap:1rem;flex-wrap:wrap;justify-content:center">
          <div class="donut" style="width:8.2rem;height:8.2rem;flex:none">
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="${R}" stroke="rgba(255,255,255,.05)" />
              ${donut}
            </svg>
            <div class="donut-mid"><b>${total}</b><span>tareas</span></div>
          </div>
          <div class="legend grow" style="min-width:8rem">
            ${catCount.map((x, i) => `<div><i style="background:${palette[i % palette.length]}"></i>${esc(x.c)}<span class="v">${x.n}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="grid g-3">
      <div class="card">
        <div class="card-h"><h3>${icon('fire')}Constancia</h3><span class="hint">12 semanas</span></div>
        <div class="card-b">
          <div class="heat">${heat.join('')}</div>
          <div class="row" style="margin-top:.6rem;justify-content:space-between;font-size:.62rem;color:var(--txt-4)">
            <span>menos</span><span class="row" style="gap:.2rem">
              <i style="width:.62rem;height:.62rem;border-radius:2px;background:rgba(255,255,255,.05)"></i>
              <i style="width:.62rem;height:.62rem;border-radius:2px;background:color-mix(in srgb,var(--accent) 24%,transparent)"></i>
              <i style="width:.62rem;height:.62rem;border-radius:2px;background:color-mix(in srgb,var(--accent) 48%,transparent)"></i>
              <i style="width:.62rem;height:.62rem;border-radius:2px;background:color-mix(in srgb,var(--accent) 74%,transparent)"></i>
              <i style="width:.62rem;height:.62rem;border-radius:2px;background:var(--accent)"></i></span><span>más</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>${icon('flag')}Por prioridad</h3></div>
        <div class="card-b">
          <div class="hbar">
            ${byPrio.map(p => `<div class="hbar-row"><span class="l">${p.l}</span>
              <span class="prog"><i style="width:${p.n / (DB.tasks.length || 1) * 100}%;background:${colOf[p.k]}"></i></span>
              <span class="v">${p.n}</span></div>`).join('')}
          </div>
          <div class="row" style="margin-top:.8rem;gap:.4rem;flex-wrap:wrap">
            <span class="chip">${best ? `Mejor hora: ${pad2(best[0])}:00` : 'Sin datos de hora'}</span>
            <span class="chip">${(DB.notes.length)} notas</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>${icon('projects')}Proyectos</h3></div>
        <div class="card-b">
          <div class="hbar">
            ${COLS.map(c => `<div class="hbar-row"><span class="l">${c.l}</span>
              <span class="prog"><i style="width:${ntOfCol(c.k) / (DB.projects.length || 1) * 100}%;background:${c.c}"></i></span>
              <span class="v">${ntOfCol(c.k)}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------------- AJUSTES ---------------- */
VIEWS.ajustes = function () {
  const s = DB.settings;
  const row = (title, sub, ctl) => `<div class="set-row"><div class="lb"><b>${title}</b><small>${sub}</small></div><div class="ctl">${ctl}</div></div>`;
  const sw = (key, on) => `<button class="switch ${on ? 'on' : ''}" data-act="set-toggle" data-id="${key}" role="switch" aria-checked="${!!on}"></button>`;
  const ACCENTS = [['blue', '#6ea8ff'], ['violet', '#b78bff'], ['mint', '#5eead4'], ['amber', '#fbbf24'], ['ice', '#7dd3fc']];

  return `
  <div class="page">
    <div class="grid g-2">
      <div class="card">
        <div class="card-h"><h3>${icon('palette')}Apariencia</h3></div>
        <div class="card-b" style="padding:.4rem 1rem">
          ${row('Intensidad del blur', `Desenfoque de fondo · ${s.blur}px`,
            `<input type="range" class="range" min="0" max="40" step="2" value="${s.blur}" style="width:7rem" data-act="set-range" data-id="blur" /><span class="num">${s.blur}px</span>`)}
          ${row('Tamaño de la interfaz', 'Escala todo el texto y los componentes',
            `<input type="range" class="range" min="85" max="120" step="5" value="${s.scale}" style="width:7rem" data-act="set-range" data-id="scale" /><span class="num">${s.scale}%</span>`)}
          ${row('Modo OLED', 'Negro absoluto para pantallas OLED',
            sw('oled', s.oled))}
          ${row('Densidad', 'Espaciado entre tarjetas y filas',
            `<div class="dens-btns">
              ${['compact', 'normal', 'roomy'].map(d => `<button data-act="set-dens" data-id="${d}" class="${s.density === d ? 'on' : ''}">${d === 'compact' ? 'Cómoda' : d === 'normal' ? 'Normal' : 'Amplia'}</button>`).join('')}
            </div>`)}
          ${row('Color de acento', 'Se aplica a toda la interfaz',
            `<div class="swatches">${ACCENTS.map(([k, c]) =>
              `<button class="sw ${s.accent === k ? 'on' : ''}" style="background:${c}" data-act="set-accent" data-id="${k}" title="${k}"></button>`).join('')}</div>`)}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>${icon('zap')}Comportamiento</h3></div>
        <div class="card-b" style="padding:.4rem 1rem">
          ${row('Animaciones', 'Transiciones y efectos de movimiento', sw('animations', s.animations))}
          ${row('Sonido', 'Sonido corto al completar tareas', sw('sound', s.sound))}
          ${row('Barra lateral', 'Mostrar solo los iconos',
            `<button class="btn xs" data-act="set-toggle" data-id="collapsed">${s.collapsed ? 'Expandir' : 'Contraer'}</button>`)}
          ${row('Tu nombre', 'Se usa en el saludo del panel',
            `<input class="input" style="width:8rem;height:1.9rem;font-size:.78rem" value="${esc(s.greetingName)}" data-act="set-name" />`)}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><h3>${icon('download')}Datos</h3></div>
        <div class="card-b" style="padding:.4rem 1rem">
          ${row('Exportar', 'Descarga una copia en JSON',
            `<button class="btn xs" data-act="data-export">${icon('download')}Exportar</button>`)}
          ${row('Restaurar', `Vuelve al estado de fábrica (${DB.tasks.length} tareas)`,
            `<button class="btn danger xs" data-act="data-reset">${icon('refresh')}Restablecer</button>`)}
          ${row('Almacenamiento', 'Todo se guarda en este navegador',
            `<span class="chip">${(() => { try { return Math.round(localStorage.getItem(KEY).length / 1024) + ' KB'; } catch (e) { return '—'; } })()}</span>`)}
        </div>
      </div>

      <div class="card">
              <div class="card-h"><h3>${icon('cloud')}Nube</h3><span class="hint">${CLOUD.session ? 'Conectado' : 'Sin conectar'}</span></div>
              <div class="card-b" style="padding:.4rem 1rem">
                ${row('Sincronización', CLOUD.session
                  ? 'Tus datos se guardan en la nube y en este dispositivo'
                  : 'Conéctate para tener los datos en todos tus dispositivos',
                  `<button class="btn xs ${CLOUD.session ? '' : 'primary'}" data-act="cloud-manage">${icon('cloud')}${CLOUD.session ? 'Gestionar' : 'Conectar'}</button>`)}
                ${CLOUD.lastSync ? row('Última subida', relTime(CLOUD.lastSync),
                  `<button class="btn xs" data-act="cloud-sync">${icon('refresh')}Ahora</button>`) : ''}
                ${CLOUD.state === 'error' ? `<div class="set-row"><div class="lb"><b style="color:#ffb3bf">Sin conexión</b><small>${esc(CLOUD.lastError)}</small></div></div>` : ''}
                <p class="muted" style="font-size:.69rem;line-height:1.55;padding:.5rem 0">
                  Si algo falla, la app <b>nunca se rompe</b>: sigue guardando todo en el navegador.
                </p>
              </div>
            </div>

            <div class="card">
              <div class="card-h"><h3>${icon('list')}Resumen</h3></div>
        <div class="card-b">
          <div class="grid g-2" style="gap:.5rem">
            ${[['Tareas', DB.tasks.length], ['Eventos', DB.events.length], ['Proyectos', DB.projects.length], ['Notas', DB.notes.length]]
              .map(([l, n]) => `<div class="stat" style="padding:.5rem .6rem;background:var(--panel);border:1px solid var(--stroke);border-radius:var(--r-xs)">
                <b style="font-size:1.15rem">${n}</b><span>${l}</span></div>`).join('')}
          </div>
          <p class="muted" style="font-size:.68rem;margin-top:.75rem;line-height:1.55">
            <b style="color:var(--txt-2)">Atajos:</b> Ctrl/⌘ + K abre la paleta · Ctrl/⌘ + N nueva tarea ·
            1–7 cambian de sección · Esc cierra lo que esté abierto.
          </p>
        </div>
      </div>
    </div>
  </div>`;
};