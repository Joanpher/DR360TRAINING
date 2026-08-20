-- ============================================================================
-- 0002 · Estructura escolar
-- ----------------------------------------------------------------------------
-- La 0001 se escribió con vocabulario universitario: carreras, créditos,
-- cuatrimestres y un estudiante que elige asignaturas. Educa es para colegios,
-- y ahí nada de eso ocurre.
--
-- Las tres diferencias de fondo con una universidad, que son las que explican
-- todo lo que hay debajo:
--
--   1. El estudiante NO elige materias. Se inscribe en un grado y una sección,
--      y cursa las materias que ese grado tenga en su plan de estudio. Por eso
--      existe plan_estudio: es lo que permite que inscribir a alguien en 3ro A
--      lo deje matriculado en sus ocho materias sin tocarlas una por una.
--
--   2. El contenedor temporal es el año escolar (agosto a junio), no un
--      cuatrimestre. Dentro lleva períodos de calificación -cuatro, como pide
--      el MINERD- que son cortes de nota, no ventanas de inscripción.
--
--   3. Una sección pertenece a un año escolar. "3ro A" de 2026-2027 y "3ro A"
--      de 2027-2028 son dos grupos de personas distintas, no el mismo grupo en
--      dos momentos.
--
-- Se conserva intacto todo el núcleo multi-tenant de la 0001: instituciones,
-- usuarios, membresías, roles, sedes, unidades académicas, RLS y bitácora.
-- ============================================================================

set local search_path = public, pg_catalog;


-- ----------------------------------------------------------------------------
-- 1 · Tipos nuevos
-- ----------------------------------------------------------------------------

-- Cómo cobra y cómo inscribe una institución. 'colegio' es el flujo completo
-- (grados, secciones, inscripción anual, mensualidades). 'cursos' queda
-- declarado para la empresa que vende cursos sueltos: mismo esquema, sin
-- grados ni secciones y con cobro por curso. Todavía no se implementa, pero
-- estar en el tipo evita que mañana haya que migrar filas para distinguirlas.
create type modalidad_institucion as enum ('colegio', 'cursos');

create type nivel_escolar as enum ('inicial', 'primario', 'secundario');

create type estado_ano_escolar as enum ('planificado', 'activo', 'cerrado');

create type estado_curso as enum ('borrador', 'publicado', 'cerrado');


-- ----------------------------------------------------------------------------
-- 2 · Ajustes al núcleo
-- ----------------------------------------------------------------------------

alter table instituciones
  add column modalidad modalidad_institucion not null default 'colegio';

comment on column instituciones.modalidad is
  'colegio: inscripción anual por grado y sección. cursos: venta de cursos sueltos.';


-- Un niño de primaria no tiene correo, y su representante puede tener el suyo
-- propio en otra cuenta. La identidad del estudiante es su matrícula, no un
-- buzón que no existe.
--
-- No hace falta tocar usuarios_correo_valido: un CHECK con NULL da NULL, que
-- no es falso, así que la fila pasa. Y usuarios_correo_uk sigue sirviendo:
-- Postgres admite muchos NULL en un índice único.
alter table usuarios alter column correo drop not null;

comment on column usuarios.correo is
  'Null en estudiantes de colegio, que entran con matricula. Unico entre los que lo tienen.';


-- La matrícula es la credencial de acceso del estudiante y la plataforma vive
-- en un solo dominio para todas las instituciones, así que tiene que ser única
-- en toda la plataforma y no solo dentro del colegio.
--
-- La aplicación la genera con las siglas delante (LGL-2026-0001) y a partir de
-- ahí es una cadena opaca: al entrar se busca tal cual, nunca se parte para
-- deducir el colegio. Esa es la razón de que un colegio pueda cambiar sus
-- siglas sin invalidar las matrículas ya impresas en carnets y actas.
create unique index membresias_codigo_global_uk
  on membresias (codigo)
  where codigo is not null and eliminado_en is null;

comment on column membresias.codigo is
  'Matricula del estudiante o codigo de empleado, con las siglas delante. Unico en toda la plataforma: es credencial de acceso.';


-- ----------------------------------------------------------------------------
-- 3 · Fuera lo universitario
-- ----------------------------------------------------------------------------
-- Un colegio no tiene carreras. Lo que responde "qué estudia esta persona" es
-- su inscripción en un grado, que llega en la 0003.

