-- ============================================================================
-- 0003 · Inscripción, matrícula y cobros
-- ----------------------------------------------------------------------------
-- El acto central del colegio: una familia inscribe a un niño, paga la
-- inscripción, y el niño recibe una matrícula y una clave con las que entra a
-- la plataforma y aparece en las clases de su sección.
--
-- Cuatro decisiones que explican la forma de todo lo que sigue:
--
--   1. La matrícula es la credencial de acceso, no un número interno. Por eso
--      se genera con un contador atómico y lleva las siglas del colegio
--      delante: la plataforma vive en un solo dominio y al entrar hay que saber
--      de qué colegio es quien escribe "CDP-2026-0001".
--
--   2. Los datos del estudiante van en su propia tabla y no en membresias.
--      Una membresía responde "qué es esta persona aquí"; un expediente
--      responde "quién es este niño": fecha de nacimiento, alergias, quién lo
--      retira. Son dos preguntas con ciclos de vida distintos.
--
--   3. El representante es una entidad aparte y no un puñado de columnas en el
--      estudiante. Una madre con tres hijos en el colegio es una persona, no
--      tres copias de la misma con teléfonos que se van desincronizando.
--
--   4. El dinero se registra, no se procesa. El sistema genera los cargos y
--      guarda los pagos que la secretaría recibe; no cobra con tarjeta. Los
--      montos son numeric, nunca float: un centavo perdido por redondeo binario
--      en una mensualidad se convierte en una discusión con un padre.
-- ============================================================================

set local search_path = public, pg_catalog;


-- ----------------------------------------------------------------------------
-- 1 · Tipos
-- ----------------------------------------------------------------------------

create type tipo_documento as enum ('cedula', 'acta_nacimiento', 'pasaporte', 'otro');

create type sexo_persona as enum ('f', 'm');

create type parentesco as enum (
  'madre', 'padre', 'tutor', 'abuelo', 'hermano', 'tio', 'otro'
);

create type estado_inscripcion as enum (
  'preinscrito',  -- llenó el formulario, todavía no pagó la inscripción
  'inscrito',     -- activo en su sección
  'retirado',     -- se fue a mitad de año
  'promovido',    -- terminó y pasa al siguiente grado
  'repitente'     -- terminó y repite
);

create type estado_cargo as enum ('pendiente', 'pagado', 'anulado', 'condonado');

create type tipo_concepto as enum (
  'inscripcion', 'mensualidad', 'material', 'uniforme', 'actividad', 'otro'
);

create type metodo_pago as enum (
  'efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'
);


-- ----------------------------------------------------------------------------
-- 2 · Contadores: de dónde sale la matrícula
-- ----------------------------------------------------------------------------
-- Un insert con on conflict do update es atómico: bloquea la fila del contador
-- hasta el commit, así que dos secretarias inscribiendo a la vez nunca sacan el
-- mismo número. Calcularlo con max(codigo)+1 sí lo permitiría.

create table contadores (
  institucion_id uuid not null references instituciones (id) on delete cascade,
  clave          text not null,
  valor          integer not null default 0,

  primary key (institucion_id, clave)
);

comment on table  contadores is 'Secuencias por institucion. La matricula sale de aqui, no de un max()+1.';
comment on column contadores.clave is 'Espacio de numeracion: "matricula:2026" o "empleado".';

create function app.siguiente_numero(p_institucion uuid, p_clave text)
  returns integer
  language sql
  set search_path = public, pg_catalog
as $fn$
  insert into contadores (institucion_id, clave, valor)
  values (p_institucion, p_clave, 1)
  on conflict (institucion_id, clave)
  do update set valor = contadores.valor + 1
  returning valor
$fn$;

comment on function app.siguiente_numero(uuid, text) is
  'Siguiente numero de una secuencia. Atomico: dos peticiones simultaneas nunca reciben el mismo.';


-- ----------------------------------------------------------------------------
-- 3 · Expediente del estudiante
-- ----------------------------------------------------------------------------
-- Uno a uno con la membresía: la membresía dice que esta persona es estudiante
-- de este colegio, y esto dice quién es.

create table estudiantes (
  membresia_id        uuid primary key,
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  tipo_documento      tipo_documento not null default 'acta_nacimiento',
  documento           text,
  fecha_nacimiento    date,
  sexo                sexo_persona,
  nacionalidad        text        not null default 'Dominicana',
  lugar_nacimiento    text,
  direccion           text,
  telefono_casa       text,
  tipo_sangre         text,
  condiciones_medicas text,
  alergias            text,
  colegio_procedencia text,
  observaciones       text,
  datos               jsonb       not null default '{}'::jsonb,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint estudiantes_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint estudiantes_nacimiento_razonable
    check (fecha_nacimiento is null or fecha_nacimiento > date '1950-01-01')
);

