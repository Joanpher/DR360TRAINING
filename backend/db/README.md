# Base de datos de DR360TRAINING

PostgreSQL, un solo esquema compartido por todas las instituciones y **Row Level
Security** como frontera entre ellas. Las migraciones son SQL puro: las
politicas, los grants por columna y las funciones `SECURITY DEFINER` son
exactamente lo que ningun ORM sabe versionar.

```
db/
  migrar.mjs                          runner (sin mas dependencia que pg)
  migrations/
    0001_nucleo_multitenant.sql       tenancy, identidad, RLS
    0002_estructura_escolar.sql       modelo de colegio  · revertido por la 0004
    0003_inscripcion_y_cobros.sql     matricula y cobros · revertido por la 0004
    0004_catalogo_de_cursos.sql       el modelo actual: cursos e inscripcion
    0005_alta_de_alumno.sql           app.crear_alumno()
    0006_pagos_no_se_borran.sql       revoca el delete sobre pagos
  pruebas/
    rls.sql                           comprobaciones de aislamiento (necesita psql)
    humo.mjs                          el flujo entero de punta a punta (solo node)
  reconciliacion_0001.sql             script de un solo uso, ya aplicado
  reinicio_datos.sql                  script de un solo uso, borra datos de prueba
```

Las migraciones 0002 y 0003 describian un colegio -grados, secciones, plan de
estudio, representantes, mensualidades-. La **0004** cambio el producto: ahora
esto es para centros que venden cursos sueltos, y esas tablas se fueron. Estan
en el repositorio porque el ledger las tiene aplicadas y porque explican de
donde viene la forma de lo que quedo, no porque sigan vivas.

`reconciliacion_0001.sql` no es una migracion: la base `educa` se creo
ejecutando 0001 a mano en un cliente SQL, antes de que el archivo recibiera tres
cambios. Ese script aplico solo la diferencia y despues se sello el ledger con
`node db/migrar.mjs sellar 0001_nucleo_multitenant.sql`. Se conserva como
registro de lo que paso; no hay que volver a correrlo.

## Pruebas

Dos, y hacen cosas distintas.

**El flujo completo**, que solo necesita node:

```bash
npm run db:humo
```

Levanta una institucion de usar y tirar, la recorre entera -categoria, curso,
horario, alta de la persona con `app.crear_alumno()`, inscripcion, cargo, pago
parcial- y termina en rollback. Comprueba de paso las tres cosas que fallaron en
silencio antes de la 0004: que `contadores` tiene RLS, que dar de alta a alguien
pasa por la funcion y no por un `insert ... returning`, y que el rol de negocio
no puede borrar un pago.

**El aislamiento entre instituciones**, que necesita `psql`:

```bash
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f db/pruebas/rls.sql
```

Levanta dos instituciones con sus usuarios y comprueba, rol por rol, que lo
permitido pasa y lo prohibido falla: que una institucion no ve la otra, que
falsificar el contexto no abre nada, que sin contexto no se ve nada, que una
estudiante no puede crear sedes ni ascenderse, que nadie se hace superadmin,
que la bitacora no se borra. Termina en `rollback` y no deja rastro.

Conviene volver a correr los dos cada vez que se anadan tablas o politicas: un
fallo de RLS no rompe nada, solo devuelve filas de otra institucion en silencio.

## Comandos

```bash
npm run db:estado     # que hay aplicado y que falta
npm run db:migrar     # aplica lo pendiente
npm run db:humo       # prueba el flujo entero contra la base
npm run db:abajo -- --si          # revierte la ultima (solo desarrollo)
npm run db:nueva -- certificados  # crea 0007_certificados.sql
```

Cada archivo se aplica una sola vez, dentro de una transaccion y bajo un
advisory lock. El runner guarda el hash de lo aplicado: si alguien edita una
migracion ya aplicada, el siguiente `db:migrar` se detiene en vez de dejar la
base y el repositorio contando historias distintas. Lo que ya se aplico no se
edita; se corrige con una migracion nueva.

## Primera puesta en marcha

```bash
cp .env.example .env        # y pon ahi la DATABASE_URL del usuario maestro
npm run db:migrar
```

La migracion crea los dos roles de conexion sin contrasena. Con el usuario
maestro, en la base `educa`:

```sql
alter role educa_app  with password '...';
alter role educa_auth with password '...';
```

## Los dos roles

| Rol | Lo usa | Puede |
|---|---|---|
| `educa_app` | todo el trafico de negocio | lo que dejen las politicas, siempre con contexto fijado |
| `educa_auth` | solo el modulo de autenticacion | identidad: login, registro, refresco, reseteo, aceptar invitacion |

`educa_auth` existe porque el login ocurre **antes** de que haya usuario o
institucion en el contexto: sin un rol aparte, habria que abrir un agujero en
las politicas de `usuarios` para todo el mundo. Ninguno de los dos puede
escribir `usuarios.es_superadmin`: no esta en ningun grant de columna.

