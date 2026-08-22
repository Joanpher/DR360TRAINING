-- ============================================================================
-- 0011 · Reversión de entregas y calificaciones
-- ============================================================================

set local search_path = public, pg_catalog;

drop function if exists app.calificar_entrega(uuid, numeric, text);
drop table if exists aula_entregas;
alter table aula_tareas drop constraint if exists aula_tareas_tenant_uk;
