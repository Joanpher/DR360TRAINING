-- ============================================================================
-- 0013 · Evaluaciones en linea
-- ============================================================================

set local search_path = public, pg_catalog;

create table evaluaciones (
  id                  uuid primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  titulo              text        not null,
  instrucciones       text,
  abre_en             timestamptz not null,
  cierra_en           timestamptz not null,
  duracion_minutos    integer     not null,
  intentos_permitidos integer     not null default 1,
  puntos_total        numeric(8,2) not null default 0,
  barajar_preguntas   boolean     not null default false,
  mostrar_resultados  boolean     not null default true,
  publicada           boolean     not null default false,
  creado_por          uuid references membresias (id) on delete set null,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint evaluaciones_tenant_uk unique (id, curso_id, institucion_id),
  constraint evaluaciones_curso_fk foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete cascade,
  constraint evaluaciones_titulo_no_vacio check (length(btrim(titulo)) > 0),
  constraint evaluaciones_ventana_valida check (cierra_en > abre_en),
  constraint evaluaciones_duracion_valida check (duracion_minutos between 1 and 480),
  constraint evaluaciones_intentos_validos check (intentos_permitidos between 1 and 10),
  constraint evaluaciones_puntos_validos check (puntos_total between 0 and 100000)
);

create table evaluacion_preguntas (
  id                  uuid primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  evaluacion_id       uuid        not null,
  orden               integer     not null,
  tipo                text        not null,
  enunciado           text        not null,
  explicacion         text,
  puntos              numeric(7,2) not null,
  obligatoria         boolean     not null default true,
  opciones            jsonb       not null default '[]'::jsonb,
  respuesta_correcta  jsonb,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint evaluacion_preguntas_tenant_uk unique (id, evaluacion_id, institucion_id),
  constraint evaluacion_preguntas_orden_uk unique (evaluacion_id, orden),
  constraint evaluacion_preguntas_evaluacion_fk
    foreign key (evaluacion_id, curso_id, institucion_id)
    references evaluaciones (id, curso_id, institucion_id) on delete cascade,
  constraint evaluacion_preguntas_tipo_valido check (
    tipo in ('seleccion_unica', 'seleccion_multiple', 'verdadero_falso', 'respuesta_libre')
  ),
  constraint evaluacion_preguntas_enunciado_no_vacio check (length(btrim(enunciado)) > 0),
  constraint evaluacion_preguntas_puntos_validos check (puntos > 0 and puntos <= 10000),
  constraint evaluacion_preguntas_opciones_arreglo check (jsonb_typeof(opciones) = 'array')
);

create table evaluacion_intentos (
  id                  uuid primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  evaluacion_id       uuid        not null,
  membresia_id        uuid        not null,
  numero              integer     not null,
  estado              text        not null default 'en_progreso',
  iniciado_en         timestamptz not null default now(),
  expira_en           timestamptz not null,
  enviado_en          timestamptz,
  calificacion        numeric(8,2),
  retroalimentacion   text,
  calificado_por      uuid references membresias (id) on delete set null,
  calificado_en       timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint evaluacion_intentos_tenant_uk unique (id, evaluacion_id, institucion_id),
  constraint evaluacion_intentos_numero_uk unique (evaluacion_id, membresia_id, numero),
  constraint evaluacion_intentos_evaluacion_fk
    foreign key (evaluacion_id, curso_id, institucion_id)
    references evaluaciones (id, curso_id, institucion_id) on delete cascade,
  constraint evaluacion_intentos_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint evaluacion_intentos_estado_valido check (estado in ('en_progreso', 'enviado', 'calificado')),
  constraint evaluacion_intentos_numero_valido check (numero between 1 and 10),
  constraint evaluacion_intentos_expiracion_valida check (expira_en >= iniciado_en),
  constraint evaluacion_intentos_calificacion_valida check (calificacion is null or calificacion >= 0)
);

create table evaluacion_respuestas (
  id                  uuid primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  evaluacion_id       uuid        not null,
  intento_id          uuid        not null,
  pregunta_id         uuid        not null,
  respuesta           jsonb       not null default '{}'::jsonb,
  es_correcta         boolean,
  puntos_obtenidos    numeric(7,2),
  comentario_docente  text,
  calificado_por      uuid references membresias (id) on delete set null,
  calificado_en       timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint evaluacion_respuestas_intento_pregunta_uk unique (intento_id, pregunta_id),
  constraint evaluacion_respuestas_intento_fk
    foreign key (intento_id, evaluacion_id, institucion_id)
    references evaluacion_intentos (id, evaluacion_id, institucion_id) on delete cascade,
  constraint evaluacion_respuestas_pregunta_fk
    foreign key (pregunta_id, evaluacion_id, institucion_id)
    references evaluacion_preguntas (id, evaluacion_id, institucion_id) on delete cascade,
  constraint evaluacion_respuestas_puntos_validos check (puntos_obtenidos is null or puntos_obtenidos >= 0)
);

