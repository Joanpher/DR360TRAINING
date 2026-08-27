-- ============================================================================
-- 0014 · POS y certificados pagados
-- ============================================================================

set local search_path = public, pg_catalog;

create type tipo_producto_pos as enum ('certificado');
create type estado_venta_pos as enum ('pendiente', 'pagada', 'anulada');
create type estado_certificado as enum ('emitido', 'revocado');
create type canal_entrega_certificado as enum ('impresion', 'correo');

-- El catálogo del POS vive separado del catálogo académico. Así cambiar el
-- precio de un certificado no altera el curso ni sus cargos de inscripción.
create table productos_pos (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid not null references instituciones (id) on delete cascade,
  codigo          text not null,
  nombre          text not null,
  tipo            tipo_producto_pos not null,
  precio          numeric(12,2) not null,
  moneda          char(3) not null default 'DOP',
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint productos_pos_tenant_uk unique (id, institucion_id),
  constraint productos_pos_precio_valido check (precio >= 0),
  constraint productos_pos_codigo_no_vacio check (length(btrim(codigo)) > 0),
  constraint productos_pos_nombre_no_vacio check (length(btrim(nombre)) > 0),
  constraint productos_pos_moneda_valida check (moneda ~ '^[A-Z]{3}$')
);

create unique index productos_pos_codigo_uk
  on productos_pos (institucion_id, upper(codigo));
create unique index productos_pos_tipo_uk
  on productos_pos (institucion_id, tipo);

insert into productos_pos (institucion_id, codigo, nombre, tipo, precio)
select id, 'CERTIFICADO', 'Certificado de finalización', 'certificado', 1500.00
from instituciones
where eliminado_en is null;

-- Cabecera contable del ticket. Los importes y la moneda se congelan al vender:
-- una actualización posterior del producto no reescribe una venta histórica.
create table ventas_pos (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid not null references instituciones (id) on delete cascade,
  numero          bigint not null,
  membresia_id    uuid not null,
  estado          estado_venta_pos not null default 'pendiente',
  subtotal        numeric(12,2) not null,
  total           numeric(12,2) not null,
  moneda          char(3) not null,
  nota            text,
  creada_por      uuid references usuarios (id) on delete set null,
  pagada_en       timestamptz,
  anulada_en      timestamptz,
  motivo_anulacion text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint ventas_pos_tenant_uk unique (id, institucion_id),
  constraint ventas_pos_numero_uk unique (institucion_id, numero),
  constraint ventas_pos_membresia_fk
    foreign key (membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete restrict,
  constraint ventas_pos_montos_validos check (subtotal >= 0 and total >= 0),
  constraint ventas_pos_moneda_valida check (moneda ~ '^[A-Z]{3}$')
);

create index ventas_pos_fecha_ix on ventas_pos (institucion_id, creado_en desc);
create index ventas_pos_estado_ix on ventas_pos (institucion_id, estado);

create table venta_pos_lineas (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid not null references instituciones (id) on delete cascade,
  venta_id        uuid not null,
  producto_id     uuid not null,
  inscripcion_id  uuid not null,
  descripcion     text not null,
  cantidad        smallint not null default 1,
  precio_unitario numeric(12,2) not null,
  total           numeric(12,2) not null,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),

  constraint venta_pos_lineas_tenant_uk unique (id, institucion_id),
  constraint venta_pos_lineas_venta_fk
    foreign key (venta_id, institucion_id)
    references ventas_pos (id, institucion_id) on delete restrict,
  constraint venta_pos_lineas_producto_fk
    foreign key (producto_id, institucion_id)
    references productos_pos (id, institucion_id) on delete restrict,
  constraint venta_pos_lineas_inscripcion_fk
    foreign key (inscripcion_id, institucion_id)
    references inscripciones (id, institucion_id) on delete restrict,
  constraint venta_pos_lineas_cantidad_valida check (cantidad > 0),
  constraint venta_pos_lineas_montos_validos check (precio_unitario >= 0 and total >= 0)
);

create index venta_pos_lineas_venta_ix on venta_pos_lineas (institucion_id, venta_id);
create index venta_pos_lineas_inscripcion_ix on venta_pos_lineas (institucion_id, inscripcion_id);
create unique index venta_pos_lineas_certificado_activo_uk
  on venta_pos_lineas (inscripcion_id, producto_id) where activa;

