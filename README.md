# NEXUS · Centro de Control

Aplicación de productividad personal para escritorio y móvil. Un solo archivo
HTML, sin build ni dependencias: se abre haciendo doble clic y funciona.

🔗 **Demo:** https://nexus-control-teal.vercel.app

## Qué incluye

| Sección | Qué hace |
|---|---|
| **Panel** | Resumen del día, anillo de progreso, KPIs, tareas de hoy, ritmo semanal, próximos eventos, proyectos activos y actividad reciente. Las tarjetas se pueden **reordenar arrastrando**. |
| **Hoy** | Tu día en un vistazo: pendientes, completadas, línea de tiempo de eventos y distribución por prioridad. |
| **Calendario** | Mes navegable, selección de día, agenda lateral con eventos y tareas del día. Crear, editar y eliminar eventos. |
| **Tareas** | Gestor completo: título, descripción, prioridad, categoría, fecha, hora, estado, % de avance y etiquetas. Búsqueda, filtros, ordenación, favoritas y anim��ción al completar. |
| **Proyectos** | Tablero Kanban con cuatro columnas. Movimiento de tarjetas con **arrastrar** (pulsación larga en táctil) o con los **botones ↑↓**. |
| **Notas** | Editor con carpetas, búsqueda, notas fijadas y autoguardado. |
| **Estadísticas** | Completadas a 14 días, reparto por categoría, constancia de 12 semanas, prioridad y estado de proyectos. |
| **Ajustes** | Intensidad del blur, tamaño de interfaz, densidad, animaciones, sonido, modo OLED y color de acento. Todo se aplica al instante. |

### Atajos

- `Ctrl/⌘ + K` — paleta de comandos (busca en todo y ejecuta acciones)
- `Ctrl/⌘ + N` — nueva tarea
- `Ctrl/⌘ + B` — plegar la barra lateral
- `1`–`7` — cambiar de sección
- `Esc` — cerrar lo que esté abierto

## Responsive

Funciona en móvil, tableta y escritorio:

- Barra inferior de navegación con 4 destinos + "Más" en táctil
- Sidebar como cajón deslizante por debajo de 1180px
- Objetivos táctiles de 40px o más
- Campos a 16px para que iOS no haga zoom al escribir
- Zona segura del notch (`env(safe-area-inset-*)`)
- Sin rebote ni pull-to-refresh, que rompían el arrastre de tarjetas

## Diseñado sin degradados

No usa `linear-gradient`, `radial-gradient` ni `conic-gradient`. La profundidad
la dan las sombras y los bordes, no las mezclas de color.

## Datos

Todo se guarda en `localStorage` bajo la clave `nexus.v1` y se restaura al
volver a abrir.

### Nube (Supabase)

Puedes conectar la app a una nube para tener los datos en todos tus
dispositivos. El botón de nube está en la topbar (icono de nube) y también
en **Ajustes → Nube**.

- Login con **email y contraseña** (Supabase Auth). Nadie más puede leer ni
  escribir tus datos.
- La sincronización es de **estado completo**: tareas, eventos, proyectos,
  notas, notificaciones, actividad y ajustes.
- **Resolución de conflictos por fecha**: gana la versión más reciente, así que
  si editas en el móvil y en el portátil, no se pierde nada en silencio.
- **Si la nube falla, la app no se rompe.** Todo sigue guardándose en el
  navegador y se reintenta al volver a conectar.

Sin conectar la nube, la app funciona igual: es completamente opcional.

## Despliegue

| Dónde | URL |
|---|---|
| GitHub Pages | https://jesulac.github.io/nexus/ |
| Vercel | https://nexus-control-teal.vercel.app |

Como es estático puro, ambos sirven el mismo `index.html` sin configuración
de build.

## Estructura

```
index.html      ← el archivo final (se genera)
404.html        ← GitHub Pages: rutas internas
build.sh        ← ensambla index.html desde _src/
_src/           ← fragmentos fuente
```

El orden de ensamblado importa: `09-cloud.js` va **antes** de `08-ui.js`
porque este último contiene `boot()`, que ya usa el módulo de nube.

## Desarrollo

El `index.html` se genera a partir de los fragmentos en `_src/`:

```bash
bash build.sh
```

Orden de ensamblado: `01-head` → estilos (`02`, `04`, `05`, `06`, `07`) →
`03-body` → scripts (`06-core`, `07-views`, `08-ui`).

- `_src/06-responsive.css` — layout adaptable y objetivos táctiles
- `_src/07-tabbar.css` — barra inferior de navegación
- `_src/08-ui.js` — router, modales, paleta, drag & drop y arranque

## Despliegue

**GitHub Pages** (este repositorio) y **Vercel**. Como es estático puro, ambos
sirven el mismo `index.html` sin configuración de build.