comment on table  estudiantes is 'Expediente del estudiante. La membresia dice que lo es; esto dice quien es.';
comment on column estudiantes.datos is 'Campos que pide un colegio concreto y no justifican una columna.';

-- El documento identifica a la persona: no se repite dentro del colegio.
create unique index estudiantes_documento_uk
  on estudiantes (institucion_id, documento) where documento is not null;


-- ----------------------------------------------------------------------------
-- 4 · Representantes
-- ----------------------------------------------------------------------------

create table representantes (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  -- Null mientras no tenga acceso a la plataforma. Cuando lo tenga, apunta a su
  -- cuenta: el representante es una persona, no una fila de contacto.
  usuario_id      uuid references usuarios (id) on delete set null,
  nombres         text        not null,
  apellidos       text        not null,
  nombre_completo text generated always as (nombres || ' ' || apellidos) stored,
  tipo_documento  tipo_documento not null default 'cedula',
  documento       text,
  telefono        text,
  telefono_trabajo text,
  correo          citext,
  direccion       text,
  ocupacion       text,
  lugar_trabajo   text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz,

  constraint representantes_tenant_uk unique (id, institucion_id),
  constraint representantes_nombres_no_vacios
    check (length(btrim(nombres)) > 0 and length(btrim(apellidos)) > 0)
);

comment on table representantes is
  'Madre, padre o tutor. Una persona con tres hijos en el colegio es una fila, no tres.';

create unique index representantes_documento_uk
  on representantes (institucion_id, documento)
  where documento is not null and eliminado_en is null;
create index representantes_nombre_ix on representantes (institucion_id, nombre_completo);


create table estudiante_representantes (
  institucion_id     uuid    not null references instituciones (id) on delete cascade,
  membresia_id       uuid    not null,
  representante_id   uuid    not null,
  parentesco         parentesco not null default 'madre',
  -- Quién recibe la factura y a quién se llama primero. Solo uno por estudiante.
  es_principal       boolean not null default false,
  puede_retirar      boolean not null default true,
  creado_en          timestamptz not null default now(),

  primary key (membresia_id, representante_id),
  constraint estudiante_representantes_estudiante_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint estudiante_representantes_representante_fk
    foreign key (representante_id, institucion_id)
    references representantes (id, institucion_id) on delete restrict
);

comment on column estudiante_representantes.puede_retirar is
  'Si puede recoger al estudiante del colegio. Lo pregunta la recepcion, no es decorativo.';

create unique index estudiante_representantes_principal_uk
  on estudiante_representantes (membresia_id) where es_principal;
create index estudiante_representantes_rep_ix
  on estudiante_representantes (institucion_id, representante_id);


-- ----------------------------------------------------------------------------
-- 5 · Inscripción
-- ----------------------------------------------------------------------------

create table inscripciones (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  ano_escolar_id  uuid        not null,
  membresia_id    uuid        not null,
  seccion_id      uuid        not null,
  estado          estado_inscripcion not null default 'preinscrito',
  inscrito_en     date        not null default current_date,
  -- Resultado al cerrar el año. Null mientras el año esté en curso.
  promedio_final  numeric(5,2),
  retirado_en     date,
  motivo_retiro   text,
  observaciones   text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint inscripciones_tenant_uk unique (id, institucion_id),
  constraint inscripciones_ano_fk
    foreign key (ano_escolar_id, institucion_id)
    references anos_escolares (id, institucion_id) on delete restrict,
  constraint inscripciones_estudiante_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint inscripciones_seccion_fk
    foreign key (seccion_id, institucion_id)
    references secciones (id, institucion_id) on delete restrict,
  constraint inscripciones_promedio_valido
    check (promedio_final is null or promedio_final between 0 and 100)
);

comment on table inscripciones is
  'Un estudiante en una seccion durante un ano. Es la fila que lo pone en sus clases.';

-- Un estudiante se inscribe una sola vez por año escolar.
create unique index inscripciones_ano_estudiante_uk
  on inscripciones (ano_escolar_id, membresia_id);
create index inscripciones_seccion_ix on inscripciones (institucion_id, seccion_id);
create index inscripciones_estado_ix on inscripciones (institucion_id, ano_escolar_id, estado);


-- El estudiante dentro de cada una de sus clases. Estas filas no se escriben a
-- mano: se generan de los cursos de la sección al inscribir.
create table curso_estudiantes (
  institucion_id  uuid    not null references instituciones (id) on delete cascade,
  curso_id        uuid    not null,
  inscripcion_id  uuid    not null,
  retirado_en     date,
  creado_en       timestamptz not null default now(),

  primary key (curso_id, inscripcion_id),
  constraint curso_estudiantes_curso_fk
    foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete cascade,
  constraint curso_estudiantes_inscripcion_fk
    foreign key (inscripcion_id, institucion_id)
    references inscripciones (id, institucion_id) on delete cascade
);

