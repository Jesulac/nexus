/* ================================================================
   NEXUS · nube (Supabase)
   Sincroniza el estado completo contra una fila en la nube y mantiene
   una copia local. La app NUNCA se rompe si la nube falla: todo el
   modulo es opcional y cualquier error cae en modo local.

   - la clave es "publicable": puede ir en el navegador, no da acceso
     a nada salvo a la fila de este documento
   - el login es por email y contraseña (Supabase Auth)
   ================================================================ */
const CLOUD = {
  url: 'https://otcrzcvuwtrlmjyuvdfd.supabase.co',
  key: 'sb_publishable_O0VxJLIhj6z4uIwIPHbsDQ_C1URCfj6',
  table: 'nexus_state',
  rowId: 'main',

  session: null,      // sesion de Supabase (access_token + user)
  state: 'idle',      // idle | off | connecting | synced | error
  lastError: '',
  lastSync: null,
  suppress: false,    // mientras se aplica una descarga, no subir

  /* ---------- ayuda de red ---------- */
  headers(withAuth = true) {
    const h = { apikey: this.key, 'Content-Type': 'application/json' };
    if (withAuth && this.session?.access_token) {
      h.Authorization = 'Bearer ' + this.session.access_token;
    }
    return h;
  },

  /* OJO: las rutas de auth cuelgan de la raiz del proyecto
     (/auth/v1/...), NO de /rest/v1/. Por eso se separa la base. */
  async call(method, { table, query, body } = {}) {
    const esAuth = /^(auth|admin)\//.test(table);
    const base = esAuth ? this.url : this.url + '/rest/v1';
    const url = `${base}/${table}${query || ''}`;
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && (data.message || data.error_description || data.msg)) || res.statusText;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  /* ---------- autenticacion ---------- */
  async signIn(email, password) {
    const data = await this.call('POST', {
      table: 'auth/v1/token',
      query: '?grant_type=password',
      body: { email, password }
    });
    this.setSession(data);
    return data.user;
  },

  async signUp(email, password) {
    const data = await this.call('POST', {
      table: 'auth/v1/signup',
      body: { email, password }
    });
    // si el proyecto exige confirmar el correo, no hay session todavia
    if (data?.access_token) this.setSession(data);
    return { user: data.user || null, needsConfirm: !data?.access_token };
  },

  /* Si el alta devuelve needsConfirm, intenta entrar: sirve cuando el
     proyecto ya tiene desactivada la confirmacion, y en ese caso lo
     detecta y lo resuelve solo sin molestar al usuario. */
  async signUpAndEnter(email, password) {
    const r = await this.signUp(email, password);
    if (r.needsConfirm) {
      try {
        await this.signIn(email, password);
        return { user: r.user, needsConfirm: false, autoEntered: true };
      } catch (e) {
        return { user: r.user, needsConfirm: true, autoEntered: false };
      }
    }
    return { ...r, autoEntered: true };
  },

  async signOut() {
    try {
      if (this.session?.refresh_token) {
        await this.call('POST', {
          table: 'auth/v1/logout',
          body: { refresh_token: this.session.refresh_token }
        });
      }
    } catch (e) { /* cerrar sesion local siempre */ }
    this.session = null;
    saveAuth();
    this.state = 'idle';
    paintCloud();
  },

  setSession(data) {
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || (Date.now() / 1000 + (data.expires_in || 3600)),
      user: data.user
    };
    saveAuth();
    this.state = 'connected';
    paintCloud();
  },

  /* ---------- sincronizacion ---------- */
  /* Descarga la nube. Devuelve true si trae algo. */
  async pull() {
    const rows = await this.call('GET', {
      query: `?id=eq.${encodeURIComponent(this.rowId)}&select=payload,updated_at&limit=1`
    });
    if (!rows || !rows.length) return null;
    const row = rows[0];
    const payload = row.payload || {};
    return { data: payload, updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0 };
  },

  async push(db) {
    const payload = {
      tasks: db.tasks, events: db.events, projects: db.projects,
      notes: db.notes, notifications: db.notifications,
      activity: db.activity, settings: db.settings
    };
    await this.call('POST', {
      query: '?on_conflict=id',
      body: [{ id: this.rowId, payload }]
    });
    this.lastSync = Date.now();
    this.state = 'synced';
    paintCloud();
    return true;
  },

  /* decidedor: whichever version is newer wins (last-write-wins por timestamp) */
  async sync({ force = false } = {}) {
    if (!this.session) { this.state = 'idle'; paintCloud(); return 'idle'; }
    this.state = 'connecting'; paintCloud();
    try {
      const remote = await this.pull();
      const localStamp = Number(localStorage.getItem('nexus.localStamp') || 0);

      if (!remote || (!remote.data || !remote.data.tasks)) {
        // nube vacia: es la primera vez, subir lo local
        await this.push(DB);
        localStorage.setItem('nexus.localStamp', String(Date.now()));
        return 'uploaded';
      }
      if (!force && remote.updatedAt && remote.updatedAt > localStamp) {
        // la nube es mas nueva: bajar
        this.suppress = true;
        applyRemote(remote.data);
        this.suppress = false;
        localStorage.setItem('nexus.localStamp', String(remote.updatedAt));
        saveNow();
        render(true);
        return 'downloaded';
      }
      // lo local es mas nuevo o empatan: subir
      await this.push(DB);
      localStorage.setItem('nexus.localStamp', String(Date.now()));
      return 'uploaded';
    } catch (e) {
      this.state = 'error';
      this.lastError = e.message || String(e);
      paintCloud();
      return 'error';
    }
  },

  /* sube tras cada cambio local, sin molestar */
  async autosync() {
    if (!this.session || this.suppress) return;
    clearTimeout(this._t);
    this._t = setTimeout(async () => {
      try {
        localStorage.setItem('nexus.localStamp', String(Date.now()));
        await this.push(DB);
      } catch (e) {
        this.state = 'error';
        this.lastError = e.message;
        paintCloud();
      }
    }, 1400);
  },

  /* ---------- persistencia de la sesion ---------- */
  restore() {
    try {
      const raw = localStorage.getItem('nexus.auth');
      if (!raw) return null;
      const s = JSON.parse(raw);
      // token caducado: se descarta y hay que volver a entrar
      if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;
      this.session = s;
      this.state = 'connected';
      return s;
    } catch (e) { return null; }
  }
};

function saveAuth() {
  try {
    if (CLOUD.session) localStorage.setItem('nexus.auth', JSON.stringify(CLOUD.session));
    else localStorage.removeItem('nexus.auth');
  } catch (e) { }
}

/* NO se asigna App.cloud aqui: 06-core.js ya lo expone como getter que
   devuelve este mismo objeto, y una asignacion normal lo sobrescribiria.
   Ademas 08-ui.js (que contiene boot()) se ensambla despues de este
   fichero, asi que CLOUD ya existe cuando arranca la app. */
window.NEXUS_CLOUD = CLOUD;

/* aplica el estado descargado de la nube sobre DB */
function applyRemote(payload) {
  ['tasks', 'events', 'projects', 'notes', 'notifications', 'activity'].forEach(k => {
    if (Array.isArray(payload[k])) DB[k] = payload[k];
  });
  if (payload.settings && typeof payload.settings === 'object') {
    DB.settings = { ...DB.settings, ...payload.settings };
  }
}