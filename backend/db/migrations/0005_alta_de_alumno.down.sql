-- ============================================================================
-- 0005 · Reversion del alta de alumno
-- ----------------------------------------------------------------------------
-- Al quitar la funcion, inscribir a alguien nuevo vuelve a ser imposible desde
-- el rol de negocio: el insert into usuarios ... returning que haria falta
-- choca con usuarios_lectura. No es una regresion cosmetica.
-- ============================================================================

drop function if exists app.crear_alumno(text, text, citext, text, text);
