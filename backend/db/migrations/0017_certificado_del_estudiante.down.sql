set local search_path = public, pg_catalog;

drop policy if exists certificado_entregas_lectura_propia on certificado_entregas;
drop policy if exists certificado_entregas_propia_insercion on certificado_entregas;
drop policy if exists certificados_lectura_propia on certificados;

drop function if exists app.certificado_propio(uuid);
