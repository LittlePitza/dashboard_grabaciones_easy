-- ═══════════════════════════════════════════════════════════
-- GRABACIÓN OBRAS — Fix: prevenir rutas duplicadas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- Primero: limpiar duplicados activos que ya existan
-- (deja solo la más reciente si hubiera más de una sin ended_at)
delete from public.routes
where ended_at is null
  and id not in (
    select id from public.routes
    where ended_at is null
    order by started_at desc
    limit 1
  );

-- Luego: crear el índice único que impide que vuelva a pasar
-- Solo puede existir UN registro con ended_at IS NULL a la vez
create unique index if not exists routes_one_active
  on public.routes ((ended_at is null))
  where ended_at is null;

-- ═══════════════════════════════════════════════════════════
-- Verifica con:
-- select id, started_at, ended_at from public.routes order by started_at desc;
-- ═══════════════════════════════════════════════════════════