create index evaluaciones_curso_ix on evaluaciones (curso_id, abre_en);
create index evaluaciones_calendario_ix on evaluaciones (institucion_id, abre_en, cierra_en) where publicada;
create index evaluacion_preguntas_orden_ix on evaluacion_preguntas (evaluacion_id, orden);
create index evaluacion_intentos_estudiante_ix on evaluacion_intentos (membresia_id, evaluacion_id, numero desc);
create index evaluacion_intentos_revision_ix on evaluacion_intentos (evaluacion_id, estado, enviado_en);
create index evaluacion_respuestas_intento_ix on evaluacion_respuestas (intento_id);

comment on table evaluaciones is 'Examenes temporizados publicados dentro de un curso.';
comment on table evaluacion_preguntas is 'Preguntas objetivas o abiertas de una evaluacion.';
comment on table evaluacion_intentos is 'Intentos temporizados de estudiantes, con nota automatica o revisada.';
comment on table evaluacion_respuestas is 'Respuestas guardadas durante un intento y su correccion.';

do $bloque$
declare
  t text;
begin
  foreach t in array array['evaluaciones', 'evaluacion_preguntas']
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
      create policy %1$I_gestion on %1$I
        for all to public
        using      (app.puede_gestionar_curso_aula(curso_id))
        with check (app.puede_gestionar_curso_aula(curso_id))
    $p$, t);
  end loop;
end
$bloque$;

create policy evaluaciones_lectura on evaluaciones
  for select to public
  using (
    app.puede_gestionar_curso_aula(curso_id)
    or (publicada and app.puede_ver_curso_aula(curso_id))
  );

create policy evaluacion_preguntas_lectura on evaluacion_preguntas
  for select to public
  using (
    app.puede_gestionar_curso_aula(curso_id)
    or (
      app.puede_ver_curso_aula(curso_id)
      and exists (
        select 1 from evaluaciones e
         where e.id = evaluacion_preguntas.evaluacion_id and e.publicada
      )
    )
  );

alter table evaluacion_intentos enable row level security;
alter table evaluacion_intentos force row level security;
create policy evaluacion_intentos_aislamiento on evaluacion_intentos
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());
create policy evaluacion_intentos_lectura on evaluacion_intentos
  for select to public
  using (membresia_id = app.mi_membresia() or app.puede_gestionar_curso_aula(curso_id));
create policy evaluacion_intentos_crear on evaluacion_intentos
  for insert to public
  with check (
    membresia_id = app.mi_membresia()
    and exists (
      select 1 from evaluaciones e
      join inscripciones i on i.curso_id = e.curso_id
       where e.id = evaluacion_intentos.evaluacion_id and e.publicada
         and i.membresia_id = app.mi_membresia()
         and i.estado in ('preinscrita', 'activa')
    )
  );
create policy evaluacion_intentos_actualizar on evaluacion_intentos
  for update to public
  using (
    (membresia_id = app.mi_membresia() and estado = 'en_progreso')
    or app.puede_gestionar_curso_aula(curso_id)
  )
  with check (membresia_id = app.mi_membresia() or app.puede_gestionar_curso_aula(curso_id));

alter table evaluacion_respuestas enable row level security;
alter table evaluacion_respuestas force row level security;
create policy evaluacion_respuestas_aislamiento on evaluacion_respuestas
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());
create policy evaluacion_respuestas_lectura on evaluacion_respuestas
  for select to public
  using (
    exists (
      select 1 from evaluacion_intentos i
       where i.id = evaluacion_respuestas.intento_id
         and (i.membresia_id = app.mi_membresia() or app.puede_gestionar_curso_aula(i.curso_id))
    )
  );
create policy evaluacion_respuestas_guardar on evaluacion_respuestas
  for all to public
  using (
    exists (
      select 1 from evaluacion_intentos i
       where i.id = evaluacion_respuestas.intento_id
         and ((i.membresia_id = app.mi_membresia() and i.estado = 'en_progreso')
           or app.puede_gestionar_curso_aula(i.curso_id))
    )
  )
  with check (
    exists (
      select 1 from evaluacion_intentos i
       where i.id = evaluacion_respuestas.intento_id
         and ((i.membresia_id = app.mi_membresia() and i.estado = 'en_progreso')
           or app.puede_gestionar_curso_aula(i.curso_id))
    )
  );

do $bloque$
declare
  t text;
begin
  foreach t in array array['evaluaciones', 'evaluacion_preguntas', 'evaluacion_intentos', 'evaluacion_respuestas']
  loop
    execute format('create trigger %I_actualizado before update on %I for each row execute function app.tocar_actualizado_en()', t, t);
    execute format('create trigger %I_institucion_inmutable before update on %I for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;

grant select, insert, update, delete on
  evaluaciones, evaluacion_preguntas, evaluacion_intentos, evaluacion_respuestas
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
