# Grabación Obras

Pagina: https://dashboard-obras-omega.vercel.app/

Sistema de seguimiento de grabaciones y locaciones para equipos de producción de video. Permite monitorear el estado de cada obra, planificar rutas de visita, gestionar el flujo de edición y publicación de videos.

## Stack

- **Next.js 16** con App Router
- **React 19** con TypeScript estricto
- **Supabase** — base de datos PostgreSQL + autenticación + storage de fotos
- **Zustand** — estado global
- **Leaflet + OpenStreetMap** — mapa de locaciones sin costo
- **Tailwind CSS v4**
- **PWA** — instalable en iPhone/Android, funciona offline

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx          # Root layout, metadata, PWA manifest
│   ├── page.tsx            # Punto de entrada
│   └── globals.css         # Design tokens y estilos globales
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx    # Inicialización, service worker, routing SPA
│   │   ├── Sidebar.tsx     # Navegación con badges dinámicos
│   │   └── Topbar.tsx      # Tema, sync status, acceso admin
│   ├── views/              # 8 vistas principales
│   │   ├── DashboardView   # Resumen ejecutivo con KPIs y alertas
│   │   ├── LocationsView   # CRUD de locaciones con filtros
│   │   ├── VencerView      # Locaciones urgentes o vencidas
│   │   ├── RegistroView    # Historial de check-ins con exportación CSV
│   │   ├── RutaView        # Planificación de visitas del día
│   │   ├── CorrienteView   # Locaciones al día con barra de ciclo
│   │   ├── VideosView      # Producción: estados de edición por obra
│   │   └── MapaView        # Mapa interactivo con pines por estado
│   ├── modals/
│   │   └── AdminLoginModal # Login seguro con Supabase Auth
│   ├── map/
│   │   └── MapCanvas.tsx   # Leaflet con carga dinámica (sin SSR)
│   └── ui/
│       └── ToastContainer  # Notificaciones flotantes
├── hooks/
│   ├── useData.ts          # CRUD completo + upload de fotos a Supabase Storage
│   └── useAuth.ts          # Login, logout, checkSession, sistema de permisos
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Cliente browser (@supabase/ssr)
│   │   └── server.ts       # Cliente server con cookies HTTP-only
│   ├── store/
│   │   └── index.ts        # Zustand store — estado completo de la app
│   └── utils/
│       └── index.ts        # Utilidades puras: fechas, URLs, CSV, estados
├── types/
│   └── index.ts            # Tipos TypeScript para todo el dominio
└── proxy.ts                # Refresco automático de tokens Supabase
```

## Vistas

| Vista | Descripción |
|---|---|
| Dashboard | Saludo por hora, KPIs en tiempo real, acciones urgentes, actividad reciente del equipo, próximas visitas |
| Locaciones | Lista completa con filtros por estado, búsqueda, tarjetas con barra de progreso del ciclo |
| Por vencer | Locaciones vencidas o próximas a vencer ordenadas por urgencia |
| Registro | Tabla de todos los check-ins con filtros por estado y exportación CSV |
| Mi Ruta | Selección y planificación de visitas del día, ordenadas por urgencia |
| Al corriente | Locaciones grabadas y dentro de su frecuencia, con KPIs de margen |
| Videos | Biblioteca de producción por obra: estados grabado → edición → editado → publicado |
| Mapa | Pines coloreados por estado sobre OpenStreetMap, filtros, popup con acciones |

## Roles

La app tiene dos roles definidos en `useAuth.ts`:

- **Lector** — puede ver todo, sin modificar nada. Acceso por defecto al abrir la app.
- **Admin** — acceso completo: crear/editar locaciones, registrar check-ins, cambiar estados, eliminar registros, planificar rutas.

El login de admin usa Supabase Auth con email y contraseña. La sesión se maneja con cookies HTTP-only a través del proxy de Next.js.

## Tablas en Supabase

```sql
locations (
  id          uuid primary key,
  name        text not null,
  address     text,
  responsable text,
  freq_days   integer default 15,
  last_checkin date,
  lat         float,
  lng         float,
  notion_url  text,
  playlist_url text,
  created_at  timestamptz default now()
)

checkins (
  id          uuid primary key,
  location_id uuid references locations(id),
  date        date not null,
  estado      text check (estado in ('grabado','en_edicion','editado','publicado')),
  foto_url    text,
  link        text,
  notes       text,
  created_at  timestamptz default now()
)
```

El storage bucket para fotos se llama `checkin-fotos`.

## Variables de entorno

Crea un archivo `.env.local` en la raíz (nunca lo subas a Git):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

En Vercel, agrégalas en Settings → Environment Variables.

## Instalación y desarrollo local

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3000`.

## Deploy en Vercel

1. Sube el repositorio a GitHub
2. Importa el proyecto en [vercel.com](https://vercel.com)
3. Agrega las variables de entorno en Settings → Environment Variables
4. Vercel detecta Next.js automáticamente — sin configuración adicional

El archivo `next.config.ts` ya incluye los headers de caché correctos para el service worker y el manifest.

## PWA

La app es instalable como PWA en iPhone y Android. El service worker (`public/sw.js`) usa estrategia network-first para los archivos principales y se auto-actualiza en cada deploy. Al detectar una versión nueva, muestra un toast y recarga automáticamente sin intervención del usuario.

Para que funcione en iOS: Safari → botón compartir → "Agregar a pantalla de inicio".
