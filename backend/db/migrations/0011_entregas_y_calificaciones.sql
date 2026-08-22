-- ============================================================================
-- 0011 · Entregas y calificaciones de tareas
-- ============================================================================

set local search_path = public, pg_catalog;

alter table aula_tareas
  add constraint aula_tareas_tenant_uk unique (id, curso_id, institucion_id);

create table aula_entregas (
  id                uuid primary key default gen_random_uuid(),
  institucion_id    uuid           not null references instituciones (id) on delete cascade,
  curso_id          uuid           not null,
  tarea_id          uuid           not null,
  membresia_id      uuid           not null,
  comentario        text,
  archivo_nombre    text,
  archivo_mime      text,
  archivo_tamano    integer,
  archivo           bytea,
  entregado_en      timestamptz    not null default now(),
  calificacion      numeric(7,2),
  retroalimentacion text,
  calificado_por    uuid references membresias (id) on delete set null,
  calificado_en     timestamptz,
  creado_en         timestamptz    not null default now(),
  actualizado_en    timestamptz    not null default now(),

  constraint aula_entregas_tenant_uk unique (id, institucion_id),
  constraint aula_entregas_tarea_estudiante_uk unique (tarea_id, membresia_id),
  constraint aula_entregas_tarea_fk
    foreign key (tarea_id, curso_id, institucion_id)
    references aula_tareas (id, curso_id, institucion_id) on delete cascade,
  constraint aula_entregas_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint aula_entregas_contenido check (
    nullif(btrim(comentario), '') is not null or archivo is not null
  ),
  constraint aula_entregas_archivo_completo check (
    (archivo is null and archivo_nombre is null and archivo_mime is null and archivo_tamano is null)
    or
    (archivo is not null and archivo_nombre is not null and archivo_mime is not null and archivo_tamano is not null)
  ),
  constraint aula_entregas_archivo_acotado check (
    archivo_tamano is null or archivo_tamano between 1 and 20971520
  ),
  constraint aula_entregas_tamano_real check (
    archivo is null or octet_length(archivo) = archivo_tamano
  ),
  constraint aula_entregas_calificacion_valida check (
    calificacion is null or calificacion >= 0
  ),
  constraint aula_entregas_calificacion_coherente check (
    (calificacion is null and calificado_en is null)
    or
    (calificacion is not null and calificado_en is not null)
  )
);

create index aula_entregas_tarea_ix on aula_entregas (tarea_id, entregado_en);
create index aula_entregas_estudiante_ix on aula_entregas (membresia_id, entregado_en);

comment on table aula_entregas is
  'Una entrega por estudiante y tarea. Puede reemplazarse hasta ser calificada.';
comment on column aula_entregas.calificacion is
  'Puntos obtenidos, validados contra los puntos máximos de la tarea.';

alter table aula_entregas enable row level security;
alter table aula_entregas force row level security;

create policy aula_entregas_aislamiento on aula_entregas
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());

create policy aula_entregas_lectura on aula_entregas
  for select to public
  using (
    membresia_id = app.mi_membresia()
    or app.puede_gestionar_curso_aula(curso_id)
  );

create policy aula_entregas_crear on aula_entregas
  for insert to public
  with check (
    membresia_id = app.mi_membresia()
    and exists (
      select 1
        from inscripciones i
        join aula_tareas t on t.id = tarea_id and t.curso_id = i.curso_id
        join aula_semanas s on s.id = t.semana_id
       where i.membresia_id = app.mi_membresia()
         and i.estado in ('preinscrita', 'activa')
         and t.publicada and s.publicada
    )
  );

create policy aula_entregas_actualizar_propia on aula_entregas
  for update to public
  using (membresia_id = app.mi_membresia() and calificacion is null)
  with check (membresia_id = app.mi_membresia());

create policy aula_entregas_calificar on aula_entregas
  for update to public
  using      (app.puede_gestionar_curso_aula(curso_id))
  with check (app.puede_gestionar_curso_aula(curso_id));

create trigger aula_entregas_actualizado
  before update on aula_entregas
  for each row execute function app.tocar_actualizado_en();
create trigger aula_entregas_institucion_inmutable
  before update on aula_entregas
  for each row execute function app.institucion_inmutable();

create function app.calificar_entrega(
  p_entrega uuid,
  p_calificacion numeric,
  p_retroalimentacion text
) returns void
  language plpgsql security definer
  set search_path = public, pg_catalog
as $fn$
declare
  v_curso uuid;
  v_maximo numeric;
begin
  select e.curso_id, t.puntos
    into v_curso, v_maximo
    from aula_entregas e
    join aula_tareas t on t.id = e.tarea_id
   where e.id = p_entrega;

  if v_curso is null then
    raise exception 'La entrega no existe.' using errcode = 'P0002';
  end if;
  if not app.puede_gestionar_curso_aula(v_curso) then
    raise exception 'No puedes calificar esta entrega.' using errcode = '42501';
  end if;
  if p_calificacion < 0 or p_calificacion > v_maximo then
    raise exception 'La calificacion debe estar entre 0 y %.', v_maximo
      using errcode = '23514';
  end if;

  update aula_entregas
     set calificacion = p_calificacion,
         retroalimentacion = nullif(btrim(p_retroalimentacion), ''),
         calificado_por = app.mi_membresia(),
         calificado_en = now()
   where id = p_entrega;
end
$fn$;

revoke all on function app.calificar_entrega(uuid, numeric, text) from public;
grant execute on function app.calificar_entrega(uuid, numeric, text) to educa_app;

grant select on aula_entregas to educa_app;
grant insert (
  institucion_id, curso_id, tarea_id, membresia_id, comentario,
  archivo_nombre, archivo_mime, archivo_tamano, archivo, entregado_en
) on aula_entregas to educa_app;
grant update (
  comentario, archivo_nombre, archivo_mime, archivo_tamano, archivo, entregado_en
) on aula_entregas to educa_app;

do $bloque$
declare
  v_sin_rls text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_sin_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'auditoria')
     and c.relkind = 'r'
     and not c.relrowsecurity;

  if v_sin_rls is not null then
    raise exception 'estas tablas quedaron sin row level security: %', v_sin_rls;
  end if;
end
$bloque$;
