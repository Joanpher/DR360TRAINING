-- ============================================================================
-- 0004 · Catalogo de cursos e inscripcion
-- ----------------------------------------------------------------------------
-- Cambio de producto. DR360TRAINING deja de ser un sistema para colegios y pasa
-- a serlo para instituciones que venden cursos sueltos: una academia de idiomas,
-- un centro tecnico, una empresa que certifica.
--
-- Eso no es un ajuste de vocabulario, es otro modelo. En un colegio el alumno se
-- inscribe en un GRADO y de ahi salen sus materias; aqui se inscribe en UN
-- CURSO, que es la unidad que se anuncia, se cotiza y se cobra. Todo lo que
-- existia para representar el camino escolar -ano lectivo, grados, secciones,
-- plan de estudio, representantes, mensualidades- sobra, y dejarlo "por si
-- acaso" solo garantiza que dentro de seis meses nadie sepa que tablas estan
-- vivas.
--
-- Lo que se conserva de las tres migraciones anteriores:
--
--   · el nucleo multi-tenant entero: instituciones, usuarios, membresias,
--     roles, invitaciones, sesiones, sedes, RLS y bitacora
--   · contadores y app.siguiente_numero(): de ahi sale la matricula
--   · la pareja cargos/pagos, que ya sabia registrar abonos parciales y anular
--     sin borrar
--
-- Cuatro decisiones que explican la forma de todo lo que sigue:
--
--   1. El curso es la unidad de venta. Precio, duracion, cupo, horario e imagen
--      viven en el y no repartidos en un cruce de tablas: si pintar una tarjeta
--      del catalogo publico necesita cinco joins, el catalogo esta mal hecho.
--
--   2. La matricula se emite una vez por PERSONA, no una por curso. Quien lleva
--      ingles y al ano siguiente contabilidad es el mismo alumno del centro: su
--      matricula y su clave son las mismas, y sus dos inscripciones cuelgan de
--      la misma membresia. Emitir una credencial por curso obligaria a la gente
--      a llevar tres claves del mismo sitio.
--
--   3. El precio se copia a la inscripcion en el momento de inscribir. Subir el
--      curso de 5,000 a 6,000 en marzo no puede cambiar lo que se le cobro a
--      quien entro en enero. Misma razon por la que cargos.monto era una copia.
--
--   4. El horario es una tabla, no un texto. "Lun y Mie 6:00-8:00 PM" escrito a
--      mano no se puede ordenar, ni cruzar con un aula ocupada, ni pintar en un
--      calendario: tres cosas que se piden siempre.
-- ============================================================================

set local search_path = public, pg_catalog;


-- ----------------------------------------------------------------------------
-- 1 · Fuera lo escolar
-- ----------------------------------------------------------------------------
-- El orden es el de las dependencias: primero lo que apunta, despues lo
-- apuntado. Sin cascade a proposito, para que si queda una referencia viva que
-- no vimos, la migracion falle aqui en vez de llevarse por delante algo que si
-- hacia falta.

drop table if exists pagos;
drop table if exists cargos;
drop table if exists conceptos_cobro;
drop table if exists curso_estudiantes;
drop table if exists inscripciones;
drop table if exists estudiante_representantes;
drop table if exists representantes;
drop table if exists estudiantes;
drop table if exists cursos;
drop table if exists plan_estudio;
drop table if exists asignaturas;
drop table if exists secciones;
drop table if exists grados;
drop table if exists periodos_calificacion;
drop table if exists anos_escolares;

-- El organigrama universitario -facultad, escuela, departamento- tampoco tiene
-- sentido en un centro de cursos. Lo que agrupa un catalogo es la categoria,
-- que llega mas abajo y es una lista plana.
alter table membresias drop constraint if exists membresias_unidad_fk;
alter table membresias drop column if exists unidad_academica_id;
drop table if exists unidades_academicas;

-- La modalidad ('colegio' | 'cursos') existia para distinguir dos productos
-- dentro del mismo esquema. Ya no hay dos.
alter table instituciones drop column if exists modalidad;

drop type if exists modalidad_institucion;
drop type if exists nivel_escolar;
drop type if exists estado_ano_escolar;
drop type if exists tipo_unidad_academica;
drop type if exists tipo_concepto;
drop type if exists parentesco;

