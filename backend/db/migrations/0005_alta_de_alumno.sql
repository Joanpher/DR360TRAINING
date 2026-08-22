-- ============================================================================
-- 0005 · Alta de alumno
-- ----------------------------------------------------------------------------
-- Un huevo y una gallina que llevaban ahi desde la 0001 sin que nadie los viera.
--
-- Para inscribir a alguien nuevo hay que crearle la cuenta:
--
--   insert into usuarios (...) values (...) returning id
--
-- Ese "returning" es el problema. Con row level security, un INSERT que devuelve
-- filas tiene que pasar tambien las politicas de SELECT, y usuarios_lectura dice
-- que solo se ve a quien comparte institucion contigo. La persona recien creada
-- no comparte ninguna todavia -su membresia se inserta en la linea siguiente-,
-- asi que la fila existe, se escribe bien, y al devolverla la politica la tapa.
-- El rol de negocio recibe un "new row violates row-level security policy" en
-- una fila que si tenia derecho a crear.
--
-- Es exactamente la misma forma que ya tenia app.crear_institucion(): para
-- escribir en una institucion hay que pertenecer a ella, pero el primer miembro
-- no existe hasta que la institucion existe. Alli se resolvio con una funcion
-- SECURITY DEFINER que hace el ciclo completo en un solo acto, y aqui se
-- resuelve igual.
--
-- Las tres tablas que toca -usuarios, membresias, membresia_roles- son
-- justamente las que la 0001 dejo sin FORCE ROW LEVEL SECURITY, y por esta
-- razon: son las que leen y escriben las funciones SECURITY DEFINER.
--
-- Lo que la funcion NO hace, a proposito:
--
--   · no pone la clave. hash_contrasena no esta en ningun grant de columna del
--     rol de negocio y eso se mantiene: la escribe el modulo de identidad,
--     despues, en su propia transaccion.
--   · no genera la matricula. El codigo se le pasa ya calculado, porque quien
--     sabe componerlo -siglas de la institucion, ano, contador- es la aplicacion.
--   · no crea la ficha ni la inscripcion. Eso son tablas de negocio normales,
--     con RLS que el rol de la aplicacion si atraviesa.
-- ============================================================================

set local search_path = public, pg_catalog;

create function app.crear_alumno(
  p_nombres   text,
  p_apellidos text,
  p_correo    citext default null,
  p_telefono  text   default null,
  p_codigo    text   default null
)
returns table (usuario_id uuid, membresia_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_institucion uuid := app.institucion_actual();
  v_usuario     uuid;
  v_membresia   uuid;
begin
  /*
    SECURITY DEFINER significa que esto corre con los privilegios del dueno y se
    salta las politicas. Por eso el permiso se comprueba aqui a mano y es lo
    primero que hace la funcion: sin esta guarda, cualquiera con acceso al rol de
    negocio podria fabricar usuarios en cualquier institucion.

    Toma la institucion del contexto y no de un parametro, igual que
    app.crear_institucion() toma el usuario del contexto: asi nadie puede dar de
    alta a alguien en una institucion que no es la suya.
  */
  if v_institucion is null then
    raise exception 'no hay institucion en el contexto' using errcode = '42501';
  end if;

  if not app.es_admin() then
    raise exception 'solo administracion puede dar de alta a un alumno'
      using errcode = '42501';
  end if;

  insert into usuarios (correo, nombres, apellidos, telefono, estado)
  values (p_correo, p_nombres, p_apellidos, p_telefono, 'activo')
  returning id into v_usuario;

  insert into membresias (institucion_id, usuario_id, codigo, estado, ingreso_en)
  values (v_institucion, v_usuario, p_codigo, 'activa', current_date)
  returning id into v_membresia;

  insert into membresia_roles (membresia_id, institucion_id, rol, asignado_por)
  values (v_membresia, v_institucion, 'estudiante', app.usuario_actual());

  return query select v_usuario, v_membresia;
end
$fn$;

comment on function app.crear_alumno(text, text, citext, text, text) is
  'Alta de alguien que no tenia cuenta: usuario, membresia con matricula y rol de estudiante, en un acto. La clave la pone despues el modulo de identidad.';

grant execute on function app.crear_alumno(text, text, citext, text, text) to educa_app;
