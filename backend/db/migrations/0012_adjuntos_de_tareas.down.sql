-- ============================================================================
-- 0012 · Reversion de adjuntos de tareas
-- ============================================================================

set local search_path = public, pg_catalog;

alter table aula_tareas
  drop constraint if exists aula_tareas_tamano_real,
  drop constraint if exists aula_tareas_archivo_acotado,
  drop constraint if exists aula_tareas_archivo_completo,
  drop column if exists archivo,
  drop column if exists archivo_tamano,
  drop column if exists archivo_mime,
  drop column if exists archivo_nombre;
