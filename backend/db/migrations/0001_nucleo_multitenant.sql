-- ============================================================================
-- 0001 · Nucleo multi-tenant e identidad
-- Base de datos: educa · PostgreSQL 14+
-- ----------------------------------------------------------------------------
-- Modelo de tenancy: esquema compartido con institucion_id en cada tabla y
-- aislamiento impuesto por Row Level Security. La aplicacion NUNCA filtra por
-- institucion a mano: abre la transaccion, fija el contexto y la base de datos
-- se encarga del resto.
--
--   begin;
--   select set_config('app.usuario_id',    $1, true);
--   select set_config('app.institucion_id', $2, true);
--   ...  -- consultas del request
--   commit;
--
-- El tercer parametro de set_config en true hace la variable local a la
-- transaccion: al terminar, el contexto muere con ella y no contamina la
-- siguiente peticion que reutilice esa conexion del pool.
--
-- Dos roles de conexion, dos niveles de privilegio:
--   educa_app   todo el trafico de negocio, siempre con contexto fijado.
--   educa_auth  solo el modulo de autenticacion (login, registro, refresco,
--               reseteo, aceptar invitacion): son los flujos que ocurren ANTES
--               de que exista un usuario o una institucion en el contexto.
--
-- Invariante importante sobre FORCE ROW LEVEL SECURITY:
-- FORCE solo cambia una cosa: que el dueno de la tabla tambien quede sujeto a
-- las politicas. Los roles de la aplicacion nunca son duenos, asi que FORCE es
-- una segunda linea de defensa frente a una conexion con el usuario maestro.
--
-- Queda desactivado justo en las tablas que tocan las funciones SECURITY
-- DEFINER, porque esas funciones corren como dueno:
--   usuarios, membresias, membresia_roles  las leen app.es_miembro,
--     app.tiene_rol y app.es_superadmin; con FORCE, evaluar una politica
--     invocaria a la funcion que evalua esa misma politica: recursion infinita.
--   instituciones, auditoria.eventos       las escribe app.crear_institucion,
--     que existe precisamente para resolver el problema del huevo y la gallina
--     de crear un tenant cuando todavia no hay contexto.
-- Las ocho tablas restantes si llevan FORCE.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 · Esquemas y extensiones
-- ----------------------------------------------------------------------------

create schema if not exists app;
create schema if not exists auditoria;

comment on schema app is 'Contexto de la peticion, funciones de RLS y utilidades internas.';
comment on schema auditoria is 'Bitacora append-only de acciones sensibles.';

create extension if not exists citext;      -- correos y slugs sin distinguir mayusculas
create extension if not exists pgcrypto;    -- gen_random_uuid, gen_random_bytes


-- ----------------------------------------------------------------------------
-- 2 · Roles de conexion
-- ----------------------------------------------------------------------------
-- Se crean sin contrasena: no pueden autenticarse hasta que se les asigne una.
-- Tras aplicar la migracion, ejecutar como usuario maestro:
--   alter role educa_app  with password '...';
--   alter role educa_auth with password '...';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'educa_app') then
    create role educa_app with login nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'educa_auth') then
    create role educa_auth with login nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end
$$;

-- educa_app  : trafico de negocio, sujeto a RLS, exige contexto de usuario e institucion.
-- educa_auth : modulo de autenticacion, acceso acotado a identidad, sin contexto previo.
-- (comment on role exige superusuario, que RDS no concede; queda documentado aqui.)

-- El esquema public deja de ser tierra de nadie.
revoke create on schema public from public;


-- ----------------------------------------------------------------------------
-- 3 · Tipos
-- ----------------------------------------------------------------------------

create type tipo_institucion as enum (
  'universidad', 'instituto', 'colegio', 'academia', 'corporativa'
);

create type estado_institucion as enum (
  'en_onboarding',  -- creada, todavia sin configurar
  'activa',
  'suspendida',     -- por falta de pago o decision administrativa
  'archivada'
);

create type estado_usuario as enum (
  'invitado',   -- existe la cuenta pero nunca ha entrado
  'activo',
  'suspendido',
  'bloqueado'   -- bloqueo por seguridad, no por decision administrativa
);

create type rol_institucional as enum (
  'propietario',   -- creo la institucion; no se le puede quitar el rol
  'administrador',
  'coordinador',   -- gestiona programas y cursos de su unidad academica
  'docente',
  'estudiante',
  'invitado'       -- lectura acotada: auditor externo, aspirante, acudiente
);

create type estado_membresia as enum (
  'invitada', 'activa', 'suspendida', 'retirada', 'egresada'
);

create type estado_invitacion as enum (
  'pendiente', 'aceptada', 'revocada', 'expirada'
);

create type estado_periodo as enum (
  'planificado', 'activo', 'cerrado'
);

create type tipo_unidad_academica as enum (
  'facultad', 'escuela', 'departamento', 'area'
);

create type nivel_programa as enum (
  'tecnico', 'grado', 'especialidad', 'maestria', 'doctorado', 'diplomado'
);

create type tipo_token as enum (
  'verificacion_correo', 'reseteo_contrasena', 'cambio_correo'
);


-- ----------------------------------------------------------------------------
-- 4 · Identidad global
-- ----------------------------------------------------------------------------
-- usuarios vive por encima del tenancy: una misma persona puede ser docente en
-- una universidad y estudiante en otra con una sola credencial. Todo lo que
-- depende de la institucion (rol, matricula, carrera) vive en membresias.

