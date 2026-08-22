-- ============================================================================
-- 0006 · Reversion
-- ----------------------------------------------------------------------------
-- Devuelve a educa_app el permiso de borrar pagos, que es justo lo que la 0006
-- quitaba. Revertir esto reabre el agujero a proposito; solo tiene sentido si
-- se va a revertir tambien la 0004, que es la que crea la tabla.
-- ============================================================================

grant delete on pagos to educa_app;
