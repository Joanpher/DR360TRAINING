-- ============================================================================
-- 0013 · Reversion de evaluaciones en linea
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists evaluacion_respuestas;
drop table if exists evaluacion_intentos;
drop table if exists evaluacion_preguntas;
drop table if exists evaluaciones;
