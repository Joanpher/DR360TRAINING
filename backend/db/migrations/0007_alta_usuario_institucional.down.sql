set local search_path = public, pg_catalog;

drop function if exists app.crear_usuario_institucional(
  text, text, citext, text, text, rol_institucional
);
