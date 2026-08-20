-- ============================================================================
-- 0001 · Reversion del nucleo multi-tenant
-- ----------------------------------------------------------------------------
-- Destruye todo el esquema. Solo tiene sentido en desarrollo.
-- Los roles educa_app y educa_auth no se borran: son objetos del cluster, no de
-- la base de datos, y pueden estar en uso. Para eliminarlos, con el usuario
-- maestro y esta base de datos ya vacia:
--   drop owned by educa_app, educa_auth;
--   drop role educa_app, educa_auth;
-- ============================================================================

drop function if exists app.crear_institucion(text, citext, text, tipo_institucion, char, text);
drop function if exists app.slug_disponible(citext);

drop table if exists auditoria.eventos;
drop table if exists tokens_verificacion;
drop table if exists sesiones;
drop table if exists invitaciones;
drop table if exists membresia_roles;
drop table if exists membresias;
drop table if exists periodos_academicos;
drop table if exists programas;
drop table if exists unidades_academicas;
drop table if exists sedes;
drop table if exists dominios_institucion;
drop table if exists instituciones;
drop table if exists usuarios;

drop function if exists app.proteger_ultimo_propietario();
drop function if exists app.institucion_inmutable();
drop function if exists app.tocar_actualizado_en();
drop function if exists app.comparte_institucion(uuid);
drop function if exists app.es_membresia_propia(uuid);
drop function if exists app.es_admin();
drop function if exists app.tiene_rol(rol_institucional[]);
drop function if exists app.es_miembro(uuid);
drop function if exists app.es_superadmin();
drop function if exists app.es_rol_auth();
drop function if exists app.institucion_actual();
drop function if exists app.usuario_actual();

drop type if exists tipo_token;
drop type if exists nivel_programa;
drop type if exists tipo_unidad_academica;
drop type if exists estado_periodo;
drop type if exists estado_invitacion;
drop type if exists estado_membresia;
drop type if exists rol_institucional;
drop type if exists estado_usuario;
drop type if exists estado_institucion;
drop type if exists tipo_institucion;

drop schema if exists auditoria;
-- app conserva la tabla de migraciones, que la maneja el runner.
