-- ============================================================================
-- 0002 · Estructura escolar — reversa
-- ----------------------------------------------------------------------------
-- Devuelve el esquema al vocabulario universitario de la 0001. Las tablas
-- nuevas se pierden con sus datos, que es lo que significa revertir.
--
-- programas se recrea vacía: sus filas se fueron al aplicar la 0002 y no hay
-- de dónde sacarlas. Por eso revertir esta migración no es una operación
-- inocente en una base con datos.
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists cursos;
drop table if exists plan_estudio;
drop table if exists asignaturas;
drop table if exists secciones;
drop table if exists grados;
drop table if exists periodos_calificacion;

drop type if exists estado_curso;
drop type if exists nivel_escolar;


-- --- Año escolar vuelve a ser periodo académico -----------------------------

create type estado_periodo as enum ('planificado', 'activo', 'cerrado');

alter table anos_escolares
  alter column estado drop default,
  alter column estado type estado_periodo using estado::text::estado_periodo,
  alter column estado set default 'planificado';

drop type estado_ano_escolar;

alter policy anos_escolares_aislamiento on anos_escolares rename to periodos_academicos_aislamiento;
alter policy anos_escolares_lectura     on anos_escolares rename to periodos_academicos_lectura;
alter policy anos_escolares_gestion     on anos_escolares rename to periodos_academicos_gestion;

alter trigger anos_escolares_actualizado on anos_escolares
  rename to periodos_academicos_actualizado;
alter trigger anos_escolares_institucion_inmutable on anos_escolares
  rename to periodos_academicos_institucion_inmutable;

alter index anos_escolares_codigo_uk   rename to periodos_academicos_codigo_uk;
alter index anos_escolares_actual_uk   rename to periodos_academicos_actual_uk;
alter index anos_escolares_vigencia_ix rename to periodos_academicos_vigencia_ix;

alter table anos_escolares rename constraint anos_escolares_tenant_uk to periodos_academicos_tenant_uk;
alter table anos_escolares rename constraint anos_escolares_rango to periodos_academicos_rango;
alter table anos_escolares rename constraint anos_escolares_rango_inscripcion
  to periodos_academicos_rango_inscripcion;

alter table anos_escolares rename to periodos_academicos;


-- --- Vuelven las carreras ---------------------------------------------------

create type nivel_programa as enum (
  'tecnico', 'grado', 'especialidad', 'maestria', 'doctorado', 'diplomado'
);

create table programas (
  id                   uuid        primary key default gen_random_uuid(),
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

create unique index programas_codigo_uk on programas (institucion_id, codigo) where eliminado_en is null;
create index programas_unidad_ix on programas (institucion_id, unidad_academica_id);

create trigger programas_actualizado before update on programas
  for each row execute function app.tocar_actualizado_en();
create trigger programas_institucion_inmutable before update on programas
  for each row execute function app.institucion_inmutable();

alter table programas enable row level security;
alter table programas force  row level security;

create policy programas_aislamiento on programas
  as restrictive for all to public
  using      (institucion_id = app.institucion_actual() or app.es_superadmin())
  with check (institucion_id = app.institucion_actual() or app.es_superadmin());

create policy programas_lectura on programas
  for select to public using (app.es_miembro(institucion_id));

create policy programas_gestion on programas
  for all to public using (app.es_admin()) with check (app.es_admin());

grant select, insert, update, delete on programas to educa_app;

alter table membresias add column programa_id uuid;
alter table membresias add constraint membresias_programa_fk
  foreign key (programa_id, institucion_id)
  references programas (id, institucion_id) on delete restrict;
create index membresias_programa_ix on membresias (institucion_id, programa_id);

alter table invitaciones add column programa_id uuid;
alter table invitaciones add constraint invitaciones_programa_fk
  foreign key (programa_id, institucion_id)
  references programas (id, institucion_id) on delete restrict;


-- --- Núcleo -----------------------------------------------------------------

drop index if exists membresias_codigo_global_uk;

-- Solo se puede volver a exigir correo si nadie se quedó sin él.
update usuarios set correo = 'sin-correo-' || id || '@invalido.local' where correo is null;
alter table usuarios alter column correo set not null;

alter table instituciones drop column modalidad;
drop type modalidad_institucion;