create table usuarios (
  id                    uuid primary key default gen_random_uuid(),
  correo                citext      not null,
  correo_verificado_en  timestamptz,
  hash_contrasena       text,                       -- null si la cuenta solo entra por SSO
  nombres               text        not null,
  apellidos             text        not null,
  nombre_completo       text        generated always as (nombres || ' ' || apellidos) stored,
  telefono              text,
  avatar_url            text,
  idioma                char(2)     not null default 'es',
  zona_horaria          text,
  estado                estado_usuario not null default 'invitado',
  es_superadmin         boolean     not null default false,
  intentos_fallidos     smallint    not null default 0,
  bloqueado_hasta       timestamptz,
  ultimo_acceso_en      timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  eliminado_en          timestamptz,

  constraint usuarios_correo_valido
    check (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  constraint usuarios_nombres_no_vacios
    check (length(btrim(nombres)) > 0 and length(btrim(apellidos)) > 0),
  constraint usuarios_intentos_no_negativos
    check (intentos_fallidos >= 0)
);

comment on table  usuarios is 'Identidad global de la plataforma, compartida entre instituciones.';
comment on column usuarios.es_superadmin is 'Personal de la plataforma. Atraviesa el aislamiento por institucion; se asigna a mano.';
comment on column usuarios.hash_contrasena is 'Hash con sal calculado en la aplicacion (scrypt). La base de datos nunca ve la contrasena.';
comment on column usuarios.eliminado_en is 'Borrado logico. Las claves unicas solo aplican a filas vivas.';

create unique index usuarios_correo_uk on usuarios (correo) where eliminado_en is null;
create index usuarios_superadmin_ix on usuarios (id) where es_superadmin;


-- ----------------------------------------------------------------------------
-- 5 · Institucion: la raiz del tenancy
-- ----------------------------------------------------------------------------

create table instituciones (
  id              uuid primary key default gen_random_uuid(),
  slug            citext      not null,             -- subdominio: uce.educa.do
  nombre          text        not null,
  siglas          text,
  tipo            tipo_institucion   not null default 'universidad',
  estado          estado_institucion not null default 'en_onboarding',
  pais            char(2)     not null default 'DO',
  zona_horaria    text        not null default 'America/Santo_Domingo',
  idioma          char(2)     not null default 'es',
  correo_soporte  citext,
  sitio_web       text,
  marca           jsonb       not null default '{}'::jsonb,   -- logo, colores, tipografia
  configuracion   jsonb       not null default '{}'::jsonb,   -- banderas y preferencias
  creada_por      uuid references usuarios (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  eliminado_en    timestamptz,

  constraint instituciones_slug_valido
    check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})?[a-z0-9]$'),
  constraint instituciones_pais_valido
    check (pais ~ '^[A-Z]{2}$'),
  constraint instituciones_nombre_no_vacio
    check (length(btrim(nombre)) > 0)
);

comment on table  instituciones is 'Tenant raiz. Cada fila del sistema cuelga de una institucion.';
comment on column instituciones.slug is 'Identificador publico y estable: subdominio y rutas. No se reutiliza.';
comment on column instituciones.marca is 'Personalizacion visual: {logo_url, color_primario, ...}.';

create unique index instituciones_slug_uk on instituciones (slug) where eliminado_en is null;
create index instituciones_estado_ix on instituciones (estado) where eliminado_en is null;