-- estado_inscripcion se recrea mas abajo: los estados de un curso suelto no son
-- los de un ano escolar. No existe 'promovido' ni 'repitente' cuando no hay
-- grado siguiente al que pasar.
drop type if exists estado_inscripcion;

-- Se conservan y se reutilizan tal cual: estado_curso, estado_cargo,
-- metodo_pago, tipo_documento y sexo_persona.


-- ----------------------------------------------------------------------------
-- 2 · Tipos nuevos
-- ----------------------------------------------------------------------------

create type modalidad_curso as enum ('presencial', 'virtual', 'hibrido');

create type nivel_curso as enum ('basico', 'intermedio', 'avanzado');

create type estado_inscripcion as enum (
  'preinscrita',  -- reservo el cupo, todavia no pago
  'activa',       -- cursando
  'completada',   -- termino y aprobo
  'retirada',     -- se fue a mitad del curso
  'cancelada'     -- nunca llego a empezar
);


-- ----------------------------------------------------------------------------
-- 3 · Categorias
-- ----------------------------------------------------------------------------
-- Lista plana y corta -Idiomas, Informatica, Contabilidad- y no un arbol. Un
-- centro de cursos agrupa su catalogo para que se pueda filtrar, no para
-- reproducir un organigrama.

create table categorias (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  nombre          text        not null,
  descripcion     text,
  color           text,
  orden           smallint    not null default 0,
  activa          boolean     not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz,

  constraint categorias_tenant_uk unique (id, institucion_id),
  constraint categorias_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint categorias_color_valido check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

comment on table  categorias is 'Como agrupa la institucion su catalogo: Idiomas, Informatica, Oficios.';
comment on column categorias.color is 'Hex con almohadilla, para la tarjeta del catalogo. Opcional.';
comment on column categorias.orden is 'Posicion en los menus. Alfabetico rara vez es el orden que quiere el centro.';

-- lower() y no el texto tal cual: "Idiomas" e "idiomas" son la misma categoria
-- escrita por dos personas distintas.
create unique index categorias_nombre_uk
  on categorias (institucion_id, lower(nombre)) where eliminado_en is null;


-- ----------------------------------------------------------------------------
-- 4 · Cursos
-- ----------------------------------------------------------------------------
-- La pieza central. Todo lo que hace falta para anunciarlo, cotizarlo y
-- llenarlo esta en esta fila.

create table cursos (
  id                      uuid primary key default gen_random_uuid(),
  institucion_id          uuid        not null references instituciones (id) on delete cascade,
  codigo                  text        not null,
  nombre                  text        not null,
  resumen                 text,
  descripcion             text,
  categoria_id            uuid,
  instructor_membresia_id uuid,

  modalidad               modalidad_curso not null default 'presencial',
  nivel                   nivel_curso,
  sede_id                 uuid,
  aula                    text,
  enlace_virtual          text,
  imagen_url              text,

  precio                  numeric(12,2) not null default 0,
  moneda                  char(3)     not null default 'DOP',

  duracion_horas          numeric(6,2),
  duracion_semanas        smallint,
  inicia_en               date,
  termina_en              date,
  cupo                    smallint,

  requisitos              text,
  certificado             boolean     not null default true,
  estado                  estado_curso not null default 'borrador',

  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),
  eliminado_en            timestamptz,

  constraint cursos_tenant_uk unique (id, institucion_id),
  constraint cursos_categoria_fk
    foreign key (categoria_id, institucion_id)
    references categorias (id, institucion_id) on delete restrict,
  -- El instructor es una membresia con rol docente. set null y no restrict: si
  -- alguien deja la institucion, sus cursos se quedan sin instructor asignado,
  -- que es un problema visible y arreglable, no una fila imposible de borrar.
  constraint cursos_instructor_fk
    foreign key (instructor_membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete set null,
  constraint cursos_sede_fk
    foreign key (sede_id, institucion_id)
    references sedes (id, institucion_id) on delete restrict,

  constraint cursos_codigo_no_vacio check (length(btrim(codigo)) > 0),
  constraint cursos_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint cursos_precio_no_negativo check (precio >= 0),
  constraint cursos_moneda_valida check (moneda ~ '^[A-Z]{3}$'),
  constraint cursos_cupo_positivo check (cupo is null or cupo > 0),
  constraint cursos_horas_positivas check (duracion_horas is null or duracion_horas > 0),
  constraint cursos_semanas_positivas check (duracion_semanas is null or duracion_semanas > 0),
  constraint cursos_rango_fechas
    check (inicia_en is null or termina_en is null or termina_en >= inicia_en)
);

comment on table  cursos is 'La unidad que se anuncia, se cotiza y se cobra. Un curso, no una materia.';
comment on column cursos.codigo is 'Como lo nombra el centro: ING-101. Unico en la institucion; se ve en recibos y certificados.';
comment on column cursos.resumen is 'Una linea para la tarjeta del catalogo. La descripcion larga va aparte.';
comment on column cursos.precio is 'Numeric, nunca float: un centavo de redondeo binario es una discusion con un cliente.';
comment on column cursos.duracion_horas is 'Horas academicas totales. Es lo que se imprime en el certificado.';
comment on column cursos.cupo is 'Null es sin limite. Con limite, inscribir por encima se rechaza.';
comment on column cursos.imagen_url is 'URL de la portada. Todavia no hay modulo de subida: por ahora se pega la direccion.';
comment on column cursos.estado is 'En borrador no existe para nadie fuera de administracion.';

create unique index cursos_codigo_uk
  on cursos (institucion_id, upper(codigo)) where eliminado_en is null;
create index cursos_categoria_ix   on cursos (institucion_id, categoria_id);
create index cursos_instructor_ix  on cursos (institucion_id, instructor_membresia_id);
create index cursos_estado_ix      on cursos (institucion_id, estado) where eliminado_en is null;
create index cursos_inicio_ix      on cursos (institucion_id, inicia_en) where eliminado_en is null;


-- ----------------------------------------------------------------------------
-- 5 · Horario
-- ----------------------------------------------------------------------------
-- Una fila por bloque semanal: "lunes de 18:00 a 20:00". Guardarlo asi y no
-- como texto libre es lo que permite ordenar, detectar que dos cursos piden la
-- misma aula a la misma hora y pintar un calendario.

create table curso_horarios (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid     not null references instituciones (id) on delete cascade,
  curso_id        uuid     not null,
  dia_semana      smallint not null,
  hora_inicio     time     not null,
  hora_fin        time     not null,
  creado_en       timestamptz not null default now(),

  constraint curso_horarios_tenant_uk unique (id, institucion_id),
  constraint curso_horarios_curso_fk
    foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete cascade,
  constraint curso_horarios_dia_valido check (dia_semana between 1 and 7),
  constraint curso_horarios_rango check (hora_fin > hora_inicio)
);

comment on table  curso_horarios is 'Bloques semanales del curso. Una fila por dia que se imparte.';
comment on column curso_horarios.dia_semana is 'ISO-8601: 1 lunes ... 7 domingo. Igual que extract(isodow).';

create unique index curso_horarios_bloque_uk
  on curso_horarios (curso_id, dia_semana, hora_inicio);
create index curso_horarios_curso_ix on curso_horarios (institucion_id, curso_id);


-- ----------------------------------------------------------------------------
-- 6 · Participantes
-- ----------------------------------------------------------------------------
-- Uno a uno con la membresia, igual que antes el expediente del estudiante,
-- pero con lo que de verdad se le pregunta a un adulto que se apunta a un
-- curso. Fuera alergias, tipo de sangre, quien lo retira y colegio de
-- procedencia: eso era de un nino de primaria.

create table participantes (
  membresia_id     uuid primary key,
  institucion_id   uuid        not null references instituciones (id) on delete cascade,
  tipo_documento   tipo_documento not null default 'cedula',
  documento        text,
  fecha_nacimiento date,
  sexo             sexo_persona,
  telefono         text,
  direccion        text,
  ocupacion        text,
  empresa          text,
  como_nos_conocio text,
  notas            text,
  datos            jsonb       not null default '{}'::jsonb,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),

  constraint participantes_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint participantes_nacimiento_razonable
    check (fecha_nacimiento is null or fecha_nacimiento > date '1900-01-01')
);

