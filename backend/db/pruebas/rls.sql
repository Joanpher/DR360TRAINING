-- ============================================================================
-- Pruebas de aislamiento multi-tenant
-- ----------------------------------------------------------------------------
-- Un fallo de RLS no rompe nada: simplemente devuelve filas de otra institucion
-- y nadie lo nota. Por eso se comprueba a mano, con cada rol y en las dos
-- direcciones: que lo permitido pase y que lo prohibido falle.
--
-- Correr contra una base de PRUEBAS, nunca contra produccion:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/pruebas/rls.sql
--
-- Termina con rollback: no deja rastro.
-- ============================================================================

\set ON_ERROR_STOP on
\pset pager off

begin;

-- Las pruebas cambian de rol con set role, que es como se prueba RLS: el rol
-- activo decide que politicas se evaluan.
grant educa_app, educa_auth to current_user;

create or replace function pg_temp.afirmar(p_condicion boolean, p_que text)
  returns void language plpgsql as $fn$
begin
  if p_condicion is not true then
    raise exception 'FALLO: %', p_que;
  end if;
  raise notice '  ok  %', p_que;
end
$fn$;

create or replace function pg_temp.afirmar_falla(p_sql text, p_que text)
  returns void language plpgsql as $fn$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice '  ok  % (%)', p_que, sqlerrm;
    return;
  end;
  raise exception 'FALLO: % — la operacion se permitio y no debia', p_que;
end
$fn$;

-- Una politica que no deja pasar un update no lanza error: simplemente no
-- toca ninguna fila. Esa diferencia hay que comprobarla aparte.
create or replace function pg_temp.afirmar_sin_efecto(p_sql text, p_que text)
  returns void language plpgsql as $fn$
declare
  v_filas integer;
begin
  execute p_sql;
  get diagnostics v_filas = row_count;
  if v_filas <> 0 then
    raise exception 'FALLO: % — se modificaron % fila(s)', p_que, v_filas;
  end if;
  raise notice '  ok  % (0 filas)', p_que;
end
$fn$;


-- ---------------------------------------------------------------------------
\echo '\n1 · Alta de usuarios (rol educa_auth, sin contexto)'
-- ---------------------------------------------------------------------------
set role educa_auth;

insert into usuarios (correo, nombres, apellidos, estado, hash_contrasena)
values ('ana@uce.edu.do', 'Ana', 'Reyes', 'activo', 'x')
returning id \gset ana_
insert into usuarios (correo, nombres, apellidos, estado, hash_contrasena)
values ('luis@pucmm.edu.do', 'Luis', 'Batista', 'activo', 'x')
returning id \gset luis_
insert into usuarios (correo, nombres, apellidos, estado, hash_contrasena)
values ('carla@uce.edu.do', 'Carla', 'Mendez', 'activo', 'x')
returning id \gset carla_

reset role;
select pg_temp.afirmar((select count(*) from usuarios) = 3, 'educa_auth puede dar de alta usuarios');


-- ---------------------------------------------------------------------------
\echo '\n2 · Onboarding: cada quien crea su institucion'
-- ---------------------------------------------------------------------------
set role educa_app;

select set_config('app.usuario_id', :'ana_id', true);
select id from app.crear_institucion('Instituto Tecnico del Caribe', 'itc', 'ITC') \gset uce_

select set_config('app.usuario_id', :'luis_id', true);
select id from app.crear_institucion('Pontificia Universidad Catolica', 'pucmm', 'PUCMM') \gset pucmm_

reset role;
select pg_temp.afirmar(
  (select count(*) from membresia_roles where rol = 'propietario') = 2,
  'crear_institucion deja un propietario en cada institucion');


-- ---------------------------------------------------------------------------
\echo '\n3 · El cerco del tenant'
-- ---------------------------------------------------------------------------
set role educa_app;

-- Ana, dentro de su institucion, crea estructura.
select set_config('app.usuario_id', :'ana_id', true);
select set_config('app.institucion_id', :'uce_id', true);

insert into sedes (institucion_id, codigo, nombre, es_principal)
values (:'uce_id', 'SD', 'Recinto Santo Domingo', true);
insert into periodos_academicos (institucion_id, codigo, nombre, inicio, fin, es_actual)
values (:'uce_id', '2026-2', 'Segundo semestre 2026', '2026-08-01', '2026-12-15', true);

