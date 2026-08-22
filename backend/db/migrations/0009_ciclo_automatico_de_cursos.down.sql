-- ============================================================================
-- 0009 · Reversion de ciclo automatico de cursos
-- ============================================================================

set local search_path = public, pg_catalog;

drop function if exists app.estado_curso_por_fechas(date, date);

alter table cursos alter column estado drop default;
alter type estado_curso rename value 'promocion' to 'borrador';
alter type estado_curso rename value 'activo' to 'publicado';
alter type estado_curso rename value 'graduado' to 'cerrado';
alter table cursos alter column estado set default 'borrador';

comment on column cursos.duracion_horas is 'Horas academicas totales.';
comment on column cursos.termina_en is null;
comment on column cursos.estado is 'En borrador no existe para nadie fuera de administracion.';