comment on table curso_estudiantes is
  'Quien esta en cada clase. Se genera de los cursos de la seccion al inscribir, no a mano.';

create index curso_estudiantes_inscripcion_ix
  on curso_estudiantes (institucion_id, inscripcion_id);


-- ----------------------------------------------------------------------------
-- 6 · Cobros
-- ----------------------------------------------------------------------------
-- El colegio define sus conceptos una vez al año (inscripción, mensualidad) y
-- el sistema genera los cargos. Lo que se cobra queda congelado en el cargo:
-- subir la mensualidad en marzo no puede cambiar lo que ya se facturó en enero,
-- y por eso cargos.monto es una copia y no una referencia al concepto.

create table conceptos_cobro (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  ano_escolar_id  uuid,
  nombre          text        not null,
  tipo            tipo_concepto not null default 'otro',
  monto           numeric(12,2) not null,
  -- Para mensualidades: cuántas se generan y el día de vencimiento de cada una.
  cuotas          smallint,
  dia_vencimiento smallint,
  obligatorio     boolean     not null default true,
  activo          boolean     not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint conceptos_cobro_tenant_uk unique (id, institucion_id),
  constraint conceptos_cobro_ano_fk
    foreign key (ano_escolar_id, institucion_id)
    references anos_escolares (id, institucion_id) on delete cascade,
  constraint conceptos_cobro_monto_positivo check (monto >= 0),
  constraint conceptos_cobro_cuotas_validas
    check (cuotas is null or cuotas between 1 and 12),
  constraint conceptos_cobro_dia_valido
    check (dia_vencimiento is null or dia_vencimiento between 1 and 28)
);

comment on table  conceptos_cobro is 'Lo que cobra el colegio: inscripcion, mensualidad, materiales.';
comment on column conceptos_cobro.cuotas is 'Mensualidades a generar. 10 es lo habitual: agosto a junio sin diciembre.';
comment on column conceptos_cobro.dia_vencimiento is 'Dia del mes en que vence cada cuota. Hasta 28 para que exista en febrero.';

create unique index conceptos_cobro_nombre_uk
  on conceptos_cobro (institucion_id, ano_escolar_id, nombre);


create table cargos (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  inscripcion_id  uuid        not null,
  concepto_id     uuid,
  descripcion     text        not null,
  monto           numeric(12,2) not null,
  -- 1..12 en mensualidades; null en cargos de una vez.
  cuota           smallint,
  vence_en        date,
  estado          estado_cargo not null default 'pendiente',
  anulado_en      timestamptz,
  motivo          text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint cargos_tenant_uk unique (id, institucion_id),
  constraint cargos_inscripcion_fk
    foreign key (inscripcion_id, institucion_id)
    references inscripciones (id, institucion_id) on delete cascade,
  constraint cargos_concepto_fk
    foreign key (concepto_id, institucion_id)
    references conceptos_cobro (id, institucion_id) on delete set null,
  constraint cargos_monto_positivo check (monto >= 0)
);

comment on table  cargos is 'Lo que debe una inscripcion. El monto es copia, no referencia: no cambia si sube el precio.';
comment on column cargos.cuota is 'Numero de mensualidad. Null en cargos de una sola vez, como la inscripcion.';

create unique index cargos_cuota_uk
  on cargos (inscripcion_id, concepto_id, cuota)
  where concepto_id is not null and cuota is not null;
create index cargos_pendientes_ix
  on cargos (institucion_id, estado, vence_en) where estado = 'pendiente';
create index cargos_inscripcion_ix on cargos (institucion_id, inscripcion_id);


create table pagos (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  cargo_id        uuid        not null,
  monto           numeric(12,2) not null,
  metodo          metodo_pago not null default 'efectivo',
  referencia      text,
  recibido_en     date        not null default current_date,
  registrado_por  uuid references usuarios (id) on delete set null,
  nota            text,
  anulado_en      timestamptz,
  motivo_anulacion text,
  creado_en       timestamptz not null default now(),

  constraint pagos_tenant_uk unique (id, institucion_id),
  constraint pagos_cargo_fk
    foreign key (cargo_id, institucion_id)
    references cargos (id, institucion_id) on delete restrict,
  constraint pagos_monto_positivo check (monto > 0)
);

comment on table  pagos is 'Un pago recibido contra un cargo. Se anula, no se borra: la contabilidad no olvida.';
comment on column pagos.referencia is 'Numero de transferencia, cheque o recibo. Lo que permite cuadrar con el banco.';

create index pagos_cargo_ix on pagos (institucion_id, cargo_id);
create index pagos_fecha_ix on pagos (institucion_id, recibido_en);


-- ----------------------------------------------------------------------------
-- 7 · Disparadores
-- ----------------------------------------------------------------------------

