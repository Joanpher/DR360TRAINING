-- ============================================================================
-- 0009 · Ciclo automatico de cursos
-- ============================================================================

set local search_path = public, pg_catalog;

-- El estado ya no es una decision manual. Describe en que punto del calendario
-- esta el curso: antes de iniciar, impartiendo docencia o terminado.
alter type estado_curso rename value 'borrador' to 'promocion';
alter type estado_curso rename value 'publicado' to 'activo';
alter type estado_curso rename value 'cerrado' to 'graduado';

alter table cursos alter column estado set default 'promocion';

create or replace function app.estado_curso_por_fechas(inicia date, termina date)
returns estado_curso
language sql
stable
as $$
  select case
    when termina is not null and current_date > termina then 'graduado'::estado_curso
    when inicia is not null and current_date >= inicia then 'activo'::estado_curso
    else 'promocion'::estado_curso
  end
$$;

-- La fecha final incluye el ultimo dia de la cantidad de semanas indicada.
update cursos
   set termina_en = case
         when inicia_en is not null and duracion_semanas is not null
           then inicia_en + (duracion_semanas * 7 - 1)
         else null
       end;

-- Las horas salen de la carga semanal del horario por la cantidad de semanas.
update cursos c
   set duracion_horas = case
         when c.duracion_semanas is null then null
         else (
           select nullif(
             sum(extract(epoch from (h.hora_fin - h.hora_inicio))) / 3600
               * c.duracion_semanas,
             0
           )
           from curso_horarios h
           where h.curso_id = c.id
         )
       end,
       estado = app.estado_curso_por_fechas(c.inicia_en, c.termina_en);

comment on column cursos.duracion_horas is
  'Calculada: horas de los bloques semanales multiplicadas por duracion_semanas.';
comment on column cursos.termina_en is
  'Calculada: inicia_en mas duracion_semanas por siete dias, incluyendo el ultimo dia.';
comment on column cursos.estado is
  'Calculado por fechas: promocion, activo o graduado.';