-- Dominios de correo que pertenecen a la institucion. Sirven para dirigir un
-- correo al tenant correcto en el login y para autoafiliar altas verificadas.
create table dominios_institucion (
  id             uuid primary key default gen_random_uuid(),
  institucion_id uuid        not null references instituciones (id) on delete cascade,
  dominio        citext      not null,
  autoafiliar    boolean     not null default false,
  rol_por_defecto rol_institucional not null default 'estudiante',
  verificado_en  timestamptz,
  creado_en      timestamptz not null default now(),

  constraint dominios_institucion_valido check (dominio ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);

comment on column dominios_institucion.autoafiliar is
  'Si esta activo, quien verifique un correo de este dominio entra a la institucion con rol_por_defecto.';

-- Global: un dominio no puede pertenecer a dos instituciones.
create unique index dominios_institucion_uk on dominios_institucion (dominio);
create index dominios_institucion_ix on dominios_institucion (institucion_id);


-- ----------------------------------------------------------------------------
-- 6 · Estructura de la institucion
-- ----------------------------------------------------------------------------
-- Cada tabla lleva unique (id, institucion_id) aunque id ya sea la clave
-- primaria. No es redundancia decorativa: permite que las claves foraneas entre
-- tablas del mismo tenant sean compuestas, de modo que la base de datos rechaza
-- por si sola una referencia que cruce instituciones. RLS protege la lectura;
-- esto protege la integridad.

create table sedes (
  id             uuid primary key default gen_random_uuid(),
  institucion_id uuid        not null references instituciones (id) on delete cascade,
  codigo         text        not null,
  nombre         text        not null,
  direccion      text,
  ciudad         text,
  es_principal   boolean     not null default false,
  activa         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en   timestamptz,

  constraint sedes_tenant_uk unique (id, institucion_id),
  constraint sedes_codigo_no_vacio check (length(btrim(codigo)) > 0)
);

comment on table sedes is 'Campus o recintos fisicos de la institucion.';

create unique index sedes_codigo_uk on sedes (institucion_id, codigo) where eliminado_en is null;
create unique index sedes_principal_uk on sedes (institucion_id) where es_principal and eliminado_en is null;


-- Facultades, escuelas, departamentos y areas. Una sola tabla jerarquica:
-- el organigrama academico cambia de nombre en cada institucion, pero la forma
-- (un arbol de unidades) es siempre la misma.
create table unidades_academicas (
  id             uuid primary key default gen_random_uuid(),
  institucion_id uuid        not null references instituciones (id) on delete cascade,
  padre_id       uuid,
  sede_id        uuid,
  tipo           tipo_unidad_academica not null default 'facultad',
  codigo         text        not null,
  nombre         text        not null,
  activa         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en   timestamptz,

  constraint unidades_academicas_tenant_uk unique (id, institucion_id),
  -- restrict y no set null: la columna institucion_id de la clave compuesta es
  -- not null, asi que un set null la dejaria invalida. El borrado real aqui es
  -- logico (eliminado_en), no fisico.
  constraint unidades_academicas_padre_fk
    foreign key (padre_id, institucion_id)
    references unidades_academicas (id, institucion_id) on delete restrict,
  constraint unidades_academicas_sede_fk
    foreign key (sede_id, institucion_id)
    references sedes (id, institucion_id) on delete restrict,
  constraint unidades_academicas_sin_ciclo_directo check (padre_id is distinct from id)
);

comment on table unidades_academicas is 'Organigrama academico jerarquico: facultad -> escuela -> departamento.';

create unique index unidades_academicas_codigo_uk
  on unidades_academicas (institucion_id, codigo) where eliminado_en is null;
create index unidades_academicas_padre_ix on unidades_academicas (institucion_id, padre_id);


-- Carreras y programas academicos.
create table programas (
  id                   uuid primary key default gen_random_uuid(),
  institucion_id       uuid        not null references instituciones (id) on delete cascade,
  unidad_academica_id  uuid,
  codigo               text        not null,
  nombre               text        not null,
  nivel                nivel_programa not null default 'grado',
  creditos_totales     smallint,
  duracion_periodos    smallint,
  activo               boolean     not null default true,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  eliminado_en         timestamptz,

  constraint programas_tenant_uk unique (id, institucion_id),
  constraint programas_unidad_fk
    foreign key (unidad_academica_id, institucion_id)
    references unidades_academicas (id, institucion_id) on delete restrict,
  constraint programas_creditos_positivos
    check (creditos_totales is null or creditos_totales > 0),
  constraint programas_duracion_positiva
    check (duracion_periodos is null or duracion_periodos > 0)
);

comment on table programas is 'Carreras. En 002 cuelgan de aqui el pensum y los cursos.';

create unique index programas_codigo_uk on programas (institucion_id, codigo) where eliminado_en is null;
create index programas_unidad_ix on programas (institucion_id, unidad_academica_id);


-- Periodos academicos: semestres, cuatrimestres o trimestres segun la institucion.
create table periodos_academicos (
  id                 uuid primary key default gen_random_uuid(),
  institucion_id     uuid        not null references instituciones (id) on delete cascade,
  codigo             text        not null,          -- '2026-2'
  nombre             text        not null,          -- 'Segundo semestre 2026'
  inicio             date        not null,
  fin                date        not null,
  inicio_inscripcion date,
  fin_inscripcion    date,
  estado             estado_periodo not null default 'planificado',
  es_actual          boolean     not null default false,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),

  constraint periodos_academicos_tenant_uk unique (id, institucion_id),
  constraint periodos_academicos_rango check (fin > inicio),
  constraint periodos_academicos_rango_inscripcion
    check (fin_inscripcion is null or inicio_inscripcion is null or fin_inscripcion >= inicio_inscripcion)
);

comment on column periodos_academicos.es_actual is
  'El periodo que la interfaz muestra por defecto. Solo uno por institucion.';

create unique index periodos_academicos_codigo_uk on periodos_academicos (institucion_id, codigo);
create unique index periodos_academicos_actual_uk on periodos_academicos (institucion_id) where es_actual;
create index periodos_academicos_vigencia_ix on periodos_academicos (institucion_id, inicio, fin);


-- ----------------------------------------------------------------------------
-- 7 · Membresias: la persona dentro de la institucion
-- ----------------------------------------------------------------------------
-- membresias responde "quien es esta persona aqui" (matricula, carrera, estado)
-- y membresia_roles responde "que puede hacer". Van separadas porque una misma
-- persona puede ser docente de una asignatura y estudiante de una maestria en
-- la misma institucion: los roles son varios, el perfil es uno.

create table membresias (
  id             uuid primary key default gen_random_uuid(),
  institucion_id uuid        not null references instituciones (id) on delete cascade,
  usuario_id     uuid        not null references usuarios (id) on delete cascade,
  codigo         text,
  estado         estado_membresia not null default 'invitada',
  programa_id    uuid,
  sede_id        uuid,
  unidad_academica_id uuid,
  ingreso_en     date,
  datos          jsonb       not null default '{}'::jsonb,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  eliminado_en   timestamptz,

  constraint membresias_tenant_uk unique (id, institucion_id),
  constraint membresias_programa_fk
    foreign key (programa_id, institucion_id)
    references programas (id, institucion_id) on delete restrict,
  constraint membresias_sede_fk
    foreign key (sede_id, institucion_id)
    references sedes (id, institucion_id) on delete restrict,
  constraint membresias_unidad_fk
    foreign key (unidad_academica_id, institucion_id)
    references unidades_academicas (id, institucion_id) on delete restrict
);

