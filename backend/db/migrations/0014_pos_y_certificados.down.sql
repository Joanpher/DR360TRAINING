-- ============================================================================
-- 0014 · Reversión de POS y certificados pagados
-- ============================================================================

set local search_path = public, pg_catalog;

drop table if exists certificado_entregas;
drop table if exists certificados;
drop table if exists pagos_pos;
drop table if exists venta_pos_lineas;
drop table if exists ventas_pos;
drop table if exists productos_pos;

drop type if exists canal_entrega_certificado;
drop type if exists estado_certificado;
drop type if exists estado_venta_pos;
drop type if exists tipo_producto_pos;
