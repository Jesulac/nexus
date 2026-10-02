/* ================================================================
   NEXUS · nube · interfaz
   Login por email, indicador de estado en la topbar y ajustes.
   ================================================================ */

const CLOUD_ICON = {
  idle: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8v8.4"/>',
  connected: '<circle cx="12" cy="12" r="8.2"/><path d="m8.4 12.2 2.6 2.6 4.6-5"/>',
  synced: '<circle cx="12" cy="12" r="8.2"/><path d="m8.4 12.2 2.6 2.6 4.6-5"/>',
  connecting: '<circle cx="12" cy="12" r="8.2"/><path d="M12 12h4.6"/>',
  error: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6v5M12 15.8v.2"/>',
  off: '<circle cx="12" cy="12" r="8.2"/><path d="m9 9 6 6M15 9l-6 6"/>'
};

/* indicador en la topbar: un boton que refleja el estado */
function paintCloud() {
  const btn = $('#cloudBtn');
  if (!btn) return;
  const s = CLOUD.session ? (CLOUD.state === 'error' ? 'error' : CLOUD.state === 'connecting' ? 'connecting' : 'synced') : 'idle';
  const color = {
    idle: 'var(--txt-3)', connected: 'var(--ok)', synced: 'var(--ok)',
    connecting: 'var(--warn)', error: 'var(--bad)', off: 'var(--txt-4)'
  }[s];
  btn.style.color = color;
  btn.title = CLOUD.session
    ? (s === 'error' ? 'Nube: ' + (CLOUD.lastError || 'error') : 'Sincronizado' + (CLOUD.lastSync ? ' · ' + relTime(CLOUD.lastSync) : ''))
    : 'Conectar con la nube';
  btn.setAttribute('aria-label', CLOUD.session ? 'Estado de la nube' : 'Conectar con la nube');
}

/* ---------- modal de la nube ---------- */
function cloudModal(mode) {
  const haySesion = !!CLOUD.session;
  const email = haySesion ? (CLOUD.session.user?.email || '') : '';

  if (haySesion && mode === 'estado') {
    openModal({
      title: 'Nube',
      sub: 'Tus datos sincronizados',
      body: `
        <div class="row" style="gap:.6rem;padding:.6rem;background:var(--panel);border:1px solid var(--stroke);border-radius:var(--r-sm)">
          <span class="feed-ico" style="color:var(--ok)">${icon('check')}</span>
          <div style="flex:1;min-width:0">
            <b style="font-size:.82rem;display:block">Conectado</b>
            <small style="font-size:.7rem;color:var(--txt-3);display:block;overflow:hidden;text-overflow:ellipsis">${esc(email)}</small>
          </div>
        </div>
        ${CLOUD.lastSync ? `<p class="muted" style="font-size:.72rem">Última sincronización: <b>${relTime(CLOUD.lastSync)}</b></p>` : ''}
        ${CLOUD.state === 'error' ? `<p style="font-size:.75rem;color:#ffb3bf;line-height:1.5">${esc(CLOUD.lastError)}</p>` : ''}
        <div class="frow">
          <button class="btn" data-act="cloud-sync" data-id="force">${icon('refresh')}Sincronizar ahora</button>
          <button class="btn" data-act="cloud-export">${icon('download')}Exportar copia</button>
        </div>
        <button class="btn danger block" data-act="cloud-signout">${icon('lock')}Desconectar este dispositivo</button>
        <p class="muted" style="font-size:.68rem;line-height:1.5">
          Al desconectar, los datos <b>siguen en la nube</b> y también se quedan en este
          dispositivo. Solo se borra la sesión.
        </p>`,
      footer: `<span class="sp"></span><button class="btn ghost" data-act="modal-close">Cerrar</button>`
    });
    return;
  }

  openModal({
    title: haySesion ? 'Cambiar de cuenta' : 'Conectar con la nube',
    sub: 'Sin cuenta, todo sigue funcionando en este dispositivo',
    body: `
      <div class="field"><label>Email</label>
        <input class="input" id="clEmail" type="email" value="${esc(email)}"
          placeholder="tucorreo@ejemplo.com" autocomplete="email" inputmode="email" /></div>
      <div class="field"><label>Contraseña</label>
        <input class="input" id="clPass" type="password" placeholder="Mínimo 6 caracteres"
          autocomplete="current-password" /></div>
      <div class="frow">
        <button class="btn ${haySesion ? '' : 'primary'}" data-act="cloud-signin" style="flex:1">
          ${icon('lock')}${haySesion ? 'Entrar' : 'Entrar'}</button>
        <button class="btn" data-act="cloud-signup" style="flex:1">${icon('users')}Crear cuenta</button>
      </div>
      <p class="muted" style="font-size:.69rem;line-height:1.55">
        Tus tareas, eventos, proyectos y notas se cifran en tránsito y solo tú puedes leerlas.
        La app sigue funcionando sin conexión: si algo falla, se guarda en local.
      </p>`,
    footer: `
      ${haySesion ? '<button class="btn danger" data-act="cloud-signout">Desconectar</button>' : ''}
      <span class="sp"></span>
      <button class="btn ghost" data-act="modal-close">Ahora no</button>`
  });
}