alter table membresias  drop constraint membresias_programa_fk;
alter table membresias  drop column programa_id;
alter table invitaciones drop constraint invitaciones_programa_fk;
alter table invitaciones drop column programa_id;

drop table programas;
drop type nivel_programa;


-- ----------------------------------------------------------------------------
-- 4 · Año escolar
-- ----------------------------------------------------------------------------
-- periodos_academicos ya tenía la forma correcta -código, nombre, vigencia,
-- ventana de inscripción, estado y "cuál es el actual"-, así que se renombra en
-- vez de tirarse y rehacerse: renombrar conserva los datos, los índices y las
-- políticas de RLS ya creadas sobre la tabla.

alter table periodos_academicos rename to anos_escolares;

alter table anos_escolares rename constraint periodos_academicos_tenant_uk to anos_escolares_tenant_uk;
alter table anos_escolares rename constraint periodos_academicos_rango to anos_escolares_rango;
alter table anos_escolares rename constraint periodos_academicos_rango_inscripcion
  to anos_escolares_rango_inscripcion;

alter index periodos_academicos_codigo_uk    rename to anos_escolares_codigo_uk;
alter index periodos_academicos_actual_uk    rename to anos_escolares_actual_uk;
alter index periodos_academicos_vigencia_ix  rename to anos_escolares_vigencia_ix;

alter trigger periodos_academicos_actualizado on anos_escolares
  rename to anos_escolares_actualizado;
alter trigger periodos_academicos_institucion_inmutable on anos_escolares
  rename to anos_escolares_institucion_inmutable;

-- Las politicas sobreviven al renombrado de la tabla pero conservan su nombre
-- viejo. Renombrarlas no cambia nada de lo que hacen; evita que dentro de un
-- ano alguien lea "periodos_academicos_gestion" sobre anos_escolares y dude de
-- si esa politica es la que esta actuando.
alter policy periodos_academicos_aislamiento on anos_escolares rename to anos_escolares_aislamiento;
alter policy periodos_academicos_lectura     on anos_escolares rename to anos_escolares_lectura;
alter policy periodos_academicos_gestion     on anos_escolares rename to anos_escolares_gestion;

-- El estado deja de llamarse como un periodo universitario. Se cambia el tipo
-- de la columna con un cast explícito porque los valores coinciden uno a uno.
alter table anos_escolares
  alter column estado drop default,
  alter column estado type estado_ano_escolar using estado::text::estado_ano_escolar,
  alter column estado set default 'planificado';

drop type estado_periodo;

comment on table  anos_escolares is 'Ano lectivo, de agosto a junio. Todo lo academico cuelga de uno.';
comment on column anos_escolares.codigo is 'Como lo nombra el colegio: 2026-2027.';
comment on column anos_escolares.es_actual is
  'El ano que la plataforma muestra por defecto. Solo uno por institucion.';


-- Cortes de calificación dentro del año. El MINERD trabaja con cuatro; la
-- tabla no fija el número porque un colegio privado puede usar tres o dos.
create table periodos_calificacion (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  ano_escolar_id  uuid        not null,
  orden           smallint    not null,
  nombre          text        not null,
  inicio          date        not null,
  fin             date        not null,
  cerrado_en      timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint periodos_calificacion_tenant_uk unique (id, institucion_id),
  constraint periodos_calificacion_ano_fk
    foreign key (ano_escolar_id, institucion_id)
    references anos_escolares (id, institucion_id) on delete cascade,
  constraint periodos_calificacion_rango check (fin >= inicio),
  constraint periodos_calificacion_orden_valido check (orden between 1 and 8)
);

comment on table  periodos_calificacion is 'Cortes de nota dentro del ano escolar. Cuatro en el sistema del MINERD.';
comment on column periodos_calificacion.cerrado_en is
  'Una vez cerrado, las notas de ese corte no se editan.';

create unique index periodos_calificacion_orden_uk
  on periodos_calificacion (ano_escolar_id, orden);


-- ----------------------------------------------------------------------------
-- 5 · Grados y secciones
-- ----------------------------------------------------------------------------

