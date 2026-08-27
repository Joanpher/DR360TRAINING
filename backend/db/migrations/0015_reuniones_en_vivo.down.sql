-- ============================================================================
-- 0015 · Reversion de las clases en vivo
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists reunion_asistencias;
drop table if exists reuniones;

-- Va despues de las tablas: la politica de entrada la usa y no se deja soltar
-- mientras exista.
drop function if exists app.reunion_abierta(uuid);
drop function if exists app.reunion_conteo(uuid);

drop type if exists estado_reunion;
