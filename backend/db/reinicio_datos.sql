-- ============================================================================
-- Reinicio de datos de prueba
-- ----------------------------------------------------------------------------
-- Script de un solo uso, NO es una migracion y el runner no lo conoce.
--
-- La migracion 0004 se llevo por delante las tablas escolares y con ellas sus
-- filas. Lo que sobrevivio son las personas y las instituciones: usuarios,
-- membresias, roles, invitaciones, sesiones, sedes y la bitacora. Casi todo eso
-- son pruebas de los primeros meses -docentes inventados, matriculas de una
-- universidad que no existe- y arrastrarlo al modelo nuevo solo estorba.
--
-- Esto borra a todo el mundo MENOS la cuenta que se indique y las instituciones
-- que esa cuenta posee. Se ejecuta con el usuario maestro:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--        -v conservar="'tu@correo.com'" -f db/reinicio_datos.sql
--
-- Sin -v conservar usa el correo de abajo. Comprueba la cuenta antes de borrar
-- nada y aborta si no la encuentra: es preferible a vaciar la base entera por
-- una errata en el correo.
--
-- Va dentro de una transaccion. Para ensayarlo primero, cambia el commit final
-- por rollback y lee los avisos que imprime.
-- ============================================================================

\if :{?conservar}
\else
  \set conservar '\'jimenezjoanpher07@gmail.com\''
\endif

-- Las politicas de RLS estorban aqui: esto es mantenimiento del cluster, no
-- trafico de la aplicacion, y corre sin contexto de institucion. Con el usuario
-- maestro de RDS vale; con educa_app no, y es justo lo que se quiere.
set row_security = off;

begin;

-- Quien se queda. Una tabla temporal y no una variable porque las sentencias de
-- borrado de mas abajo la consultan, y asi el criterio esta escrito una sola
-- vez. on commit drop: muere con la transaccion, no deja rastro.
create temporary table conservar_usuario on commit drop as
  select id, correo::text as correo
    from usuarios
   where correo = :conservar::citext
     and eliminado_en is null;

-- Las instituciones que sobreviven son aquellas donde la cuenta conservada es
-- PROPIETARIA. Ser administrador de la institucion de otro no basta: eso es
-- justamente lo que suele ser un tenant de prueba.
create temporary table conservar_instituciones on commit drop as
  select distinct m.institucion_id as id
    from membresias m
    join membresia_roles r on r.membresia_id = m.id
    join conservar_usuario cu on cu.id = m.usuario_id
   where m.eliminado_en is null
     and r.rol = 'propietario';

do $bloque$
declare
  v_id uuid;
  v_correo text;
  v_instituciones int;
  v_usuarios_fuera int;
begin
  select id, correo into v_id, v_correo from conservar_usuario;

  if v_id is null then
    raise exception
      'no hay ningun usuario activo con ese correo. Nada que conservar, asi que no se borra nada.';
  end if;

  select count(*) into v_instituciones from conservar_instituciones;
  select count(*) into v_usuarios_fuera from usuarios u
   where u.id not in (select id from conservar_usuario);

  raise notice 'Conservando % (%) y % institucion(es) suyas.', v_correo, v_id, v_instituciones;
  raise notice 'Se borraran % usuario(s) y todo lo que cuelgue de las demas instituciones.',
    v_usuarios_fuera;
end
$bloque$;


-- El orden lo pone el cascade: borrar la institucion se lleva sus membresias,
-- roles, invitaciones, sedes, categorias, cursos, inscripciones y cobros.
-- Borrar el usuario se lleva sus sesiones, tokens y membresias.

delete from instituciones
 where id not in (select id from conservar_instituciones);

-- "is distinct from" y no "<>": usuarios.correo admite null desde la 0002, y
-- con <> esas filas -alumnos que entraban solo con matricula- se salvarian del
-- borrado sin que nadie se diera cuenta.
delete from usuarios
 where id is distinct from (select id from conservar_usuario);

-- La bitacora no se va por cascade cuando desaparece el actor: actor_id es
-- "on delete set null" a proposito, para que un evento siga contando lo que
-- paso aunque la cuenta ya no exista. Aqui si se limpia, porque estos eventos
-- describen tablas que ya no existen.
delete from auditoria.eventos
 where institucion_id not in (select id from conservar_instituciones);

-- Los contadores de matricula vuelven a cero: las matriculas que numeraban se
-- fueron con sus instituciones, y arrancar el catalogo nuevo en EDU-2026-0043
-- no le dice nada a nadie.
delete from contadores;

commit;

reset row_security;