comment on table  membresias is 'Perfil de un usuario dentro de una institucion. Define el tenancy de las personas.';
comment on column membresias.codigo is 'Matricula (2023-3970) o codigo de empleado. Unico dentro de la institucion.';
comment on column membresias.datos is 'Campos propios de cada institucion que no justifican una columna.';

create unique index membresias_usuario_uk
  on membresias (institucion_id, usuario_id) where eliminado_en is null;
create unique index membresias_codigo_uk
  on membresias (institucion_id, codigo) where codigo is not null and eliminado_en is null;
create index membresias_usuario_ix on membresias (usuario_id) where eliminado_en is null;
create index membresias_programa_ix on membresias (institucion_id, programa_id);


create table membresia_roles (
  membresia_id   uuid        not null,
  institucion_id uuid        not null,
  rol            rol_institucional not null,
  asignado_por   uuid references usuarios (id) on delete set null,
  asignado_en    timestamptz not null default now(),

  primary key (membresia_id, rol),
  constraint membresia_roles_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade
);

comment on table  membresia_roles is 'Roles de una membresia. Varios por persona: docente y estudiante a la vez es normal.';
comment on column membresia_roles.institucion_id is 'Denormalizado desde membresias para que RLS filtre sin un join.';

create index membresia_roles_institucion_ix on membresia_roles (institucion_id, rol);


-- ----------------------------------------------------------------------------
-- 8 · Invitaciones
-- ----------------------------------------------------------------------------
-- Camino normal de alta: la institucion invita, la persona acepta. La cuenta de
-- usuario puede existir ya, si la persona pertenece a otra institucion, o
-- crearse en el mismo acto de aceptar.