## El contrato con el backend

Toda consulta de negocio va dentro de una transaccion que empieza fijando el
contexto. La aplicacion **nunca** filtra por institucion a mano.

```ts
const cliente = await poolApp.connect()
try {
  await cliente.query('begin')
  await cliente.query('select set_config($1, $2, true)', ['app.usuario_id', usuarioId])
  await cliente.query('select set_config($1, $2, true)', ['app.institucion_id', institucionId])

  // A partir de aqui, "select * from cursos" ya solo ve los de esa institucion.
  const { rows } = await cliente.query('select * from membresias')

  await cliente.query('commit')
} catch (e) {
  await cliente.query('rollback')
  throw e
} finally {
  cliente.release()
}
```

El tercer parametro de `set_config` en `true` hace la variable local a la
transaccion: al terminar muere con ella y no contamina la siguiente peticion que
reutilice esa conexion del pool. **Si se olvida, el contexto se filtra entre
usuarios distintos**; por eso conviene que esto viva en un unico interceptor de
NestJS y no se escriba a mano en cada servicio.

Sin contexto, las funciones `app.usuario_actual()` y `app.institucion_actual()`
devuelven `null` y las politicas no dejan pasar nada. Ese es el estado seguro
por defecto.

## Funciones de contexto

| Funcion | Devuelve |
|---|---|
| `app.usuario_actual()` | usuario de la peticion |
| `app.institucion_actual()` | institucion activa |
| `app.es_miembro(institucion)` | pertenencia activa |
| `app.tiene_rol('docente', ...)` | alguno de esos roles en la institucion del contexto |
| `app.es_admin()` | propietario, administrador o superadmin |
| `app.es_superadmin()` | personal de la plataforma |
| `app.crear_institucion(nombre, slug, ...)` | alta de tenant completa |
| `app.crear_alumno(nombres, apellidos, ...)` | alta de persona + membresia + rol |
| `app.siguiente_numero(institucion, clave)` | siguiente valor de un contador, atomico |

## Onboarding

`instituciones` no tiene politica de `insert`. Crear un tenant pasa siempre por
`app.crear_institucion()`, que en una sola transaccion crea la institucion, la
membresia y el rol `propietario`. Es la respuesta al huevo y la gallina del
multi-tenant: para escribir en una institucion hay que ser administrador de
ella, pero el primer administrador no existe hasta que la institucion existe.

```sql
begin;
select set_config('app.usuario_id', '<uuid del usuario recien registrado>', true);
select * from app.crear_institucion('Instituto Tecnico del Caribe', 'itc', 'ITC');
commit;
```

Toma el usuario del contexto, no de un parametro: nadie puede crear una
institucion a nombre de otro.

## Alta de alumno

`app.crear_alumno()` existe por la misma razon y resuelve el mismo tipo de
problema. Para inscribir a alguien nuevo hay que crearle la cuenta, y ese
`insert into usuarios ... returning id` no pasa: con RLS, un insert que devuelve
filas tiene que pasar tambien las politicas de select, y `usuarios_lectura` solo
deja ver a quien comparte institucion contigo. La persona recien creada no
comparte ninguna hasta la linea siguiente, cuando se inserta su membresia.

```sql
begin;
select set_config('app.usuario_id', '<uuid de quien administra>', true);
select set_config('app.institucion_id', '<uuid de la institucion>', true);
select * from app.crear_alumno('Carla', 'Mendez', null, '809-555-0100', 'CDH-2026-0001');
commit;
```

Comprueba `app.es_admin()` por su cuenta, porque al ser `SECURITY DEFINER` se
salta las politicas que lo harian por ella. No pone la clave: eso sigue siendo
territorio de `educa_auth`.

## Anadir tablas en las proximas migraciones

Toda tabla de negocio lleva:

1. `institucion_id uuid not null references instituciones (id) on delete cascade`
2. `unique (id, institucion_id)`, para que las claves foraneas hacia ella sean
   compuestas y la base rechace por si sola una referencia que cruce tenants
3. `institucion_id` como primera columna de los indices
4. `enable row level security` **y** `force row level security`
5. la politica restrictiva de aislamiento, mas las permisivas de lectura y
   escritura
6. los triggers `_actualizado` e `_institucion_inmutable`

La migracion 0001 termina comprobando que no quede ninguna tabla sin RLS y
falla si la hay: una tabla nueva sin politicas es una fuga entre instituciones
que nadie nota hasta que es tarde.

`force row level security` se omite solo en las tablas que leen o escriben las
funciones `SECURITY DEFINER` (`usuarios`, `membresias`, `membresia_roles`,
`instituciones`, `auditoria.eventos`); con FORCE, evaluar una politica invocaria
a la funcion que evalua esa misma politica.
