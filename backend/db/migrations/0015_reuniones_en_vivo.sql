-- ============================================================================
-- 0015 · Clases en vivo (salas de videollamada)
-- ============================================================================
--
-- Una reunion es una sala de Jitsi atada a un curso. El nombre de la sala lo
-- genera el backend y es opaco: nadie lo adivina y nadie lo escribe a mano. Esa
-- es la primera linea de defensa cuando el despliegue de Jitsi no exige token.
-- La segunda -y la que de verdad manda- es que para pedir la entrada hay que
-- pasar por este esquema, y aqui deciden las politicas de siempre.
--
-- El alcance se toma prestado del aula: app.puede_ver_curso_aula y
-- app.puede_gestionar_curso_aula ya saben quien esta inscrito y quien imparte.
-- Reescribir esa logica en politicas nuevas seria tener dos definiciones de
-- "pertenece a este curso" que un dia se separan sin que nadie lo note.

set local search_path = public, pg_catalog;

create type estado_reunion as enum (
  'programada', 'en_curso', 'finalizada', 'cancelada'
);

create table reuniones (
  id                       uuid           primary key default gen_random_uuid(),
  institucion_id           uuid           not null references instituciones (id) on delete cascade,
  curso_id                 uuid           not null,
  sala                     text           not null,
  titulo                   text           not null,
  descripcion              text,
  estado                   estado_reunion not null default 'programada',
  anfitrion_membresia_id   uuid           not null,
  programada_para          timestamptz,
  duracion_minutos         smallint       not null default 60,

  -- Ajustes de la sala. Viajan al cliente de Jitsi y ademas deciden quien
  -- puede entrar: sin anfitrion dentro, una sala abierta se usa y una cerrada
  -- no.
  abrir_sin_anfitrion      boolean        not null default false,
  silenciar_al_entrar      boolean        not null default true,
  camara_apagada_al_entrar boolean        not null default false,
  permite_grabacion        boolean        not null default false,

  iniciada_en              timestamptz,
  finalizada_en            timestamptz,
  cancelada_en             timestamptz,
  motivo_cancelacion       text,
  creada_por               uuid           references usuarios (id) on delete set null,
  creado_en                timestamptz    not null default now(),
  actualizado_en           timestamptz    not null default now(),

  constraint reuniones_tenant_uk unique (id, institucion_id),
  constraint reuniones_curso_tenant_uk unique (id, curso_id, institucion_id),
  -- Global y no por institucion: el nombre de sala viaja a un servidor de
  -- Jitsi que no sabe nada de tenants, asi que dos cursos de dos centros con
  -- la misma sala acabarian en la misma llamada.
  constraint reuniones_sala_uk unique (sala),
  constraint reuniones_curso_fk foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete cascade,
  constraint reuniones_anfitrion_fk foreign key (anfitrion_membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete restrict,
  constraint reuniones_titulo_no_vacio check (length(btrim(titulo)) > 0),
  constraint reuniones_sala_valida check (sala ~ '^[a-z0-9-]{12,80}$'),
  constraint reuniones_duracion_valida check (duracion_minutos between 5 and 600),
  constraint reuniones_estado_coherente check (
    (estado <> 'en_curso'   or iniciada_en is not null) and
    (estado <> 'finalizada' or finalizada_en is not null) and
    (estado <> 'cancelada'  or cancelada_en is not null)
  )
);

create index reuniones_curso_ix
  on reuniones (institucion_id, curso_id, programada_para desc nulls last);
create index reuniones_agenda_ix
  on reuniones (institucion_id, estado, programada_para)
  where estado in ('programada', 'en_curso');

comment on table reuniones is
  'Sala de videollamada de un curso. El proveedor es Jitsi; aqui vive el permiso.';
comment on column reuniones.sala is
  'Nombre opaco de la sala en el servidor de Jitsi. Lo genera el backend, nunca la persona.';
comment on column reuniones.abrir_sin_anfitrion is
  'Si es falso, el alumnado solo entra cuando el anfitrion ha iniciado la reunion.';

-- La asistencia es un registro, no un estado: una fila por persona y reunion,
-- que acumula minutos aunque se caiga la conexion y se vuelva a entrar. Contar
-- una fila por entrada obligaria a agrupar y sumar en cada informe.
create table reunion_asistencias (
  id                  uuid        primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  reunion_id          uuid        not null,
  membresia_id        uuid        not null,
  es_anfitrion        boolean     not null default false,
  primera_entrada_en  timestamptz not null default now(),
  ultima_entrada_en   timestamptz not null default now(),
  salida_en           timestamptz,
  minutos             integer     not null default 0,
  entradas            smallint    not null default 1,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint reunion_asistencias_tenant_uk unique (id, institucion_id),
  constraint reunion_asistencias_persona_uk unique (reunion_id, membresia_id),
  constraint reunion_asistencias_reunion_fk
    foreign key (reunion_id, curso_id, institucion_id)
    references reuniones (id, curso_id, institucion_id) on delete cascade,
  constraint reunion_asistencias_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint reunion_asistencias_minutos_validos check (minutos >= 0),
  constraint reunion_asistencias_entradas_validas check (entradas > 0)
);

create index reunion_asistencias_reunion_ix
  on reunion_asistencias (institucion_id, reunion_id, primera_entrada_en);
create index reunion_asistencias_persona_ix
  on reunion_asistencias (institucion_id, membresia_id, primera_entrada_en desc);

comment on table reunion_asistencias is
  'Quien entro a cada clase en vivo y cuantos minutos estuvo. Una fila por persona.';

-- ---------------------------------------------------------------------------
-- Politicas
-- ---------------------------------------------------------------------------

alter table reuniones enable row level security;
alter table reuniones force row level security;

create policy reuniones_aislamiento on reuniones
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());