-- Los cobros del POS no reutilizan pagos/cargos de inscripciones. Son dos cajas
-- distintas y por eso pueden conciliarse y auditarse sin mezclar conceptos.
create table pagos_pos (
  id               uuid primary key default gen_random_uuid(),
  institucion_id   uuid not null references instituciones (id) on delete cascade,
  venta_id         uuid not null,
  monto            numeric(12,2) not null,
  metodo           metodo_pago not null default 'efectivo',
  referencia       text,
  recibido_en      timestamptz not null default now(),
  registrado_por   uuid references usuarios (id) on delete set null,
  nota             text,
  anulado_en       timestamptz,
  motivo_anulacion text,
  creado_en        timestamptz not null default now(),

  constraint pagos_pos_tenant_uk unique (id, institucion_id),
  constraint pagos_pos_venta_fk
    foreign key (venta_id, institucion_id)
    references ventas_pos (id, institucion_id) on delete restrict,
  constraint pagos_pos_monto_positivo check (monto > 0)
);

create index pagos_pos_venta_ix on pagos_pos (institucion_id, venta_id);
create index pagos_pos_fecha_ix on pagos_pos (institucion_id, recibido_en desc);

-- Certificados solo guarda el documento emitido. La prueba de pago es la línea
-- del POS y la relación es única: una inscripción produce un certificado.
create table certificados (
  id                  uuid primary key default gen_random_uuid(),
  institucion_id      uuid not null references instituciones (id) on delete cascade,
  inscripcion_id      uuid not null,
  venta_linea_id      uuid not null,
  numero              bigint not null,
  codigo_verificacion text not null,
  estado              estado_certificado not null default 'emitido',
  emitido_por         uuid references usuarios (id) on delete set null,
  emitido_en          timestamptz not null default now(),
  revocado_por        uuid references usuarios (id) on delete set null,
  revocado_en         timestamptz,
  motivo_revocacion   text,
  creado_en           timestamptz not null default now(),

  constraint certificados_tenant_uk unique (id, institucion_id),
  constraint certificados_numero_uk unique (institucion_id, numero),
  constraint certificados_inscripcion_uk unique (inscripcion_id),
  constraint certificados_venta_linea_uk unique (venta_linea_id),
  constraint certificados_codigo_uk unique (codigo_verificacion),
  constraint certificados_inscripcion_fk
    foreign key (inscripcion_id, institucion_id)
    references inscripciones (id, institucion_id) on delete restrict,
  constraint certificados_venta_linea_fk
    foreign key (venta_linea_id, institucion_id)
    references venta_pos_lineas (id, institucion_id) on delete restrict
);

create index certificados_fecha_ix on certificados (institucion_id, emitido_en desc);

create table certificado_entregas (
  id              uuid primary key default gen_random_uuid(),
  institucion_id  uuid not null references instituciones (id) on delete cascade,
  certificado_id  uuid not null,
  canal           canal_entrega_certificado not null,
  destinatario    text,
  realizado_por   uuid references usuarios (id) on delete set null,
  realizado_en    timestamptz not null default now(),

  constraint certificado_entregas_tenant_uk unique (id, institucion_id),
  constraint certificado_entregas_certificado_fk
    foreign key (certificado_id, institucion_id)
    references certificados (id, institucion_id) on delete restrict
);

create index certificado_entregas_certificado_ix
  on certificado_entregas (institucion_id, certificado_id, realizado_en desc);

-- Conserva las mismas invariantes mecánicas del resto del esquema: el tenant
-- nunca cambia y las cabeceras editables actualizan su marca temporal.
do $bloque$
declare
  t text;
begin
  foreach t in array array['productos_pos', 'ventas_pos'] loop
    execute format(
      'create trigger %I_actualizado before update on %I
         for each row execute function app.tocar_actualizado_en()', t, t);
  end loop;
  foreach t in array array[
    'productos_pos', 'ventas_pos', 'venta_pos_lineas', 'pagos_pos',
    'certificados', 'certificado_entregas'
  ] loop
    execute format(
      'create trigger %I_institucion_inmutable before update on %I
         for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;

-- Aislamiento y gestión exclusivamente administrativa.
do $bloque$
declare
  t text;
begin
  foreach t in array array[
    'productos_pos', 'ventas_pos', 'venta_pos_lineas', 'pagos_pos',
    'certificados', 'certificado_entregas'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$
      create policy %1$I_aislamiento on %1$I
        as restrictive for all to public
        using      (institucion_id = app.institucion_actual() or app.es_superadmin())
        with check (institucion_id = app.institucion_actual() or app.es_superadmin())
    $p$, t);
    execute format($p$
      create policy %1$I_gestion on %1$I
        for all to public
        using      (app.es_admin())
        with check (app.es_admin())
    $p$, t);
  end loop;
end
$bloque$;

grant select, insert, update on
  productos_pos, ventas_pos, venta_pos_lineas, pagos_pos,
  certificados, certificado_entregas
  to educa_app;

-- Ningún movimiento de caja ni certificado emitido se borra físicamente.
revoke delete on
  productos_pos, ventas_pos, venta_pos_lineas, pagos_pos,
  certificados, certificado_entregas
  from educa_app;