comment on table  participantes is 'Ficha de quien toma cursos. La membresia dice que lo es; esto dice quien es.';
comment on column participantes.como_nos_conocio is 'De donde vino el alumno. Suele ser la unica metrica de marketing que lleva un centro pequeno.';
comment on column participantes.datos is 'Campos que pide un centro concreto y no justifican una columna.';

-- La cedula identifica a la persona: no se repite dentro de la institucion. Es
-- lo que evita inscribir dos veces al mismo y acabar con dos matriculas.
create unique index participantes_documento_uk
  on participantes (institucion_id, documento) where documento is not null;


-- ----------------------------------------------------------------------------
-- 7 · Inscripcion
-- ----------------------------------------------------------------------------
-- El acto central del negocio: esta persona entra en este curso. De aqui
-- cuelgan el cobro y, al terminar, el certificado.

create table inscripciones (
  id                     uuid primary key default gen_random_uuid(),
  institucion_id         uuid        not null references instituciones (id) on delete cascade,
  curso_id               uuid        not null,
  membresia_id           uuid        not null,
  estado                 estado_inscripcion not null default 'activa',
  inscrito_en            date        not null default current_date,

  -- Copia del precio del curso en el momento de inscribir, no referencia. Que
  -- el centro suba la tarifa manana no puede reescribir lo que se cobro hoy.
  precio                 numeric(12,2) not null default 0,
  descuento              numeric(12,2) not null default 0,

  completado_en          date,
  calificacion           numeric(5,2),
  certificado_emitido_en date,
  retirado_en            date,
  motivo_retiro          text,
  observaciones          text,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),

  constraint inscripciones_tenant_uk unique (id, institucion_id),
  constraint inscripciones_curso_fk
    foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete restrict,
  constraint inscripciones_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint inscripciones_precio_no_negativo check (precio >= 0),
  constraint inscripciones_descuento_valido check (descuento >= 0 and descuento <= precio),
  constraint inscripciones_calificacion_valida
    check (calificacion is null or calificacion between 0 and 100)
);