do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'estudiantes', 'representantes', 'inscripciones', 'conceptos_cobro', 'cargos'
  ]
  loop
    execute format(
      'create trigger %I_actualizado before update on %I
         for each row execute function app.tocar_actualizado_en()', t, t);
  end loop;

  foreach t in array array[
    'estudiantes', 'representantes', 'estudiante_representantes', 'inscripciones',
    'curso_estudiantes', 'conceptos_cobro', 'cargos', 'pagos'
  ]
  loop
    execute format(
      'create trigger %I_institucion_inmutable before update on %I
         for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;


-- ----------------------------------------------------------------------------
-- 8 · Row level security
-- ----------------------------------------------------------------------------

-- Con qué membresía entra el usuario actual a esta institución. Es la pieza que
-- deja escribir "esto es mío" en una política sin repetir el mismo subselect
-- en cada una.
create function app.mi_membresia() returns uuid
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select m.id
    from membresias m
   where m.usuario_id = app.usuario_actual()
     and m.institucion_id = app.institucion_actual()
     and m.estado = 'activa'
     and m.eliminado_en is null
   limit 1
$fn$;

comment on function app.mi_membresia() is
  'Membresia del usuario actual en la institucion del contexto. Null si no pertenece.';


-- Lo administrativo: solo administración lo ve y lo toca. Los datos de un
-- representante y las alergias de un niño no son cosa de sus compañeros.
do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'representantes', 'estudiante_representantes', 'conceptos_cobro'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);

    execute format($p$
      create policy %1$I_aislamiento on %1$I
        as restrictive for all to public
        using       (institucion_id = app.institucion_actual() or app.es_superadmin())
        with check  (institucion_id = app.institucion_actual() or app.es_superadmin())
    $p$, t);

    execute format($p$
      create policy %1$I_gestion on %1$I
        for all to public
        using      (app.es_admin())
        with check (app.es_admin())
    $p$, t);
  end loop;
end
$bloque$;

-- Los conceptos de cobro sí los puede leer cualquier miembro: saber cuánto vale
-- la mensualidad no es información reservada.
create policy conceptos_cobro_lectura on conceptos_cobro
  for select to public using (app.es_miembro(institucion_id));


-- Lo que el propio estudiante tiene derecho a ver de sí mismo.
do $bloque$
declare
  t text;
begin
  foreach t in array array['estudiantes', 'inscripciones', 'curso_estudiantes', 'cargos', 'pagos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);

    execute format($p$
      create policy %1$I_aislamiento on %1$I
        as restrictive for all to public
        using       (institucion_id = app.institucion_actual() or app.es_superadmin())
        with check  (institucion_id = app.institucion_actual() or app.es_superadmin())
    $p$, t);

    execute format($p$
      create policy %1$I_gestion on %1$I
        for all to public
        using      (app.es_admin())
        with check (app.es_admin())
    $p$, t);
  end loop;
end
$bloque$;

create policy estudiantes_lectura_propia on estudiantes
  for select to public using (membresia_id = app.mi_membresia());

create policy inscripciones_lectura_propia on inscripciones
  for select to public using (membresia_id = app.mi_membresia());

/*
  Un estudiante ve sus propias filas de clase; un docente ve las de los cursos
  que imparte, que es como sabe a quién califica.
*/
create policy curso_estudiantes_lectura_propia on curso_estudiantes
  for select to public
  using (
    inscripcion_id in (
      select i.id from inscripciones i where i.membresia_id = app.mi_membresia()
    )
    or curso_id in (
      select c.id from cursos c where c.docente_membresia_id = app.mi_membresia()
    )
  );

create policy cargos_lectura_propia on cargos
  for select to public
  using (
    inscripcion_id in (
      select i.id from inscripciones i where i.membresia_id = app.mi_membresia()
    )
  );

create policy pagos_lectura_propia on pagos
  for select to public
  using (
    cargo_id in (
      select c.id from cargos c
       join inscripciones i on i.id = c.inscripcion_id
      where i.membresia_id = app.mi_membresia()
    )
  );


-- ----------------------------------------------------------------------------
-- 9 · Permisos
-- ----------------------------------------------------------------------------

grant select, insert, update, delete on
  estudiantes, representantes, estudiante_representantes, inscripciones,
  curso_estudiantes, conceptos_cobro, cargos
  to educa_app;

-- Los pagos no se borran: se anulan. La contabilidad no olvida, y quitarle el
-- delete al rol de la aplicación hace que un error de programación tampoco
-- pueda hacerlo.
grant select, insert, update on pagos to educa_app;

grant select, insert, update on contadores to educa_app;

-- educa_auth necesita poner la clave del estudiante al inscribirlo y leer su
-- matricula al entrar. Ya tenia select e insert sobre usuarios y membresias.
grant select on contadores to educa_auth;