-- El grado es el escalón: 3ro de Primaria. Existe una vez por colegio, no una
-- por año: lo que cambia cada año son las secciones y quién las cursa.
create table grados (
  id                  uuid        primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  nivel               nivel_escolar not null,
  orden               smallint    not null,
  nombre              text        not null,
  unidad_academica_id uuid,
  activo              boolean     not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  eliminado_en        timestamptz,

  constraint grados_tenant_uk unique (id, institucion_id),
  constraint grados_unidad_fk
    foreign key (unidad_academica_id, institucion_id)
    references unidades_academicas (id, institucion_id) on delete restrict,
  constraint grados_orden_valido check (orden between 1 and 12)
);

comment on table  grados is 'Escalon academico: 3ro de Primaria. Uno por colegio, no uno por ano.';
comment on column grados.orden is 'Posicion dentro del nivel. Ordena la lista y permite promover al siguiente.';

create unique index grados_nivel_orden_uk
  on grados (institucion_id, nivel, orden) where eliminado_en is null;


-- Una sección es un grupo concreto de un grado en un año: 3ro A de 2026-2027.
-- Pertenece al año escolar porque son personas distintas cada año.
create table secciones (
  id                  uuid        primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  ano_escolar_id      uuid        not null,
  grado_id            uuid        not null,
  nombre              text        not null,
  cupo                smallint,
  aula                text,
  sede_id             uuid,
  tutor_membresia_id  uuid,
  activa              boolean     not null default true,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  eliminado_en        timestamptz,

  constraint secciones_tenant_uk unique (id, institucion_id),
  constraint secciones_ano_fk
    foreign key (ano_escolar_id, institucion_id)
    references anos_escolares (id, institucion_id) on delete cascade,
  constraint secciones_grado_fk
    foreign key (grado_id, institucion_id)
    references grados (id, institucion_id) on delete restrict,
  constraint secciones_sede_fk
    foreign key (sede_id, institucion_id)
    references sedes (id, institucion_id) on delete restrict,
  constraint secciones_tutor_fk
    foreign key (tutor_membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete set null,
  constraint secciones_cupo_positivo check (cupo is null or cupo > 0)
);

comment on table  secciones is 'Grupo concreto de un grado en un ano: 3ro A de 2026-2027.';
comment on column secciones.tutor_membresia_id is 'Maestro guia del grupo. En primaria suele impartir casi todas las materias.';

create unique index secciones_nombre_uk
  on secciones (ano_escolar_id, grado_id, nombre) where eliminado_en is null;
create index secciones_ano_ix on secciones (institucion_id, ano_escolar_id);


-- ----------------------------------------------------------------------------
-- 6 · Materias y plan de estudio
-- ----------------------------------------------------------------------------

create table asignaturas (
  id              uuid        primary key default gen_random_uuid(),
  institucion_id  uuid        not null references instituciones (id) on delete cascade,
  codigo          text        not null,
  nombre          text        not null,
  area            text,
  activa          boolean     not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz,

  constraint asignaturas_tenant_uk unique (id, institucion_id),
  constraint asignaturas_codigo_no_vacio check (length(btrim(codigo)) > 0)
);

comment on table  asignaturas is 'Catalogo de materias del colegio: Matematica, Lengua Espanola.';
comment on column asignaturas.area is 'Area curricular del MINERD, para agrupar en reportes.';

create unique index asignaturas_codigo_uk
  on asignaturas (institucion_id, codigo) where eliminado_en is null;


-- Qué materias lleva cada grado. Es la pieza que hace que inscribir a alguien
-- en 3ro A lo deje matriculado en sus ocho materias: sin esta tabla habría que
-- decir a mano, por cada estudiante, qué cursa.
create table plan_estudio (
  institucion_id   uuid     not null references instituciones (id) on delete cascade,
  grado_id         uuid     not null,
  asignatura_id    uuid     not null,
  horas_semanales  smallint,
  orden            smallint not null default 0,
  creado_en        timestamptz not null default now(),

  primary key (grado_id, asignatura_id),
  constraint plan_estudio_grado_fk
    foreign key (grado_id, institucion_id)
    references grados (id, institucion_id) on delete cascade,
  constraint plan_estudio_asignatura_fk
    foreign key (asignatura_id, institucion_id)
    references asignaturas (id, institucion_id) on delete restrict,
  constraint plan_estudio_horas_positivas
    check (horas_semanales is null or horas_semanales > 0)
);

comment on table plan_estudio is 'Materias de cada grado. Al inscribir en una seccion, de aqui salen sus cursos.';

create index plan_estudio_asignatura_ix on plan_estudio (institucion_id, asignatura_id);


-- ----------------------------------------------------------------------------
-- 7 · Cursos
-- ----------------------------------------------------------------------------
-- Un curso es una materia impartida a una sección concreta por un docente:
-- "Matemática de 3ro A en 2026-2027". No es la materia (eso es asignaturas) ni
-- el grupo (eso es secciones): es el cruce, que es lo que tiene horario,
-- docente, contenidos y calificaciones.

create table cursos (
  id                  uuid        primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  ano_escolar_id      uuid        not null,
  seccion_id          uuid        not null,
  asignatura_id       uuid        not null,
  docente_membresia_id uuid,
  estado              estado_curso not null default 'borrador',
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  eliminado_en        timestamptz,

  constraint cursos_tenant_uk unique (id, institucion_id),
  constraint cursos_ano_fk
    foreign key (ano_escolar_id, institucion_id)
    references anos_escolares (id, institucion_id) on delete cascade,
  constraint cursos_seccion_fk
    foreign key (seccion_id, institucion_id)
    references secciones (id, institucion_id) on delete cascade,
  constraint cursos_asignatura_fk
    foreign key (asignatura_id, institucion_id)
    references asignaturas (id, institucion_id) on delete restrict,
  constraint cursos_docente_fk
    foreign key (docente_membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete set null
);

comment on table  cursos is 'Una materia impartida a una seccion en un ano: Matematica de 3ro A.';
comment on column cursos.docente_membresia_id is 'Null mientras no se asigne. Un curso sin docente no se publica.';

-- Una sección no puede tener la misma materia dos veces.
create unique index cursos_seccion_asignatura_uk
  on cursos (seccion_id, asignatura_id) where eliminado_en is null;
create index cursos_docente_ix on cursos (institucion_id, docente_membresia_id);
create index cursos_ano_ix on cursos (institucion_id, ano_escolar_id);


-- ----------------------------------------------------------------------------
-- 8 · Disparadores
-- ----------------------------------------------------------------------------

do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'periodos_calificacion', 'grados', 'secciones', 'asignaturas', 'cursos'
  ]
  loop
    execute format(
      'create trigger %I_actualizado before update on %I
         for each row execute function app.tocar_actualizado_en()', t, t);
  end loop;

  foreach t in array array[
    'periodos_calificacion', 'grados', 'secciones', 'asignaturas',
    'plan_estudio', 'cursos'
  ]
  loop
    execute format(
      'create trigger %I_institucion_inmutable before update on %I
         for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;


-- ----------------------------------------------------------------------------
-- 9 · Row level security
-- ----------------------------------------------------------------------------
-- El mismo patrón de la 0001 y por la misma razón: el aislamiento entre
-- colegios no lo hace la aplicación, lo hace Postgres. Ninguna consulta del
-- backend lleva "where institucion_id = ...".
--
-- Leer lo puede cualquier miembro: un estudiante necesita ver su sección y sus
-- materias. Escribir, solo quien administra.

do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'periodos_calificacion', 'grados', 'secciones', 'asignaturas',
    'plan_estudio', 'cursos'
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


-- Un docente administra lo suyo sin ser administrador del colegio: puede
-- cambiar el estado de sus cursos y, más adelante, calificar en ellos. La
-- política se suma a las de arriba; PostgreSQL une las permisivas con OR.
create policy cursos_gestion_docente on cursos
  for update to public
  using (
    docente_membresia_id in (
      select m.id from membresias m
       where m.usuario_id = app.usuario_actual()
         and m.institucion_id = app.institucion_actual()
         and m.estado = 'activa'
         and m.eliminado_en is null
    )
  )
  with check (
    docente_membresia_id in (
      select m.id from membresias m
       where m.usuario_id = app.usuario_actual()
         and m.institucion_id = app.institucion_actual()
         and m.estado = 'activa'
         and m.eliminado_en is null
    )
  );


-- ----------------------------------------------------------------------------
-- 10 · Permisos
-- ----------------------------------------------------------------------------

grant select, insert, update, delete on
  periodos_calificacion, grados, secciones, asignaturas, plan_estudio, cursos
  to educa_app;

-- educa_auth necesita leer la matrícula para resolver el acceso del estudiante,
-- y ya tenía select sobre membresias en la 0001. No se le da nada más: el
-- módulo de identidad no toca la estructura académica.
