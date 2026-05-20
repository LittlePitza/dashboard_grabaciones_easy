-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN v1.2 — Producción de Videos
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas nuevas a locations
alter table locations
  add column if not exists playlist_url text;

-- 2. Agregar columnas nuevas a checkins
alter table checkins
  add column if not exists foto_url   text,
  add column if not exists updated_at timestamptz default now();

-- 3. Ampliar el CHECK de estado para incluir 'editado'
--    (Supabase no permite ALTER CONSTRAINT directamente, hay que recrearlo)
alter table checkins drop constraint if exists checkins_estado_check;
alter table checkins
  add constraint checkins_estado_check
  check (estado in ('grabado','en_edicion','editado','publicado'));

-- ═══════════════════════════════════════════════════════════════
-- STORAGE BUCKET para fotos (hacer esto en Supabase Dashboard)
-- ═══════════════════════════════════════════════════════════════
-- Ve a: Storage → New bucket
--   Name:   checkin-fotos
--   Public: ✅ (activar "Public bucket")
--   File size limit: 5 MB
--   Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
--
-- Después agrega esta política RLS para permitir uploads:

-- Permitir lectura pública
create policy "public_read_fotos"
  on storage.objects for select
  using ( bucket_id = 'checkin-fotos' );

-- Permitir insertar/actualizar (anon key)
create policy "anon_upload_fotos"
  on storage.objects for insert
  with check ( bucket_id = 'checkin-fotos' );

create policy "anon_update_fotos"
  on storage.objects for update
  using ( bucket_id = 'checkin-fotos' );
