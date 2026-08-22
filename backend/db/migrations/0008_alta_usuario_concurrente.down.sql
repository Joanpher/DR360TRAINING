-- La reversion restaura la implementacion inicial de la migracion 0007.

set local search_path = public, pg_catalog;

create or replace function app.crear_usuario_institucional(
  p_nombres text, p_apellidos text, p_correo citext, p_telefono text,
  p_codigo text, p_rol rol_institucional
)
returns table (usuario_id uuid, membresia_id uuid, es_usuario_nuevo boolean)
language plpgsql security definer set search_path = public, pg_catalog
as $fn$
declare
  v_institucion uuid := app.institucion_actual();
  v_usuario uuid;
  v_membresia uuid;
  v_nuevo boolean := false;
begin
  if v_institucion is null then
    raise exception 'no hay institucion en el contexto' using errcode = '42501';
  end if;
  if not app.es_admin() then
    raise exception 'solo administracion puede registrar usuarios' using errcode = '42501';
  end if;
  if p_rol not in ('administrador', 'coordinador', 'docente', 'invitado') then
    raise exception 'ese rol no se asigna desde el registro de usuarios'
      using errcode = '22023',
            hint = 'El rol estudiante se obtiene al inscribirse en un curso.';
  end if;
  select u.id into v_usuario from usuarios u
   where u.correo = p_correo and u.eliminado_en is null for update;
  if v_usuario is null then
    insert into usuarios (correo, nombres, apellidos, telefono, estado)
    values (p_correo, p_nombres, p_apellidos, p_telefono, 'activo')
    returning id into v_usuario;
    v_nuevo := true;
  end if;
  if exists (select 1 from membresias m where m.institucion_id = v_institucion
    and m.usuario_id = v_usuario and m.eliminado_en is null) then
    raise exception 'ese correo ya pertenece a un usuario de la institucion'
      using errcode = '23505';
  end if;
  insert into membresias (institucion_id, usuario_id, codigo, estado, ingreso_en)
  values (v_institucion, v_usuario, nullif(btrim(p_codigo), ''), 'activa', current_date)
  returning id into v_membresia;
  insert into membresia_roles (membresia_id, institucion_id, rol, asignado_por)
  values (v_membresia, v_institucion, p_rol, app.usuario_actual());
  return query select v_usuario, v_membresia, v_nuevo;
end
$fn$;