select pg_temp.afirmar((select count(*) from sedes) = 1, 'Ana ve la sede de su institucion');

-- Luis crea la suya.
select set_config('app.usuario_id', :'luis_id', true);
select set_config('app.institucion_id', :'pucmm_id', true);
insert into sedes (institucion_id, codigo, nombre)
values (:'pucmm_id', 'STI', 'Campus Santiago');

select pg_temp.afirmar((select count(*) from sedes) = 1, 'Luis ve solo la suya, no las dos');

-- Ana otra vez: la sede de Luis no existe para ella.
select set_config('app.usuario_id', :'ana_id', true);
select set_config('app.institucion_id', :'uce_id', true);
select pg_temp.afirmar(
  (select count(*) from sedes where codigo = 'STI') = 0,
  'la sede de la otra institucion no aparece');

-- Apuntar el contexto a una institucion ajena no abre nada: el cerco pide que
-- la fila sea del contexto Y las permisivas piden ser miembro.
select set_config('app.institucion_id', :'pucmm_id', true);
select pg_temp.afirmar(
  (select count(*) from sedes) = 0,
  'falsificar el contexto no da acceso a otra institucion');
select pg_temp.afirmar(
  (select count(*) from instituciones) = 1,
  'instituciones solo muestra aquellas donde hay membresia');

-- Sin contexto no hay datos: el estado por defecto es no ver nada.
select set_config('app.usuario_id', '', true);
select set_config('app.institucion_id', '', true);
select pg_temp.afirmar((select count(*) from sedes) = 0, 'sin contexto no se ve nada');
select pg_temp.afirmar((select count(*) from membresias) = 0, 'sin contexto tampoco hay membresias');

-- Con usuario pero sin institucion elegida: la pantalla de "a donde quieres
-- entrar", que ocurre entre el login y el resto de la aplicacion.
select set_config('app.usuario_id', :'ana_id', true);
select pg_temp.afirmar((select count(*) from membresias) = 1, 'sin elegir institucion, Ana ve su membresia');
select pg_temp.afirmar((select count(*) from membresia_roles) = 1, 'y el rol que tiene en ella');
select pg_temp.afirmar((select count(*) from instituciones) = 1, 'y la institucion a la que puede entrar');
select pg_temp.afirmar(app.slug_disponible('itla'), 'un identificador libre figura como disponible');
select pg_temp.afirmar(not app.slug_disponible('pucmm'), 'y uno tomado no, sin decir de quien es');

reset role;


-- ---------------------------------------------------------------------------
\echo '\n4 · Roles dentro de la institucion'
-- ---------------------------------------------------------------------------
set role educa_app;
select set_config('app.usuario_id', :'ana_id', true);
select set_config('app.institucion_id', :'uce_id', true);

-- Ana, propietaria, da de alta a Carla como estudiante.
insert into membresias (institucion_id, usuario_id, codigo, estado)
values (:'uce_id', :'carla_id', '2023-3970', 'activa')
returning id \gset carla_mem_
insert into membresia_roles (membresia_id, institucion_id, rol)
values (:'carla_mem_id', :'uce_id', 'estudiante');

select pg_temp.afirmar(app.es_admin(), 'la propietaria es administradora');

-- Ahora la sesion es de Carla: misma institucion, otro rol.
select set_config('app.usuario_id', :'carla_id', true);

select pg_temp.afirmar(not app.es_admin(), 'una estudiante no es administradora');
select pg_temp.afirmar(app.tiene_rol('estudiante'), 'y si tiene el rol estudiante');
select pg_temp.afirmar((select count(*) from sedes) = 1, 'una estudiante lee la estructura de su institucion');

select pg_temp.afirmar_falla(
  format('insert into sedes (institucion_id, codigo, nombre) values (%L, %L, %L)',
         :'uce_id', 'X', 'Sede pirata'),
  'una estudiante no puede crear sedes');

select pg_temp.afirmar_falla(
  format('insert into membresia_roles (membresia_id, institucion_id, rol) values (%L, %L, %L)',
         :'carla_mem_id', :'uce_id', 'administrador'),
  'una estudiante no puede darse el rol de administradora');

select pg_temp.afirmar(
  (select count(*) from invitaciones) = 0,
  'las invitaciones no son visibles para quien no administra');