comment on table  inscripciones is 'Una persona en un curso. De aqui cuelgan el cobro y el certificado.';
comment on column inscripciones.precio is 'Lo que costaba el curso ese dia. Congelado a proposito.';
comment on column inscripciones.descuento is 'Beca, promocion o acuerdo. Aparte, para que el precio de lista siga a la vista.';

-- Una persona no se inscribe dos veces en el mismo curso. Si se retiro y
-- vuelve, se reactiva esta fila: dos filas serian dos cobros.
create unique index inscripciones_curso_persona_uk
  on inscripciones (curso_id, membresia_id);
create index inscripciones_curso_ix   on inscripciones (institucion_id, curso_id);
create index inscripciones_persona_ix on inscripciones (institucion_id, membresia_id);
create index inscripciones_estado_ix  on inscripciones (institucion_id, estado, inscrito_en);


-- ----------------------------------------------------------------------------
-- 8 · Cobro
-- ----------------------------------------------------------------------------
-- Se rehacen las dos tablas porque colgaban de la inscripcion escolar, pero la
-- forma es la misma y por las mismas razones: el sistema REGISTRA dinero, no lo
-- procesa; los montos son numeric; y un pago se anula, nunca se borra.
--
-- Desaparece conceptos_cobro. Existia para generar diez mensualidades desde una
-- plantilla anual; aqui el importe es el precio del curso menos el descuento, y
-- cualquier extra -material, repeticion de examen, certificado impreso- es un
-- cargo suelto con su descripcion.

create table cargos (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  inscripcion_id  uuid        not null,
  descripcion     text        not null,
  monto           numeric(12,2) not null,
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
  constraint cargos_monto_positivo check (monto >= 0),
  constraint cargos_descripcion_no_vacia check (length(btrim(descripcion)) > 0)
);

comment on table cargos is 'Lo que debe una inscripcion. El monto es copia, no referencia.';

create index cargos_inscripcion_ix on cargos (institucion_id, inscripcion_id);
create index cargos_pendientes_ix
  on cargos (institucion_id, estado, vence_en) where estado = 'pendiente';


