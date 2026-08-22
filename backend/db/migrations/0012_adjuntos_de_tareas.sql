-- ============================================================================
-- 0012 · Adjuntos de tareas
-- ============================================================================

set local search_path = public, pg_catalog;

alter table aula_tareas
  add column archivo_nombre text,
  add column archivo_mime text,
  add column archivo_tamano integer,
  add column archivo bytea,
  add constraint aula_tareas_archivo_completo check (
    (archivo is null and archivo_nombre is null and archivo_mime is null and archivo_tamano is null)
    or
    (archivo is not null and archivo_nombre is not null and archivo_mime is not null and archivo_tamano is not null)
  ),
  add constraint aula_tareas_archivo_acotado check (
    archivo_tamano is null or archivo_tamano between 1 and 20971520
  ),
  add constraint aula_tareas_tamano_real check (
    archivo is null or octet_length(archivo) = archivo_tamano
  );

comment on column aula_tareas.archivo is
  'Adjunto opcional publicado por el instructor con las instrucciones de la tarea.';