create policy reuniones_lectura on reuniones
  for select to public
  using (app.puede_ver_curso_aula(curso_id));

create policy reuniones_gestion on reuniones
  for all to public
  using      (app.puede_gestionar_curso_aula(curso_id))
  with check (app.puede_gestionar_curso_aula(curso_id));

alter table reunion_asistencias enable row level security;
alter table reunion_asistencias force row level security;

create policy reunion_asistencias_aislamiento on reunion_asistencias
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());

create policy reunion_asistencias_lectura on reunion_asistencias
  for select to public
  using (
    membresia_id = app.mi_membresia()
    or app.puede_gestionar_curso_aula(curso_id)
  );

-- Cuando una sala esta abierta. Es la unica definicion: la usan la politica de
-- entrada, la agenda y el aviso de "en vivo" de la barra de navegacion. Tenerla
-- escrita tres veces seria tener tres reglas que un dia dejan de coincidir.
--
-- Sin anfitrion la sala no existe, salvo que la reunion se haya marcado para
-- abrirse sola: entonces se abre en su franja horaria -con un cuarto de hora de
-- cortesia antes- y se cierra al agotarse la duracion prevista.
create function app.reunion_abierta(p_reunion uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select coalesce(
    (select r.estado = 'en_curso'
         or (r.estado = 'programada'
             and r.abrir_sin_anfitrion
             and r.programada_para is not null
             and now() >= r.programada_para - interval '15 minutes'
             and now() <  r.programada_para
                          + make_interval(mins => r.duracion_minutos))
       from reuniones r
      where r.id = p_reunion),
    false)
$fn$;

revoke all on function app.reunion_abierta(uuid) from public;
grant execute on function app.reunion_abierta(uuid) to educa_app;

-- Cuanta gente hay en la sala. El alumnado solo ve su propia fila de
-- asistencia -y esta bien que sea asi-, pero entonces un count() le devuelve
-- uno y la pantalla mentiria. Esta funcion salta la politica a proposito para
-- devolver dos numeros y nada mas: nunca quien esta dentro, solo cuantos. El
-- permiso se comprueba a mano porque security definer lo desactiva.
create function app.reunion_conteo(p_reunion uuid)
  returns table (total integer, presentes integer)
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select count(*)::int,
         count(*) filter (where a.salida_en is null)::int
    from reunion_asistencias a
   where a.reunion_id = p_reunion
     and app.puede_ver_curso_aula(
           (select r.curso_id from reuniones r where r.id = p_reunion))
$fn$;

revoke all on function app.reunion_conteo(uuid) from public;
grant execute on function app.reunion_conteo(uuid) to educa_app;

-- Entrar a la sala es lo unico que el alumnado escribe aqui, y solo sobre su
-- propia fila. Que la sala tenga que estar abierta va en la politica y no solo
-- en el servicio: asi una llamada al endpoint fuera de hora se estrella contra
-- la base, que es donde la regla no se puede rodear.
create policy reunion_asistencias_entrar on reunion_asistencias
  for insert to public
  with check (
    membresia_id = app.mi_membresia()
    and app.puede_ver_curso_aula(curso_id)
    and app.reunion_abierta(reunion_id)
  );

create policy reunion_asistencias_propia on reunion_asistencias
  for update to public
  using      (membresia_id = app.mi_membresia())
  with check (membresia_id = app.mi_membresia());

create policy reunion_asistencias_gestion on reunion_asistencias
  for all to public
  using      (app.puede_gestionar_curso_aula(curso_id))
  with check (app.puede_gestionar_curso_aula(curso_id));

-- ---------------------------------------------------------------------------
-- Invariantes mecanicas
-- ---------------------------------------------------------------------------

do $bloque$
declare
  t text;
begin
  foreach t in array array['reuniones', 'reunion_asistencias'] loop
    execute format(
      'create trigger %I_actualizado before update on %I
         for each row execute function app.tocar_actualizado_en()', t, t);
    execute format(
      'create trigger %I_institucion_inmutable before update on %I
         for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;

grant select, insert, update on reuniones, reunion_asistencias to educa_app;

-- Ni una clase impartida ni una asistencia se borran: una reunion que no debio
-- existir se cancela. El revoke es explicito porque las default privileges de
-- la 0001 conceden los cuatro permisos a toda tabla nueva, y "conceder menos"
-- no existe.
revoke delete on reuniones, reunion_asistencias from educa_app;

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
