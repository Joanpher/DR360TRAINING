-- ============================================================================
-- 0003 · Inscripción, matrícula y cobros — reversa
-- ----------------------------------------------------------------------------
-- Se lleva por delante expedientes, inscripciones y el historial de pagos. En
-- una base con datos reales esto no se ejecuta: se escribe una migración nueva
-- que corrija lo que haga falta.
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists pagos;
drop table if exists cargos;
drop table if exists conceptos_cobro;
drop table if exists curso_estudiantes;
drop table if exists inscripciones;
drop table if exists estudiante_representantes;
drop table if exists representantes;
drop table if exists estudiantes;
drop table if exists contadores;

drop function if exists app.mi_membresia();
drop function if exists app.siguiente_numero(uuid, text);

drop type if exists metodo_pago;
drop type if exists tipo_concepto;
drop type if exists estado_cargo;
drop type if exists estado_inscripcion;
drop type if exists parentesco;
drop type if exists sexo_persona;
drop type if exists tipo_documento;
