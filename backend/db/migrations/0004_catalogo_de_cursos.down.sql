-- ============================================================================
-- 0004 · Reversion del catalogo de cursos
-- ----------------------------------------------------------------------------
-- Esta reversion deshace lo que la 0004 CREO. No resucita lo que borro.
--
-- Es importante entenderlo antes de ejecutarla: la 0004 tira las tablas
-- escolares de las migraciones 0002 y 0003 -grados, secciones, asignaturas,
-- plan de estudio, anos escolares, representantes, expedientes, mensualidades-
-- y esas filas se van con ellas. Correr esto deja la base en el nucleo de la
-- 0001 mas los restos de la 0002/0003 que la 0004 no toco, no en el estado
-- anterior a la 0004.
--
-- Para volver de verdad al modelo escolar habria que revertir 0004, 0003 y 0002
-- y volver a aplicarlas, con la base vacia. En desarrollo eso es lo razonable;
-- en produccion, a estas alturas, no hay vuelta atras y no deberia haberla.
--
-- Lo unico que no se revierte a proposito es el row level security de
-- contadores. La 0003 lo dejo sin politicas por descuido y eso era una fuga
-- entre instituciones; devolver la tabla a ese estado seria reabrirla.
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists pagos;
drop table if exists cargos;
drop table if exists inscripciones;
drop table if exists participantes;
drop table if exists curso_horarios;
drop table if exists cursos;
drop table if exists categorias;

drop type if exists estado_inscripcion;
drop type if exists nivel_curso;
drop type if exists modalidad_curso;

-- Las columnas y tablas que la 0004 quito del nucleo se devuelven vacias, para
-- que el esquema vuelva a tener la forma que esperan la 0002 y la 0003 si
-- alguien las reaplica sobre una base limpia.

create type modalidad_institucion as enum ('colegio', 'cursos');

alter table instituciones
  add column if not exists modalidad modalidad_institucion not null default 'colegio';

create type tipo_unidad_academica as enum (
  'facultad', 'escuela', 'departamento', 'area'
);

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
  constraint unidades_academicas_padre_fk
    foreign key (padre_id, institucion_id)
    references unidades_academicas (id, institucion_id) on delete restrict,
  constraint unidades_academicas_sede_fk
    foreign key (sede_id, institucion_id)
    references sedes (id, institucion_id) on delete restrict,
  constraint unidades_academicas_sin_ciclo_directo check (padre_id is distinct from id)
);

create unique index unidades_academicas_codigo_uk
  on unidades_academicas (institucion_id, codigo) where eliminado_en is null;
create index unidades_academicas_padre_ix on unidades_academicas (institucion_id, padre_id);

alter table unidades_academicas enable row level security;
alter table unidades_academicas force  row level security;

create policy unidades_academicas_aislamiento on unidades_academicas
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());

create policy unidades_academicas_lectura on unidades_academicas
  for select to public using (app.es_miembro(institucion_id));

create policy unidades_academicas_gestion on unidades_academicas
  for all to public using (app.es_admin()) with check (app.es_admin());

grant select, insert, update, delete on unidades_academicas to educa_app;

alter table membresias add column if not exists unidad_academica_id uuid;
alter table membresias add constraint membresias_unidad_fk
  foreign key (unidad_academica_id, institucion_id)
  references unidades_academicas (id, institucion_id) on delete restrict;
