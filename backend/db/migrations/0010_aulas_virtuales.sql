-- ============================================================================
-- 0010 · Aulas virtuales por semanas
-- ============================================================================

set local search_path = public, pg_catalog;

create table aulas_curso (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  curso_id        uuid        not null,
  titulo          text        not null,
  descripcion     text,
  publicada       boolean     not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint aulas_curso_tenant_uk unique (id, curso_id, institucion_id),
  constraint aulas_curso_curso_uk unique (curso_id),
  constraint aulas_curso_curso_fk foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete cascade,
  constraint aulas_curso_titulo_no_vacio check (length(btrim(titulo)) > 0)
);

create table aula_semanas (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  curso_id        uuid        not null,
  aula_id         uuid        not null,
  numero          integer     not null,
  titulo          text        not null,
  descripcion     text,
  publicada       boolean     not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint aula_semanas_tenant_uk unique (id, curso_id, institucion_id),
  constraint aula_semanas_numero_uk unique (aula_id, numero),
  constraint aula_semanas_aula_fk foreign key (aula_id, curso_id, institucion_id)
    references aulas_curso (id, curso_id, institucion_id) on delete cascade,
  constraint aula_semanas_numero_valido check (numero between 1 and 104),
  constraint aula_semanas_titulo_no_vacio check (length(btrim(titulo)) > 0)
);

create table aula_materiales (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  curso_id        uuid        not null,
  semana_id       uuid        not null,
  titulo          text        not null,
  descripcion     text,
  archivo_nombre  text        not null,
  archivo_mime    text        not null,
  archivo_tamano  integer     not null,
  archivo         bytea       not null,
  publicado       boolean     not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint aula_materiales_semana_fk foreign key (semana_id, curso_id, institucion_id)
    references aula_semanas (id, curso_id, institucion_id) on delete cascade,
  constraint aula_materiales_titulo_no_vacio check (length(btrim(titulo)) > 0),
  constraint aula_materiales_archivo_no_vacio check (archivo_tamano > 0),
  constraint aula_materiales_archivo_acotado check (archivo_tamano <= 20971520),
  constraint aula_materiales_tamano_real check (octet_length(archivo) = archivo_tamano)
);

create table aula_tareas (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid           not null references instituciones (id) on delete cascade,
  curso_id        uuid           not null,
  semana_id       uuid           not null,
  titulo          text           not null,
  instrucciones   text,
  vence_en        timestamptz,
  puntos          numeric(7,2)   not null default 100,
  publicada       boolean        not null default true,
  creado_en       timestamptz    not null default now(),
  actualizado_en  timestamptz    not null default now(),

  constraint aula_tareas_semana_fk foreign key (semana_id, curso_id, institucion_id)
    references aula_semanas (id, curso_id, institucion_id) on delete cascade,
  constraint aula_tareas_titulo_no_vacio check (length(btrim(titulo)) > 0),
  constraint aula_tareas_puntos_validos check (puntos between 0 and 10000)
);

create index aula_semanas_orden_ix on aula_semanas (aula_id, numero);
create index aula_materiales_semana_ix on aula_materiales (semana_id, creado_en);
create index aula_tareas_semana_ix on aula_tareas (semana_id, vence_en);
create index aula_tareas_vencimiento_ix on aula_tareas (institucion_id, vence_en)
  where publicada and vence_en is not null;

comment on table aulas_curso is 'Espacio virtual de un curso, organizado en semanas.';
comment on table aula_materiales is 'Archivos instructivos publicados dentro de una semana del aula.';
comment on column aula_materiales.archivo is 'Contenido binario. Limite inicial de 20 MB por archivo.';
comment on table aula_tareas is 'Actividades asignadas por semana. Las entregas se agregan en una migracion posterior.';

-- Estas funciones encapsulan el alcance del aula y evitan repetir subconsultas
-- en cada politica de sus cuatro tablas.
create function app.puede_gestionar_curso_aula(p_curso uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select app.es_admin()
      or app.tiene_rol('coordinador'::rol_institucional)
      or exists (
        select 1 from cursos c
         where c.id = p_curso
           and c.instructor_membresia_id = app.mi_membresia()
           and c.eliminado_en is null
      )
$fn$;

create function app.puede_ver_curso_aula(p_curso uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select app.puede_gestionar_curso_aula(p_curso)
      or exists (
        select 1 from inscripciones i
         where i.curso_id = p_curso
           and i.membresia_id = app.mi_membresia()
           and i.estado in ('preinscrita', 'activa', 'completada')
      )
$fn$;

do $bloque$
declare
  t text;
begin
  foreach t in array array['aulas_curso', 'aula_semanas', 'aula_materiales', 'aula_tareas']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format($p$
      create policy %1$I_aislamiento on %1$I
        as restrictive for all to public
        using      (institucion_id = app.institucion_actual() or app.es_superadmin())
        with check (institucion_id = app.institucion_actual() or app.es_superadmin())
    $p$, t);

    execute format($p$
      create policy %1$I_lectura on %1$I
        for select to public
        using (app.puede_ver_curso_aula(curso_id))
    $p$, t);

    execute format($p$
      create policy %1$I_gestion on %1$I
        for all to public
        using      (app.puede_gestionar_curso_aula(curso_id))
        with check (app.puede_gestionar_curso_aula(curso_id))
    $p$, t);
  end loop;
end
$bloque$;

do $bloque$
declare
  t text;
begin
  foreach t in array array['aulas_curso', 'aula_semanas', 'aula_materiales', 'aula_tareas']
  loop
    execute format(
      'create trigger %I_actualizado before update on %I for each row execute function app.tocar_actualizado_en()',
      t, t
    );
    execute format(
      'create trigger %I_institucion_inmutable before update on %I for each row execute function app.institucion_inmutable()',
      t, t
    );
  end loop;
end
$bloque$;

grant select, insert, update, delete on
  aulas_curso, aula_semanas, aula_materiales, aula_tareas
  to educa_app;

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
