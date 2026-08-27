-- ============================================================================
-- 0016 · Reversion del foro de curso
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists foro_mensajes;
drop table if exists foro_temas;
