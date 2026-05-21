-- ═══════════════════════════════════════════════════════════
-- GRABACIÓN OBRAS v1.4 — Migración para Rutas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- ─── TABLA: routes ───────────────────────────────────────────
-- Una ruta = una sesión de grabación. ended_at IS NULL = activa.
create table if not exists public.routes (
  id          uuid primary key,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists routes_started_at_idx on public.routes (started_at desc);
create index if not exists routes_active_idx     on public.routes (ended_at) where ended_at is null;

-- ─── TABLA: route_stops ─────────────────────────────────────
-- Cada parada de una ruta. Vinculada a una location y opcionalmente a un check-in.
create table if not exists public.route_stops (
  id          uuid primary key,
  route_id    uuid not null references public.routes(id) on delete cascade,
  position    int  not null,
  loc_id      text not null,
  loc_name    text,  -- nombre cacheado para historial (en caso de que la loc se elimine)
  state       text not null check (state in ('pending','current','done','skipped')),
  arrived_at  timestamptz,
  done_at     timestamptz,
  checkin_id  text
);

create index if not exists route_stops_route_idx    on public.route_stops (route_id);
create index if not exists route_stops_position_idx on public.route_stops (route_id, position);

-- ─── RLS (Row Level Security) ───────────────────────────────
-- Solo usuarios autenticados (admin que hizo login) pueden leer/escribir.
-- Lectores anónimos no ven nada.

alter table public.routes      enable row level security;
alter table public.route_stops enable row level security;

-- ROUTES — solo admin autenticado
drop policy if exists "routes_select_authenticated" on public.routes;
create policy "routes_select_authenticated" on public.routes
  for select using (auth.role() = 'authenticated');

drop policy if exists "routes_insert_authenticated" on public.routes;
create policy "routes_insert_authenticated" on public.routes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "routes_update_authenticated" on public.routes;
create policy "routes_update_authenticated" on public.routes
  for update using (auth.role() = 'authenticated');

drop policy if exists "routes_delete_authenticated" on public.routes;
create policy "routes_delete_authenticated" on public.routes
  for delete using (auth.role() = 'authenticated');

-- ROUTE_STOPS — solo admin autenticado
drop policy if exists "route_stops_select_authenticated" on public.route_stops;
create policy "route_stops_select_authenticated" on public.route_stops
  for select using (auth.role() = 'authenticated');

drop policy if exists "route_stops_insert_authenticated" on public.route_stops;
create policy "route_stops_insert_authenticated" on public.route_stops
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "route_stops_update_authenticated" on public.route_stops;
create policy "route_stops_update_authenticated" on public.route_stops
  for update using (auth.role() = 'authenticated');

drop policy if exists "route_stops_delete_authenticated" on public.route_stops;
create policy "route_stops_delete_authenticated" on public.route_stops
  for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════
-- LISTO. Verifica con:
-- select * from public.routes;       (debe estar vacía)
-- select * from public.route_stops;  (debe estar vacía)
-- ═══════════════════════════════════════════════════════════