-- ---------------------------------------------------------------------------
\echo '\n5 · Escalada de privilegios'
-- ---------------------------------------------------------------------------
-- Las politicas permiten a Carla actualizar su propia fila; el grant por
-- columna es lo que impide que se ascienda a superadmin en esa actualizacion.

select pg_temp.afirmar_falla(
  format('update usuarios set es_superadmin = true where id = %L', :'carla_id'),
  'nadie se asciende a superadmin');

update usuarios set telefono = '809-000-0000' where id = :'carla_id';
select pg_temp.afirmar(
  (select telefono from usuarios where id = :'carla_id') = '809-000-0000',
  'pero si puede editar su propio perfil');

select pg_temp.afirmar_sin_efecto(
  format('update usuarios set nombres = %L where id = %L', 'Otro', :'luis_id'),
  'no se puede editar a alguien de otra institucion');

select pg_temp.afirmar(
  (select count(*) from usuarios) = 2,
  'el directorio solo muestra a quien comparte institucion');

reset role;

-- ---------------------------------------------------------------------------
\echo '\n6 · Integridad entre instituciones'
-- ---------------------------------------------------------------------------
set role educa_app;
select set_config('app.usuario_id', :'ana_id', true);
select set_config('app.institucion_id', :'uce_id', true);

-- La clave foranea compuesta rechaza una referencia que cruce tenants aunque
-- las politicas ya la hubieran ocultado. Dos redes, no una.
select pg_temp.afirmar_falla(
  format('insert into unidades_academicas (institucion_id, sede_id, codigo, nombre)
          values (%L, (select id from sedes where codigo = %L), %L, %L)',
         :'uce_id', 'SD', 'ING', 'Facultad de Ingenieria')
    || '; update unidades_academicas set institucion_id = '
    || quote_literal(:'pucmm_id') || ' where codigo = ' || quote_literal('ING'),
  'una fila no cambia de institucion');

select pg_temp.afirmar_falla(
  format('delete from membresia_roles where institucion_id = %L and rol = %L',
         :'uce_id', 'propietario'),
  'la institucion no puede quedarse sin propietario');

-- La bitacora es append-only: crear_institucion dejo su rastro y no hay grant
-- que permita borrarlo.
select pg_temp.afirmar(
  (select count(*) from auditoria.eventos where accion = 'institucion.creada') = 1,
  'la creacion de la institucion quedo en la bitacora');
select pg_temp.afirmar_falla(
  'delete from auditoria.eventos',
  'la bitacora no se puede borrar');

-- El actor de un evento no se puede falsificar.
select pg_temp.afirmar_falla(
  format('insert into auditoria.eventos (institucion_id, actor_id, accion)
          values (%L, %L, %L)', :'uce_id', :'luis_id', 'prueba.suplantacion'),
  'no se escribe en la bitacora en nombre de otro');


-- ---------------------------------------------------------------------------
\echo '\n7 · El modulo de autenticacion'
-- ---------------------------------------------------------------------------
set role educa_auth;
select set_config('app.usuario_id', '', true);
select set_config('app.institucion_id', '', true);

-- Sin contexto, porque el login ocurre antes de que exista.
select pg_temp.afirmar(
  (select count(*) from usuarios where correo = 'ana@uce.edu.do') = 1,
  'educa_auth encuentra la cuenta para el login');
select pg_temp.afirmar(
  (select count(*) from membresias) = 3,
  'y las membresias, para saber a que instituciones puede entrar');

insert into sesiones (usuario_id, institucion_id, hash_refresco, expira_en)
values (:'ana_id', :'uce_id', 'hash-de-prueba', now() + interval '30 days');
select pg_temp.afirmar((select count(*) from sesiones) = 1, 'abre sesion');

set role educa_app;
select pg_temp.afirmar_falla(
  format('insert into sesiones (usuario_id, hash_refresco, expira_en)
          values (%L, %L, now())', :'ana_id', 'hash-falso'),
  'educa_app no puede fabricar sesiones');
select pg_temp.afirmar_falla(
  'select count(*) from tokens_verificacion',
  'educa_app no ve los tokens de verificacion');

select set_config('app.usuario_id', :'ana_id', true);
select pg_temp.afirmar(
  (select count(*) from sesiones) = 1,
  'pero cada quien ve sus propias sesiones');

reset role;

\echo '\nTodas las comprobaciones pasaron.'
rollback;
