-- ============================================================================
-- 0017 · El certificado del estudiante
-- ============================================================================
--
-- La 0014 dejó los certificados como una tabla exclusivamente administrativa:
-- su única política permisiva era `app.es_admin()`. Eso era correcto mientras
-- el certificado solo se imprimía en el mostrador, pero deja fuera al único que
-- de verdad es dueño del documento.
--
-- Aquí se abre lo mínimo para que pueda verlo desde su portal:
--
--   · leer el certificado de una inscripción suya, y solo ese;
--   · dejar constancia cuando lo imprime él mismo.
--
-- Lo que NO se abre, a propósito: la venta, la línea del ticket y el pago
-- siguen siendo del panel. El estudiante ve el documento, no la caja. Por eso
-- la consulta del portal no toca ninguna tabla del POS: la prueba de pago está
-- en que el certificado exista, porque emitir uno sin venta saldada es
-- imposible desde la 0014.

set local search_path = public, pg_catalog;

-- Encapsula "este certificado es mío" para no repetir el subselect en las tres
-- políticas. SECURITY DEFINER por la misma razón que app.mi_membresia(): la
-- comprobación tiene que poder mirar inscripciones sin volver a pasar por las
-- políticas que se están evaluando.
create function app.certificado_propio(p_certificado uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_catalog
as $fn$
  select exists (
    select 1
      from certificados c
      join inscripciones i on i.id = c.inscripcion_id
     where c.id = p_certificado
       and i.membresia_id = app.mi_membresia()
  )
$fn$;

comment on function app.certificado_propio(uuid) is
  'Cierto si el certificado corresponde a una inscripcion del usuario actual.';

-- Permisiva: se suma con OR a la de gestión, no la sustituye.
create policy certificados_lectura_propia on certificados
  for select to public
  using (
    inscripcion_id in (
      select i.id from inscripciones i where i.membresia_id = app.mi_membresia()
    )
  );

comment on policy certificados_lectura_propia on certificados is
  'El estudiante ve el certificado de sus propias inscripciones, revocado incluido.';

-- Que imprima queda registrado igual que si lo imprimiera el mostrador. El
-- canal se fija a 'impresion': por aquí no se puede fabricar un envío por
-- correo que nadie hizo.
create policy certificado_entregas_propia_insercion on certificado_entregas
  for insert to public
  with check (
    canal = 'impresion'
    and realizado_por = app.usuario_actual()
    and app.certificado_propio(certificado_id)
  );

create policy certificado_entregas_lectura_propia on certificado_entregas
  for select to public
  using (app.certificado_propio(certificado_id));

comment on policy certificado_entregas_propia_insercion on certificado_entregas is
  'El estudiante deja constancia de sus propias impresiones y de nada mas.';

-- ----------------------------------------------------------------------------
-- Comprobación
-- ----------------------------------------------------------------------------
-- No se crean tablas, así que no aplica el barrido de RLS de las migraciones
-- anteriores. Lo que sí conviene comprobar es que las tres políticas quedaron
-- puestas: una política que no se crea no da error, simplemente no existe, y
-- el síntoma sería "el alumno no ve nada", idéntico a no tener certificado.
do $bloque$
declare
  n int;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and policyname in (
       'certificados_lectura_propia',
       'certificado_entregas_propia_insercion',
       'certificado_entregas_lectura_propia'
     );
  if n <> 3 then
    raise exception 'Faltan politicas del certificado del estudiante: % de 3', n;
  end if;
end
$bloque$;
