-- ============================================================================
-- Alineacion puntual de educa con 0001_nucleo_multitenant.sql
-- 2026-08-19 · script de un solo uso, no es una migracion
-- ----------------------------------------------------------------------------
-- La base educa se creo ejecutando 0001 a mano en un cliente SQL, antes de que
-- el archivo recibiera tres cambios. Un pg_dump comparado contra una base
-- creada por el runner confirmo que todo lo demas (tablas, indices, triggers,
-- banderas RLS, grants por columna) coincide exactamente. Esto aplica solo la
-- diferencia, sin borrar nada:
--
--   1. las funciones app.es_membresia_propia y app.slug_disponible
--   2. las dos politicas de membresia_roles que usan la primera
--   3. el comentario de usuarios.hash_contrasena
--
-- Despues de correrlo, sellar el ledger:
--   node db/migrar.mjs sellar 0001_nucleo_multitenant.sql
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- --- 1 · Funciones nuevas ---------------------------------------------------

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

create function app.slug_disponible(p_slug citext) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select not exists (
    select 1 from instituciones i
     where i.slug = p_slug and i.eliminado_en is null
  )
$fn$;

comment on function app.slug_disponible(citext) is
  'Si un identificador publico esta libre. Responde si o no sin filtrar nada de la institucion que lo ocupa.';

grant execute on function app.es_membresia_propia(uuid) to educa_app, educa_auth;
grant execute on function app.slug_disponible(citext) to educa_app, educa_auth;


-- --- 2 · Politicas de membresia_roles ---------------------------------------
-- Al entrar, antes de elegir institucion, hay que poder listar "mis
-- instituciones y que soy en cada una". Sin esto, membresia_roles queda
-- ilegible mientras no haya institucion en el contexto.

drop policy membresia_roles_aislamiento on membresia_roles;
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

drop policy membresia_roles_lectura on membresia_roles;
create policy membresia_roles_lectura on membresia_roles
  for select to public
  using (
    app.es_miembro(institucion_id)
    or app.es_membresia_propia(membresia_id)
    or app.es_rol_auth()
  );


-- --- 3 · Comentario ---------------------------------------------------------

comment on column usuarios.hash_contrasena is
  'Hash con sal calculado en la aplicacion (scrypt). La base de datos nunca ve la contrasena.';

commit;