create table invitaciones (
  id             uuid primary key default gen_random_uuid(),
  institucion_id uuid        not null references instituciones (id) on delete cascade,
  correo         citext      not null,
  roles          rol_institucional[] not null,
  codigo         text,
  programa_id    uuid,
  hash_token     text        not null,
  estado         estado_invitacion not null default 'pendiente',
  mensaje        text,
  invitada_por   uuid references usuarios (id) on delete set null,
  expira_en      timestamptz not null default now() + interval '7 days',
  aceptada_en    timestamptz,
  aceptada_por   uuid references usuarios (id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint invitaciones_programa_fk
    foreign key (programa_id, institucion_id)
    references programas (id, institucion_id) on delete restrict,
  constraint invitaciones_con_rol check (array_length(roles, 1) >= 1),
  constraint invitaciones_correo_valido
    check (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$')
);

comment on column invitaciones.hash_token is
  'Solo el hash. El token en claro viaja al correo y nunca se guarda: robar la tabla no permite aceptar invitaciones.';
comment on column invitaciones.codigo is 'Matricula preasignada, si la institucion ya la tenia definida.';

create unique index invitaciones_hash_uk on invitaciones (hash_token);
create unique index invitaciones_pendiente_uk
  on invitaciones (institucion_id, correo) where estado = 'pendiente';
create index invitaciones_correo_ix on invitaciones (correo) where estado = 'pendiente';


-- ----------------------------------------------------------------------------
-- 9 · Sesiones y tokens de un solo uso
-- ----------------------------------------------------------------------------

create table sesiones (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid        not null references usuarios (id) on delete cascade,
  institucion_id uuid references instituciones (id) on delete cascade,
  hash_refresco  text        not null,
  ip             inet,
  agente         text,
  creado_en      timestamptz not null default now(),
  ultimo_uso_en  timestamptz not null default now(),
  expira_en      timestamptz not null,
  revocada_en    timestamptz,
  motivo_revocacion text
);

comment on table  sesiones is 'Una fila por refresh token vivo. El access token es un JWT corto y no se guarda.';
comment on column sesiones.institucion_id is 'Institucion activa de la sesion. Null mientras el usuario no ha elegido una.';

create unique index sesiones_hash_uk on sesiones (hash_refresco);
create index sesiones_usuario_ix on sesiones (usuario_id) where revocada_en is null;
create index sesiones_expiracion_ix on sesiones (expira_en) where revocada_en is null;


create table tokens_verificacion (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid        not null references usuarios (id) on delete cascade,
  tipo        tipo_token  not null,
  hash_token  text        not null,
  datos       jsonb       not null default '{}'::jsonb,
  expira_en   timestamptz not null,
  usado_en    timestamptz,
  ip          inet,
  creado_en   timestamptz not null default now()
);

comment on table  tokens_verificacion is 'Verificacion de correo, reseteo de contrasena y cambio de correo. Un solo uso.';
comment on column tokens_verificacion.datos is 'Carga util del token: en cambio_correo, el correo nuevo pendiente de confirmar.';

create unique index tokens_verificacion_hash_uk on tokens_verificacion (hash_token);
create index tokens_verificacion_usuario_ix
  on tokens_verificacion (usuario_id, tipo) where usado_en is null;


-- ----------------------------------------------------------------------------
-- 10 · Bitacora
-- ----------------------------------------------------------------------------
-- Sin claves foraneas a proposito: la bitacora debe sobrevivir al borrado de lo
-- que describe. Sin politicas de update ni delete: es append-only.

create table auditoria.eventos (
  id             bigint generated always as identity primary key,
  institucion_id uuid,
  actor_id       uuid,
  accion         text        not null,
  entidad        text,
  entidad_id     uuid,
  datos          jsonb       not null default '{}'::jsonb,
  ip             inet,
  agente         text,
  creado_en      timestamptz not null default now()
);

comment on table  auditoria.eventos is 'Bitacora append-only. Sin claves foraneas: sobrevive al borrado de lo que describe.';
comment on column auditoria.eventos.accion is 'Verbo en pasado con espacio de nombres: institucion.creada, membresia.rol_asignado.';

create index eventos_institucion_ix on auditoria.eventos (institucion_id, creado_en desc);
create index eventos_actor_ix on auditoria.eventos (actor_id, creado_en desc);
create index eventos_entidad_ix on auditoria.eventos (entidad, entidad_id);


-- ----------------------------------------------------------------------------
-- 11 · Contexto de la peticion
-- ----------------------------------------------------------------------------
-- Estas dos funciones son la unica puerta por la que las politicas conocen
-- quien pregunta. Devuelven null si la variable no esta fijada, y una politica
-- que compara contra null nunca deja pasar nada: sin contexto no hay datos.

create function app.usuario_actual() returns uuid
  language sql stable parallel safe
  set search_path = pg_catalog
as $fn$
  select nullif(current_setting('app.usuario_id', true), '')::uuid
$fn$;

create function app.institucion_actual() returns uuid
  language sql stable parallel safe
  set search_path = pg_catalog
as $fn$
  select nullif(current_setting('app.institucion_id', true), '')::uuid
$fn$;

comment on function app.usuario_actual() is
  'Usuario de la peticion. La aplicacion lo fija con set_config(..., true) al abrir la transaccion.';
comment on function app.institucion_actual() is
  'Institucion activa de la peticion. Null antes de elegir tenant: las politicas de negocio no devuelven nada.';


create function app.es_rol_auth() returns boolean
  language sql stable parallel safe
  set search_path = pg_catalog
as $fn$
  select current_user = 'educa_auth'
$fn$;

comment on function app.es_rol_auth() is
  'Cierto solo si la conexion es la del modulo de autenticacion. Habilita los flujos previos al contexto.';


-- Las cuatro siguientes son SECURITY DEFINER porque consultan las mismas tablas
-- que protegen. Corren como dueno de las tablas, que esta exento de RLS en
-- usuarios, membresias y membresia_roles (ver la nota de la cabecera).

create function app.es_superadmin() returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select coalesce(
    (select u.es_superadmin
       from usuarios u
      where u.id = app.usuario_actual()
        and u.eliminado_en is null),
    false)
$fn$;

create function app.es_miembro(p_institucion uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select exists (
    select 1
      from membresias m
     where m.institucion_id = p_institucion
       and m.usuario_id = app.usuario_actual()
       and m.estado = 'activa'
       and m.eliminado_en is null
  ) or app.es_superadmin()
$fn$;

create function app.tiene_rol(variadic p_roles rol_institucional[]) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select exists (
    select 1
      from membresias m
      join membresia_roles r on r.membresia_id = m.id
     where m.usuario_id = app.usuario_actual()
       and m.institucion_id = app.institucion_actual()
       and m.estado = 'activa'
       and m.eliminado_en is null
       and r.rol = any (p_roles)
  )
$fn$;

create function app.es_admin() returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select app.tiene_rol('propietario'::rol_institucional, 'administrador'::rol_institucional)
      or app.es_superadmin()
$fn$;

-- Al entrar, antes de elegir institucion, hay que poder listar "mis
-- instituciones y que soy en cada una". Sin esto, membresia_roles quedaria
-- ilegible mientras no haya institucion en el contexto.
create function app.es_membresia_propia(p_membresia uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select exists (
    select 1
      from membresias m
     where m.id = p_membresia
       and m.usuario_id = app.usuario_actual()
       and m.eliminado_en is null
  )
$fn$;

create function app.comparte_institucion(p_usuario uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select exists (
    select 1
      from membresias yo
      join membresias otro on otro.institucion_id = yo.institucion_id
     where yo.usuario_id = app.usuario_actual()
       and yo.eliminado_en is null
       and otro.usuario_id = p_usuario
       and otro.eliminado_en is null
  )
$fn$;

comment on function app.es_miembro(uuid) is 'Pertenencia activa a una institucion. Un superadmin pertenece a todas.';
comment on function app.tiene_rol(rol_institucional[]) is 'Cierto si el usuario tiene alguno de esos roles en la institucion del contexto.';
comment on function app.comparte_institucion(uuid) is 'Cierto si ambos usuarios coinciden en al menos una institucion. Base de la visibilidad del directorio.';


-- ----------------------------------------------------------------------------
-- 12 · Disparadores
-- ----------------------------------------------------------------------------

create function app.tocar_actualizado_en() returns trigger
  language plpgsql
  set search_path = pg_catalog
as $fn$
begin
  new.actualizado_en := now();
  return new;
end
$fn$;

-- Una fila no cambia de institucion jamas. Si hiciera falta mover algo entre
-- tenants seria una operacion explicita, no un update suelto.
create function app.institucion_inmutable() returns trigger
  language plpgsql
  set search_path = pg_catalog
as $fn$
begin
  if new.institucion_id is distinct from old.institucion_id then
    raise exception 'no se puede mover una fila de % entre instituciones', tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$fn$;

-- Una institucion sin propietario queda sin nadie que pueda administrarla.
create function app.proteger_ultimo_propietario() returns trigger
  language plpgsql
  set search_path = public, pg_catalog
as $fn$
begin
  if old.rol <> 'propietario' then
    return old;
  end if;

  -- Durante el borrado en cascada de una institucion la fila padre ya no esta:
  -- ahi no hay nada que proteger.
  if not exists (select 1 from instituciones i
                  where i.id = old.institucion_id and i.eliminado_en is null) then
    return old;
  end if;

  if not exists (
    select 1
      from membresia_roles r
      join membresias m on m.id = r.membresia_id
     where r.institucion_id = old.institucion_id
       and r.rol = 'propietario'
       and r.membresia_id <> old.membresia_id
       and m.estado = 'activa'
       and m.eliminado_en is null
  ) then
    raise exception 'la institucion quedaria sin propietario'
      using errcode = 'restrict_violation',
            hint = 'Asigna el rol propietario a otra membresia antes de retirar este.';
  end if;

  return old;
end
$fn$;


do $bloque$
declare
  t text;
begin
  -- actualizado_en se mantiene solo; ninguna consulta de la aplicacion lo escribe
  foreach t in array array[
    'usuarios', 'instituciones', 'sedes', 'unidades_academicas', 'programas',
    'periodos_academicos', 'membresias', 'invitaciones'
  ]
  loop
    execute format(
      'create trigger %I_actualizado before update on %I
         for each row execute function app.tocar_actualizado_en()', t, t);
  end loop;

  foreach t in array array[
    'dominios_institucion', 'sedes', 'unidades_academicas', 'programas',
    'periodos_academicos', 'membresias', 'membresia_roles', 'invitaciones'
  ]
  loop
    execute format(
      'create trigger %I_institucion_inmutable before update on %I
         for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;

create trigger membresia_roles_ultimo_propietario
  before delete on membresia_roles
  for each row execute function app.proteger_ultimo_propietario();


-- ============================================================================
-- 13 · Row Level Security
-- ----------------------------------------------------------------------------
-- Dos capas que se combinan como (permisiva or permisiva) and (restrictiva):
--
--   restrictiva  el cerco del tenant. Se aplica a toda operacion y no se puede
--                ampliar anadiendo politicas: si la fila no es de la institucion
--                del contexto, no existe.
--   permisiva    el permiso real dentro del cerco: leer por ser miembro,
--                escribir por ser administrador.
--
-- Sin ninguna politica permisiva una tabla con RLS no devuelve nada. Es el
-- comportamiento correcto por defecto: se abre lo que se declara, no al reves.
-- ============================================================================

-- --- Tablas de configuracion de la institucion, todas con el mismo patron ---

do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'dominios_institucion', 'sedes', 'unidades_academicas',
    'programas', 'periodos_academicos'
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


-- --- usuarios: identidad global, sin institucion_id que acotar ---------------
-- El cerco aqui no es el tenant sino la relacion: se ve la propia fila y la de
-- quien comparte institucion. Sin FORCE, para no romper las funciones
-- SECURITY DEFINER que consultan esta tabla.

alter table usuarios enable row level security;

create policy usuarios_lectura on usuarios
  for select to public
  using (
    id = app.usuario_actual()
    or app.comparte_institucion(id)
    or app.es_superadmin()
    or app.es_rol_auth()
  );

create policy usuarios_alta on usuarios
  for insert to public
  with check (app.es_rol_auth() or app.es_admin());

create policy usuarios_edicion on usuarios
  for update to public
  using (
    id = app.usuario_actual()
    or app.es_rol_auth()
    or app.es_superadmin()
    or (app.es_admin() and app.comparte_institucion(id))
  )
  with check (
    id = app.usuario_actual()
    or app.es_rol_auth()
    or app.es_superadmin()
    or (app.es_admin() and app.comparte_institucion(id))
  );

-- Sin politica de delete: las cuentas se dan de baja con eliminado_en.
-- es_superadmin no aparece en ningun grant de columna: no se puede escalar
-- privilegio con un update a la propia fila.


-- --- instituciones ----------------------------------------------------------
-- Sin politica de insert a proposito: crear una institucion pasa siempre por
-- app.crear_institucion(), que garantiza que nazca con un propietario.

alter table instituciones enable row level security;

create policy instituciones_lectura on instituciones
  for select to public
  using (app.es_miembro(id) or app.es_rol_auth());

create policy instituciones_gestion on instituciones
  for update to public
  using      (id = app.institucion_actual() and app.es_admin())
  with check (id = app.institucion_actual() and app.es_admin());


-- --- membresias -------------------------------------------------------------
-- El cerco deja pasar tambien las membresias propias sin importar el contexto:
-- es lo que permite listar "mis instituciones" antes de haber elegido una.
-- Sin FORCE: las funciones SECURITY DEFINER leen esta tabla.

alter table membresias enable row level security;

create policy membresias_aislamiento on membresias
  as restrictive for all to public
  using (
    institucion_id = app.institucion_actual()
    or usuario_id = app.usuario_actual()
    or app.es_superadmin()
    or app.es_rol_auth()
  )
  with check (
    institucion_id = app.institucion_actual()
    or app.es_superadmin()
    or app.es_rol_auth()
  );

create policy membresias_lectura on membresias
  for select to public
  using (
    usuario_id = app.usuario_actual()
    or app.es_miembro(institucion_id)
    or app.es_rol_auth()
  );

create policy membresias_gestion on membresias
  for all to public
  using      (app.es_admin())
  with check (app.es_admin());

-- Aceptar una invitacion crea la membresia antes de que exista contexto.
create policy membresias_alta_auth on membresias
  for insert to public
  with check (app.es_rol_auth());


-- --- membresia_roles --------------------------------------------------------

alter table membresia_roles enable row level security;

create policy membresia_roles_aislamiento on membresia_roles
  as restrictive for all to public
  using (
    institucion_id = app.institucion_actual()
    or app.es_membresia_propia(membresia_id)
    or app.es_superadmin()
    or app.es_rol_auth()
  )
  with check (
    institucion_id = app.institucion_actual()
    or app.es_superadmin()
    or app.es_rol_auth()
  );

create policy membresia_roles_lectura on membresia_roles
  for select to public
  using (
    app.es_miembro(institucion_id)
    or app.es_membresia_propia(membresia_id)
    or app.es_rol_auth()
  );

create policy membresia_roles_gestion on membresia_roles
  for all to public
  using      (app.es_admin())
  with check (app.es_admin());

create policy membresia_roles_alta_auth on membresia_roles
  for insert to public
  with check (app.es_rol_auth());


-- --- invitaciones -----------------------------------------------------------
-- No las ven los miembros comunes: llevan el hash del token y la lista de roles
-- que se va a conceder. Administracion, o el modulo de auth al aceptarlas.

alter table invitaciones enable row level security;
alter table invitaciones force  row level security;

create policy invitaciones_aislamiento on invitaciones
  as restrictive for all to public
  using (
    institucion_id = app.institucion_actual()
    or app.es_superadmin()
    or app.es_rol_auth()
  )
  with check (
    institucion_id = app.institucion_actual()
    or app.es_superadmin()
    or app.es_rol_auth()
  );

create policy invitaciones_gestion on invitaciones
  for all to public
  using      (app.es_admin())
  with check (app.es_admin());

create policy invitaciones_canje on invitaciones
  for select to public
  using (app.es_rol_auth());

create policy invitaciones_canje_cierre on invitaciones
  for update to public
  using      (app.es_rol_auth())
  with check (app.es_rol_auth());


-- --- sesiones ---------------------------------------------------------------

alter table sesiones enable row level security;
alter table sesiones force  row level security;

create policy sesiones_auth on sesiones
  for all to public
  using      (app.es_rol_auth())
  with check (app.es_rol_auth());

-- El usuario ve y cierra sus propias sesiones desde su perfil.
create policy sesiones_propias on sesiones
  for select to public
  using (usuario_id = app.usuario_actual());

create policy sesiones_cierre_propio on sesiones
  for update to public
  using      (usuario_id = app.usuario_actual())
  with check (usuario_id = app.usuario_actual());


-- --- tokens_verificacion ----------------------------------------------------
-- Nadie mas que el modulo de autenticacion. Ni el propio dueno del token.

alter table tokens_verificacion enable row level security;
alter table tokens_verificacion force  row level security;

create policy tokens_verificacion_auth on tokens_verificacion
  for all to public
  using      (app.es_rol_auth())
  with check (app.es_rol_auth());


-- --- auditoria.eventos ------------------------------------------------------
-- Sin politicas de update ni delete: lo que entra en la bitacora se queda.
-- El actor no se puede falsificar: solo se escribe en nombre propio.

alter table auditoria.eventos enable row level security;

create policy eventos_lectura on auditoria.eventos
  for select to public
  using (
    (institucion_id = app.institucion_actual() and app.es_admin())
    or app.es_superadmin()
  );

create policy eventos_escritura on auditoria.eventos
  for insert to public
  with check (
    (
      institucion_id is not distinct from app.institucion_actual()
      and actor_id is not distinct from app.usuario_actual()
    )
    or app.es_rol_auth()
  );


-- ============================================================================
-- 14 · Onboarding: crear una institucion
-- ----------------------------------------------------------------------------
-- El huevo y la gallina del multi-tenant: para escribir en una institucion hay
-- que ser administrador de ella, pero el primer administrador no existe hasta
-- que la institucion existe. Se resuelve con una unica operacion atomica que
-- crea la institucion, la membresia y el rol propietario de golpe. Es tambien
-- la razon de que instituciones no tenga politica de insert: no hay otra
-- puerta de entrada.
--
-- Toma el usuario del contexto, no de un parametro: quien llama no puede crear
-- una institucion a nombre de otro.
-- ============================================================================

-- El asistente de onboarding necesita decir "ese identificador ya esta tomado"
-- sin poder leer la tabla de instituciones, que solo muestra las propias.
-- Devuelve un si o un no, nunca datos de la institucion que lo ocupa.
create function app.slug_disponible(p_slug citext) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select not exists (
    select 1 from instituciones i
     where i.slug = p_slug and i.eliminado_en is null
  )
$fn$;

create function app.crear_institucion(
  p_nombre       text,
  p_slug         citext,
  p_siglas       text default null,
  p_tipo         tipo_institucion default 'universidad',
  p_pais         char(2) default 'DO',
  p_zona_horaria text default 'America/Santo_Domingo'
) returns instituciones
  language plpgsql security definer
  set search_path = public, pg_catalog
as $fn$
declare
  v_usuario     uuid := app.usuario_actual();
  v_institucion instituciones;
  v_membresia   uuid;
begin
  if v_usuario is null then
    raise exception 'no hay usuario en el contexto de la peticion'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from usuarios u
                  where u.id = v_usuario
                    and u.estado in ('activo', 'invitado')
                    and u.eliminado_en is null) then
    raise exception 'el usuario % no puede crear instituciones', v_usuario
      using errcode = 'insufficient_privilege';
  end if;

  insert into instituciones (nombre, slug, siglas, tipo, pais, zona_horaria, creada_por)
  values (btrim(p_nombre), p_slug, p_siglas, p_tipo, p_pais, p_zona_horaria, v_usuario)
  returning * into v_institucion;

  insert into membresias (institucion_id, usuario_id, estado, ingreso_en)
  values (v_institucion.id, v_usuario, 'activa', current_date)
  returning id into v_membresia;

  insert into membresia_roles (membresia_id, institucion_id, rol, asignado_por)
  values (v_membresia, v_institucion.id, 'propietario', v_usuario);

  insert into auditoria.eventos (institucion_id, actor_id, accion, entidad, entidad_id, datos)
  values (v_institucion.id, v_usuario, 'institucion.creada', 'instituciones', v_institucion.id,
          jsonb_build_object('slug', v_institucion.slug, 'nombre', v_institucion.nombre));

  return v_institucion;
end
$fn$;

comment on function app.crear_institucion(text, citext, text, tipo_institucion, char, text) is
  'Alta de un tenant: institucion + membresia + rol propietario en una sola transaccion. Unica via para insertar en instituciones.';
comment on function app.slug_disponible(citext) is
  'Si un identificador publico esta libre. Responde si o no sin filtrar nada de la institucion que lo ocupa.';


-- ============================================================================
-- 15 · Privilegios
-- ----------------------------------------------------------------------------
-- RLS decide que filas; los grants deciden que tablas y que columnas. Las dos
-- capas hacen falta: RLS no sabe distinguir columnas, y por eso es_superadmin
-- no aparece en ningun grant de escritura. Sin ese detalle, cualquier usuario
-- podria ascenderse a si mismo con un update a su propia fila, que las
-- politicas permiten.
-- ============================================================================

grant usage on schema public    to educa_app, educa_auth;
grant usage on schema app       to educa_app, educa_auth;
grant usage on schema auditoria to educa_app, educa_auth;


-- --- educa_app: el trafico de negocio ---------------------------------------

grant select, insert, update, delete on
  dominios_institucion, sedes, unidades_academicas, programas,
  periodos_academicos, membresias, membresia_roles, invitaciones
  to educa_app;

-- Insert no: las instituciones nacen por app.crear_institucion(). Delete no:
-- se archivan.
grant select, update on instituciones to educa_app;

grant select on usuarios to educa_app;
grant insert (correo, nombres, apellidos, telefono, avatar_url, idioma,
              zona_horaria, estado)
  on usuarios to educa_app;
grant update (nombres, apellidos, telefono, avatar_url, idioma,
              zona_horaria, estado, eliminado_en)
  on usuarios to educa_app;

grant select on sesiones to educa_app;
grant update (revocada_en, motivo_revocacion) on sesiones to educa_app;

grant select, insert on auditoria.eventos to educa_app;


-- --- educa_auth: solo identidad, y solo lo que necesita ---------------------

grant select on usuarios to educa_auth;
grant insert (correo, hash_contrasena, nombres, apellidos, telefono,
              avatar_url, idioma, zona_horaria, estado, correo_verificado_en)
  on usuarios to educa_auth;
grant update (correo, correo_verificado_en, hash_contrasena, nombres, apellidos,
              estado, intentos_fallidos, bloqueado_hasta, ultimo_acceso_en)
  on usuarios to educa_auth;

grant select, insert, update, delete on sesiones            to educa_auth;
grant select, insert, update, delete on tokens_verificacion to educa_auth;
grant select, update                 on invitaciones        to educa_auth;
grant select, insert                 on membresias          to educa_auth;
grant select, insert                 on membresia_roles     to educa_auth;
grant select                         on instituciones       to educa_auth;
grant select                         on dominios_institucion to educa_auth;
grant insert                         on auditoria.eventos   to educa_auth;

-- Ninguno de los dos roles puede escribir es_superadmin. Ese ascenso se hace a
-- mano con el usuario maestro.


-- --- Funciones --------------------------------------------------------------

grant execute on all functions in schema app to educa_app, educa_auth;

-- Lo que cree la migracion 002 en adelante queda accesible sin repetir grants;
-- lo que no queda concedido solo es la seguridad, que vive en las politicas.
alter default privileges in schema public
  grant select, insert, update, delete on tables to educa_app;
alter default privileges in schema app
  grant execute on functions to educa_app, educa_auth;


-- ============================================================================
-- 16 · Comprobacion
-- ----------------------------------------------------------------------------
-- Una tabla nueva sin RLS es una fuga de datos entre instituciones que nadie
-- nota hasta que es tarde. La migracion se niega a terminar si queda alguna.
-- ============================================================================

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
