-- ============================================================================
-- 0006 · Los pagos no se borran
-- ----------------------------------------------------------------------------
-- La 0003 decia esto, y la 0004 lo repitio:
--
--   -- Los pagos no se borran: se anulan. Quitarle el delete al rol de la
--   -- aplicacion hace que un error de programacion tampoco pueda hacerlo.
--   grant select, insert, update on pagos to educa_app;
--
-- El comentario era cierto y el grant era correcto, pero juntos no hacian nada.
-- La 0001 termina con:
--
--   alter default privileges in schema public
--     grant select, insert, update, delete on tables to educa_app;
--
-- Toda tabla creada despues por el mismo dueno nace ya con los cuatro permisos.
-- Conceder tres de ellos otra vez no quita el cuarto: no hay forma de "conceder
-- menos". Asi que educa_app llevaba desde la 0003 pudiendo borrar recibos, con
-- dos migraciones afirmando por escrito que no.
--
-- Es el fallo mas incomodo de los tres que salieron en la revision de la 0004,
-- porque no rompe nada y no da error: solo convierte en decorativa una garantia
-- contable que el codigo daba por buena.
--
-- Se arregla revocando de verdad. El resto de tablas si quiere sus cuatro
-- permisos, asi que las default privileges se quedan como estan.
-- ============================================================================

revoke delete on pagos from educa_app;

comment on table pagos is
  'Un pago recibido contra un cargo. Se anula, no se borra: educa_app no tiene delete sobre esta tabla (ver 0006).';
