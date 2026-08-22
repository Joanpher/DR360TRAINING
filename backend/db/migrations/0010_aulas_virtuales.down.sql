-- ============================================================================
-- 0010 · Reversion de aulas virtuales
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists aula_tareas;
drop table if exists aula_materiales;
drop table if exists aula_semanas;
drop table if exists aulas_curso;
drop function if exists app.puede_ver_curso_aula(uuid);
drop function if exists app.puede_gestionar_curso_aula(uuid);
