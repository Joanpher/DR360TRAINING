-- ============================================================================
-- 0016 · Foro de curso
-- ============================================================================
--
-- Dos tablas y ni una mas: un tema abre la conversacion y los mensajes la
-- continuan. No hay foros por institucion ni categorias de foro porque la
-- unidad de este producto es el curso, y un tema fuera de un curso no tendria
-- quien lo lea ni politica que lo acote.
--
-- Ni el numero de respuestas ni la ultima actividad se guardan como columna: se
-- calculan al leer, igual que cantidadEntregas en el aula. Un contador
-- desnormalizado necesita un trigger que lo mantenga y una migracion que lo
-- repare el dia que se desincronice, y la lista de temas de un curso nunca es
-- tan larga como para que la cuenta salga cara.

set local search_path = public, pg_catalog;

create table foro_temas (
  id                  uuid        primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  titulo              text        not null,
  cuerpo              text        not null,
  autor_membresia_id  uuid        not null,
  -- Fijado sube el tema al principio de la lista; cerrado impide responder.
  -- Las dos son decisiones de quien imparte, no del autor.
  fijado              boolean     not null default false,
  cerrado             boolean     not null default false,
  editado_en          timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint foro_temas_tenant_uk unique (id, institucion_id),
  constraint foro_temas_curso_tenant_uk unique (id, curso_id, institucion_id),
  constraint foro_temas_curso_fk foreign key (curso_id, institucion_id)
    references cursos (id, institucion_id) on delete cascade,
  constraint foro_temas_autor_fk foreign key (autor_membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint foro_temas_titulo_no_vacio check (length(btrim(titulo)) between 1 and 160),
  constraint foro_temas_cuerpo_no_vacio check (length(btrim(cuerpo)) between 1 and 8000)
);

create table foro_mensajes (
  id                  uuid        primary key default gen_random_uuid(),
  institucion_id      uuid        not null references instituciones (id) on delete cascade,
  curso_id            uuid        not null,
  tema_id             uuid        not null,
  autor_membresia_id  uuid        not null,
  cuerpo              text        not null,
  editado_en          timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint foro_mensajes_tenant_uk unique (id, institucion_id),
  -- Por (tema, curso, institucion) y no solo por tema: asi un mensaje no puede
  -- acabar colgando de un tema de otro curso ni de otro centro.
  constraint foro_mensajes_tema_fk foreign key (tema_id, curso_id, institucion_id)
    references foro_temas (id, curso_id, institucion_id) on delete cascade,
  constraint foro_mensajes_autor_fk foreign key (autor_membresia_id, institucion_id)
    references membresias (id, institucion_id) on delete cascade,
  constraint foro_mensajes_cuerpo_no_vacio check (length(btrim(cuerpo)) between 1 and 8000)
);

create index foro_temas_curso_ix on foro_temas (curso_id, fijado desc, creado_en desc);
create index foro_mensajes_tema_ix on foro_mensajes (tema_id, creado_en);

comment on table foro_temas is 'Conversaciones abiertas dentro de un curso.';
comment on table foro_mensajes is 'Respuestas a un tema del foro del curso.';
comment on column foro_temas.cerrado is 'Cerrado por quien imparte: se sigue leyendo, no se responde.';


-- --- Politicas ---------------------------------------------------------------
--
-- El alcance es el mismo del aula: quien puede ver el curso lee el foro y
-- participa en el; quien lo imparte modera. Se reusan las dos funciones de la
-- 0010 en vez de repetir aqui las subconsultas de instructor e inscripcion.
--
-- Que un tema cerrado no admita respuestas NO se pone aqui a proposito: es una
-- regla de trabajo, no un limite de acceso, y el servicio la comprueba con un
-- mensaje que explica por que. Las politicas se reservan para lo que no debe
-- poder saltarse nadie: de que institucion es la fila, quien la ve y en nombre
-- de quien se escribe.

do $bloque$
declare
  t text;
begin
  foreach t in array array['foro_temas', 'foro_mensajes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format($p$
      create policy %1$I_aislamiento on %1$I
        as restrictive for all to public
        using      (institucion_id = app.institucion_actual() or app.es_superadmin())
        with check (institucion_id = app.institucion_actual() or app.es_superadmin())
    $p$, t);

    execute format($p$
      create policy %1$I_lectura on %1$I
        for select to public
        using (app.puede_ver_curso_aula(curso_id))
    $p$, t);

    -- Se publica en nombre propio y solo donde se tiene entrada. El with check
    -- sobre autor_membresia_id es lo que impide firmar como otra persona.
    execute format($p$
      create policy %1$I_publicar on %1$I
        for insert to public
        with check (
          app.puede_ver_curso_aula(curso_id)
          and autor_membresia_id = app.mi_membresia()
        )
    $p$, t);

    -- Corregir lo propio, sin cambiar de autor ni mudarlo de curso.
    execute format($p$
      create policy %1$I_edicion_propia on %1$I
        for update to public
        using      (autor_membresia_id = app.mi_membresia())
        with check (autor_membresia_id = app.mi_membresia())
    $p$, t);

    execute format($p$
      create policy %1$I_borrado_propio on %1$I
        for delete to public
        using (autor_membresia_id = app.mi_membresia())
    $p$, t);

    /*
      Moderar es editar y borrar lo ajeno, no publicar en su nombre. Por eso
      estas dos y no un `for all`: con `for all`, quien imparte podria insertar
      una fila firmada por un estudiante, que es justo lo que el with check de
      _publicar existe para impedir. Para escribir en el foro, quien modera pasa
      por _publicar como todo el mundo.
    */
    execute format($p$
      create policy %1$I_moderacion on %1$I
        for update to public
        using      (app.puede_gestionar_curso_aula(curso_id))
        with check (app.puede_gestionar_curso_aula(curso_id))
    $p$, t);

    execute format($p$
      create policy %1$I_moderacion_borrado on %1$I
        for delete to public
        using (app.puede_gestionar_curso_aula(curso_id))
    $p$, t);
  end loop;
end
$bloque$;

do $bloque$
declare
  t text;
begin
  foreach t in array array['foro_temas', 'foro_mensajes']
  loop
    execute format('create trigger %I_actualizado before update on %I for each row execute function app.tocar_actualizado_en()', t, t);
    execute format('create trigger %I_institucion_inmutable before update on %I for each row execute function app.institucion_inmutable()', t, t);
  end loop;
end
$bloque$;

grant select, insert, update, delete on foro_temas, foro_mensajes to educa_app;


-- Ninguna tabla puede quedarse fuera de RLS. Ver la 0004 y la 0013: es la
-- comprobacion que caza la tabla nueva a la que se le olvido la politica.
do $bloque$
declare
  v_sin_rls text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_sin_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'auditoria')
     and c.relkind = 'r'
     and not c.relrowsecurity;
  if v_sin_rls is not null then
    raise exception 'estas tablas quedaron sin row level security: %', v_sin_rls;
  end if;
end
$bloque$;