/* ---------- acciones ---------- */
const CLOUD_ACT = {
  'cloud-open': () => cloudModal('estado'),
  'cloud-manage': () => cloudModal(CLOUD.session ? 'estado' : 'login'),
  'cloud-signin': async () => {
    const email = $('#clEmail').value.trim();
    const pass = $('#clPass').value;
    if (!email || !pass) { toast('Falta el email o la contraseña', '', 'warn'); return; }
    try {
      await CLOUD.signIn(email, pass);
      closeModal();
      const r = await CLOUD.sync();
      toast('Conectado a la nube',
        r === 'downloaded' ? 'Datos descargados' : r === 'uploaded' ? 'Datos subidos' : 'Sincronizado', 'ok');
    } catch (e) {
      toast('No se pudo entrar', e.message, 'bad', 4200);
    }
  },
  'cloud-signup': async () => {
    const email = $('#clEmail').value.trim();
    const pass = $('#clPass').value;
    if (!email || pass.length < 6) {
      toast('Email y contraseña de 6 caracteres o más', '', 'warn', 3600);
      return;
    }
    try {
      const r = await CLOUD.signUpAndEnter(email, pass);
      if (r.needsConfirm) {
        closeModal();
        toast('Cuenta creada', 'Confirma el email con el enlace recibido y luego entra', 'info', 6000);
        return;
      }
      closeModal();
      await CLOUD.sync();
      toast('Cuenta creada y conectada', '', 'ok');
    } catch (e) {
      const yaExiste = /already registered|already been registered/i.test(e.message || '');
      toast(yaExiste ? 'Ese email ya tiene cuenta' : 'No se pudo crear la cuenta',
        yaExiste ? 'Entra con tu contraseña' : e.message, yaExiste ? 'warn' : 'bad', 4200);
    }
  },
  'cloud-signout': () => {
    confirmModal({
      title: '¿Desconectar la nube?',
      body: 'Los datos <b>siguen guardados</b> en la nube y también en este dispositivo. Solo se cierra la sesión en este navegador.',
      onYes: async () => { await CLOUD.signOut(); toast('Nube desconectada', 'Todo sigue en local', 'info'); }
    });
  },
  'cloud-sync': async (el) => {
    const r = await CLOUD.sync({ force: el.dataset.id === 'force' });
    const msg = {
      uploaded: 'Datos subidos', downloaded: 'Datos descargados', error: 'Error: ' + CLOUD.lastError, idle: 'Sin sesión'
    }[r] || 'Sincronizado';
    toast(msg, '', r === 'error' ? 'bad' : 'ok');
    if (el.dataset.id === 'force') closeModal();
  }
};
Object.assign(ACT, CLOUD_ACT);