create table pagos (
  id               uuid primary key default gen_random_uuid(),
  institucion_id   uuid        not null references instituciones (id) on delete cascade,
  cargo_id         uuid        not null,
  monto            numeric(12,2) not null,
  metodo           metodo_pago not null default 'efectivo',
  referencia       text,
  recibido_en      date        not null default current_date,
  registrado_por   uuid references usuarios (id) on delete set null,
  nota             text,
  anulado_en       timestamptz,
  motivo_anulacion text,
  creado_en        timestamptz not null default now(),

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
-- 9 · La fuga que dejo abierta la 0003
-- ----------------------------------------------------------------------------
-- contadores se creo con institucion_id y sin row level security. La
-- comprobacion final de la 0001 habria cazado eso, pero solo corre en la 0001.
--
-- Sin politicas, cualquier institucion podia leer el contador de matriculas de
-- otra -cuantos alumnos lleva la competencia- y, peor, incrementarlo. Es
-- exactamente el tipo de fallo que este diseno intenta hacer imposible: no
-- rompe nada, no da error, solo filtra en silencio.

alter table contadores enable row level security;
alter table contadores force  row level security;

create policy contadores_aislamiento on contadores
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());

create policy contadores_gestion on contadores
  for all to public
  using      (app.es_admin())
  with check (app.es_admin());

-- El modulo de identidad no emite matriculas: quien inscribe es administracion.
-- El grant sobraba y con RLS activo ya no serviria de nada.
revoke select on contadores from educa_auth;


-- ----------------------------------------------------------------------------
-- 10 · Disparadores
-- ----------------------------------------------------------------------------

do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'categorias', 'cursos', 'participantes', 'inscripciones', 'cargos'
  ]
  loop
    execute format(
      'create trigger %I_actualizado before update on %I
         for each row execute function app.tocar_actualizado_en()', t, t);
  end loop;

  foreach t in array array[
    'categorias', 'cursos', 'curso_horarios', 'participantes', 'inscripciones',
    'cargos', 'pagos'
  ]
  loop
    execute format(
      'create trigger %I_institucion_inmutable before update on %I
         for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;


-- ----------------------------------------------------------------------------
-- 11 · Row level security
-- ----------------------------------------------------------------------------
-- El mismo patron de las tres migraciones anteriores y por la misma razon: el
-- aislamiento entre instituciones lo hace Postgres, no la aplicacion. Ninguna
-- consulta del backend lleva "where institucion_id = ...".

-- El catalogo: lo lee cualquier miembro -para eso esta- y lo gestiona quien
-- administra.
do $bloque$
declare
  t text;
begin
  foreach t in array array['categorias', 'cursos', 'curso_horarios']
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
      create policy %1$I_lectura on %1$I
        for select to public
        using (app.es_miembro(institucion_id))
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


-- Lo administrativo: la ficha de un alumno, sus inscripciones y su cuenta solo
-- las ve administracion. El telefono y la direccion de alguien no son cosa de
-- sus companeros de clase.
do $bloque$
declare
  t text;
begin
  foreach t in array array['participantes', 'inscripciones', 'cargos', 'pagos']
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


-- Un instructor administra lo suyo sin ser administrador del centro: cambia el
-- estado de sus cursos y, mas adelante, califica en ellos. La politica se suma a
-- las de arriba; PostgreSQL une las permisivas con OR.
create policy cursos_gestion_instructor on cursos
  for update to public
  using      (instructor_membresia_id = app.mi_membresia())
  with check (instructor_membresia_id = app.mi_membresia());


-- Lo que cada quien tiene derecho a ver de si mismo, y el instructor de su
-- propia lista de clase.
create policy participantes_lectura_propia on participantes
  for select to public using (membresia_id = app.mi_membresia());

create policy inscripciones_lectura_propia on inscripciones
  for select to public
  using (
    membresia_id = app.mi_membresia()
    or curso_id in (
      select c.id from cursos c where c.instructor_membresia_id = app.mi_membresia()
    )
  );

-- La cuenta, en cambio, es solo suya: un instructor da clase, no cobra.
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
-- 12 · Permisos
-- ----------------------------------------------------------------------------

grant select, insert, update, delete on
  categorias, cursos, curso_horarios, participantes, inscripciones, cargos
  to educa_app;

-- Los pagos no se borran: se anulan. Quitarle el delete al rol de la aplicacion
-- hace que un error de programacion tampoco pueda hacer desaparecer un recibo.
grant select, insert, update on pagos to educa_app;


-- ----------------------------------------------------------------------------
-- 13 · Comprobacion
-- ----------------------------------------------------------------------------
-- La misma con la que termina la 0001, repetida aqui a proposito: es la que
-- habria cazado lo de contadores hace dos migraciones.

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
