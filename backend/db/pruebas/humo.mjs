/*
  Prueba de humo del flujo de cursos, con el rol de negocio (educa_app) y el
  mismo contrato que usa el backend: transaccion, contexto fijado y confiar en
  RLS para el aislamiento.

    node db/pruebas/humo.mjs      (o: npm run db:humo)

  Existe ademas de db/pruebas/rls.sql y no en su lugar. Aquella comprueba el
  aislamiento entre instituciones rol por rol, pero esta escrita con
  metacomandos de psql y no corre donde psql no este instalado. Esta solo
  necesita node y el driver pg, que ya son dependencias del backend.

  Levanta una institucion de usar y tirar, recorre el flujo entero -categoria,
  curso, horario, alta de la persona, inscripcion, cargo, pago- y termina en
  rollback. Al final borra el tenant de prueba: no deja ni una fila.

  Las tres comprobaciones que no son obvias, y que estan aqui porque cada una
  destapo un fallo real:

    · contadores tiene RLS       (la 0003 lo dejo sin politicas)
    · app.crear_alumno() existe  (un insert ... returning no pasa usuarios_lectura)
    · no se pueden borrar pagos  (las default privileges concedian el delete)
*/
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function cargarEnv() {
  const ruta = join(RAIZ, '.env')
  if (!existsSync(ruta)) throw new Error('falta .env')
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const l = linea.trim()
    if (!l || l.startsWith('#')) continue
    const corte = l.indexOf('=')
    if (corte < 1) continue
    let v = l.slice(corte + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    process.env[l.slice(0, corte).trim()] ??= v
  }
}

let fallos = 0
function afirmar(condicion, texto) {
  console.log(`${condicion ? '  ok  ' : ' FALLO'}  ${texto}`)
  if (!condicion) fallos++
}

cargarEnv()

// --- 1. Comprobaciones de esquema, con el usuario maestro -------------------
const maestro = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await maestro.connect()

const { rows: tablas } = await maestro.query(`
  select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forzado
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by c.relname
`)
const nombres = tablas.map((t) => t.relname)
console.log('\nTablas en public:\n  ' + nombres.join(', ') + '\n')

for (const t of ['categorias', 'cursos', 'curso_horarios', 'participantes',
                 'inscripciones', 'cargos', 'pagos', 'contadores']) {
  afirmar(nombres.includes(t), `existe ${t}`)
}
for (const t of ['grados', 'secciones', 'asignaturas', 'anos_escolares', 'plan_estudio',
                 'representantes', 'estudiantes', 'conceptos_cobro', 'unidades_academicas',
                 'periodos_calificacion', 'curso_estudiantes', 'estudiante_representantes']) {
  afirmar(!nombres.includes(t), `ya no existe ${t}`)
}
afirmar(tablas.every((t) => t.rls), 'todas las tablas tienen RLS activo')
afirmar(
  tablas.find((t) => t.relname === 'contadores')?.rls === true,
  'contadores tiene RLS (la fuga de la 0003 cerrada)',
)

const { rows: modalidad } = await maestro.query(
  `select 1 from information_schema.columns
    where table_name = 'instituciones' and column_name = 'modalidad'`,
)
afirmar(modalidad.length === 0, 'instituciones.modalidad eliminada')

// Un tenant de usar y tirar para la prueba.
await maestro.query('begin')
const { rows: u } = await maestro.query(
  `insert into usuarios (correo, nombres, apellidos, estado)
   values ('humo.' || gen_random_uuid() || '@ejemplo.test', 'Prueba', 'De Humo', 'activo')
   returning id`,
)
const usuarioId = u[0].id
await maestro.query(`select set_config('app.usuario_id', $1, true)`, [usuarioId])
const { rows: inst } = await maestro.query(
  `select * from app.crear_institucion('Centro de Humo'::text,
     ('humo-' || substr(md5(random()::text),1,8))::citext, 'CDH'::text)`,
)
const institucionId = inst[0].institucion_id ?? inst[0].id
await maestro.query('commit')
console.log(`\nTenant de prueba: ${institucionId}\n`)

// --- 2. El flujo completo, con el rol de negocio ----------------------------
const app = new pg.Client({
  connectionString: process.env.DATABASE_URL_APP,
  ssl: { rejectUnauthorized: false },
})
await app.connect()

try {
  await app.query('begin')
  await app.query(`select set_config('app.usuario_id', $1, true)`, [usuarioId])
  await app.query(`select set_config('app.institucion_id', $1, true)`, [institucionId])

  const { rows: cat } = await app.query(
    `insert into categorias (institucion_id, nombre, color) values ($1, 'Idiomas', '#2f6f4e')
     returning id`,
    [institucionId],
  )
  afirmar(!!cat[0].id, 'crea una categoria')

  // El personal se crea directamente; estudiante sigue siendo consecuencia de
  // una inscripcion y la funcion de usuarios no puede fabricarlo a mano.
  const { rows: personal } = await app.query(
    `select usuario_id, membresia_id, es_usuario_nuevo
       from app.crear_usuario_institucional($1, $2, $3::citext, $4, $5, $6)`,
    ['Elena', 'Santos', `instructor.${institucionId}@ejemplo.test`, null, 'EMP-HUMO', 'docente'])
  afirmar(personal[0]?.es_usuario_nuevo === true, 'registra directamente un instructor')

  const { rows: rolPersonal } = await app.query(
    `select rol::text from membresia_roles where membresia_id = $1`,
    [personal[0].membresia_id])
  afirmar(rolPersonal[0]?.rol === 'docente', 'asigna el rol instructor solicitado')

  let estudianteManual = false
  try {
    await app.query('savepoint usuario_estudiante')
    await app.query(
      `select * from app.crear_usuario_institucional($1, $2, $3::citext, $4, $5, $6)`,
      ['Alumno', 'Incorrecto', `alumno.${institucionId}@ejemplo.test`, null, null, 'estudiante'])
    await app.query('release savepoint usuario_estudiante')
  } catch {
    estudianteManual = true
    await app.query('rollback to savepoint usuario_estudiante')
  }
  afirmar(estudianteManual, 'rechaza asignar estudiante desde usuarios')

  const { rows: curso } = await app.query(
    `insert into cursos (institucion_id, codigo, nombre, categoria_id, precio,
                         duracion_horas, cupo, estado)
     values ($1, 'ING-101', 'Ingles Basico', $2, 4500.00, 40, 2, 'activo')
     returning id, precio::text as precio`,
    [institucionId, cat[0].id],
  )
  const cursoId = curso[0].id
  afirmar(curso[0].precio === '4500.00', 'el precio se guarda exacto (4500.00)')

  await app.query(
    `insert into curso_horarios (institucion_id, curso_id, dia_semana, hora_inicio, hora_fin)
     values ($1, $2, 1, '18:00', '20:00'), ($1, $2, 3, '18:00', '20:00')`,
    [institucionId, cursoId],
  )
  const { rows: h } = await app.query(
    `select count(*)::int as n from curso_horarios where curso_id = $1`, [cursoId])
  afirmar(h[0].n === 2, 'guarda dos bloques de horario')

  let solapa = false
  try {
    await app.query('savepoint s1')
    await app.query(
      `insert into curso_horarios (institucion_id, curso_id, dia_semana, hora_inicio, hora_fin)
       values ($1, $2, 1, '18:00', '19:00')`, [institucionId, cursoId])
    await app.query('release savepoint s1')
  } catch {
    solapa = true
    await app.query('rollback to savepoint s1')
  }
  afirmar(solapa, 'rechaza dos bloques que empiezan a la misma hora el mismo dia')

  // --- La matricula sale del contador atomico ---
  const { rows: n1 } = await app.query(
    `select app.siguiente_numero($1, 'matricula:2026') as v`, [institucionId])
  const { rows: n2 } = await app.query(
    `select app.siguiente_numero($1, 'matricula:2026') as v`, [institucionId])
  afirmar(n1[0].v === 1 && n2[0].v === 2, 'el contador de matriculas avanza de uno en uno')

  // --- Alta de la persona + inscripcion + cargo ---
  // El camino real: la funcion SECURITY DEFINER de la 0005. Un insert directo
  // con "returning" aqui choca con usuarios_lectura, que es el bug que esta
  // prueba destapo.
  const { rows: alta } = await app.query(
    `select usuario_id, membresia_id from app.crear_alumno($1, $2, $3::citext, $4, $5)`,
    ['Carla', 'Mendez', null, '809-555-0100', 'CDH-2026-0001'])
  const membresiaId = alta[0].membresia_id
  afirmar(!!alta[0].usuario_id && !!membresiaId, 'app.crear_alumno() da de alta a la persona')

  const { rows: rolAlumno } = await app.query(
    `select rol::text from membresia_roles where membresia_id = $1`, [membresiaId])
  afirmar(rolAlumno[0]?.rol === 'estudiante', 'nace con rol de estudiante')

  const { rows: matri } = await app.query(
    `select codigo from membresias where id = $1`, [membresiaId])
  afirmar(matri[0].codigo === 'CDH-2026-0001', 'la matricula queda en la membresia')
  await app.query(
    `insert into participantes (membresia_id, institucion_id, documento, telefono)
     values ($1, $2, '001-1234567-8', '809-555-0100')`,
    [membresiaId, institucionId])

  const { rows: insc } = await app.query(
    `insert into inscripciones (institucion_id, curso_id, membresia_id, precio, descuento)
     values ($1, $2, $3, 4500.00, 500.00) returning id`,
    [institucionId, cursoId, membresiaId])
  const inscripcionId = insc[0].id
  afirmar(!!inscripcionId, 'inscribe a la persona en el curso')

  let duplicada = false
  try {
    await app.query('savepoint s2')
    await app.query(
      `insert into inscripciones (institucion_id, curso_id, membresia_id, precio)
       values ($1, $2, $3, 4500.00)`, [institucionId, cursoId, membresiaId])
    await app.query('release savepoint s2')
  } catch {
    duplicada = true
    await app.query('rollback to savepoint s2')
  }
  afirmar(duplicada, 'no deja inscribir dos veces a la misma persona en el mismo curso')

  // --- Aula: entrega del estudiante y calificacion del instructor -----------
  const { rows: aula } = await app.query(
    `insert into aulas_curso (institucion_id, curso_id, titulo)
     values ($1, $2, 'Aula ING-101') returning id`,
    [institucionId, cursoId])
  const { rows: semana } = await app.query(
    `insert into aula_semanas (institucion_id, curso_id, aula_id, numero, titulo)
     values ($1, $2, $3, 1, 'Semana 1') returning id`,
    [institucionId, cursoId, aula[0].id])
  const { rows: tarea } = await app.query(
    `insert into aula_tareas (institucion_id, curso_id, semana_id, titulo, puntos)
     values ($1, $2, $3, 'Ensayo final', 100) returning id`,
    [institucionId, cursoId, semana[0].id])

  await app.query(`select set_config('app.usuario_id', $1, true)`, [alta[0].usuario_id])
  const { rows: entrega } = await app.query(
    `insert into aula_entregas
       (institucion_id, curso_id, tarea_id, membresia_id, comentario)
     values ($1, $2, $3, app.mi_membresia(), 'Mi ensayo') returning id`,
    [institucionId, cursoId, tarea[0].id])
  afirmar(!!entrega[0]?.id, 'el estudiante envia su tarea')

  await app.query(`select set_config('app.usuario_id', $1, true)`, [usuarioId])
  await app.query(`select app.calificar_entrega($1, 87.5, 'Buen trabajo')`, [entrega[0].id])

  await app.query(`select set_config('app.usuario_id', $1, true)`, [alta[0].usuario_id])
  const { rows: nota } = await app.query(
    `select calificacion::text as calificacion, retroalimentacion
       from aula_entregas where id = $1`,
    [entrega[0].id])
  afirmar(
    nota[0]?.calificacion === '87.50' && nota[0]?.retroalimentacion === 'Buen trabajo',
    'el estudiante ve su calificacion y retroalimentacion',
  )

  let cambiaCalificada = false
  try {
    await app.query('savepoint entrega_calificada')
    const cambio = await app.query(
      `update aula_entregas set comentario = 'Intento cambiarla'
        where id = $1 returning id`,
      [entrega[0].id])
    cambiaCalificada = cambio.rowCount > 0
    await app.query('release savepoint entrega_calificada')
  } catch {
    cambiaCalificada = false
    await app.query('rollback to savepoint entrega_calificada')
  }
  afirmar(!cambiaCalificada, 'una entrega calificada queda bloqueada para el estudiante')

  // Las operaciones administrativas que siguen necesitan recuperar al propietario.
  await app.query(`select set_config('app.usuario_id', $1, true)`, [usuarioId])

  let descuentoAbusivo = false
  try {
    await app.query('savepoint s3')
    await app.query(`update inscripciones set descuento = 9999 where id = $1`, [inscripcionId])
    await app.query('release savepoint s3')
  } catch {
    descuentoAbusivo = true
    await app.query('rollback to savepoint s3')
  }
  afirmar(descuentoAbusivo, 'el descuento no puede pasar del precio')

  const { rows: cargo } = await app.query(
    `insert into cargos (institucion_id, inscripcion_id, descripcion, monto)
     values ($1, $2, 'ING-101 · Ingles Basico', 4000.00) returning id`,
    [institucionId, inscripcionId])
  const cargoId = cargo[0].id

  await app.query(
    `insert into pagos (institucion_id, cargo_id, monto, metodo) values ($1, $2, 2000.00, 'efectivo')`,
    [institucionId, cargoId])

  const { rows: cuenta } = await app.query(
    `select (i.precio - i.descuento)::text as total,
            coalesce(sum(g.monto), 0)::text as facturado,
            coalesce((select sum(p.monto) from pagos p where p.cargo_id = g.id), 0)::text as pagado
       from inscripciones i join cargos g on g.inscripcion_id = i.id
      where i.id = $1 group by i.precio, i.descuento, g.id`,
    [inscripcionId])
  afirmar(cuenta[0].total === '4000.00', 'total = precio - descuento (4000.00)')
  afirmar(cuenta[0].pagado === '2000.00', 'el abono parcial queda registrado (2000.00)')

  let borrable = true
  try {
    await app.query('savepoint s4')
    await app.query(`delete from pagos where id is not null`)
    await app.query('release savepoint s4')
  } catch {
    borrable = false
    await app.query('rollback to savepoint s4')
  }
  afirmar(!borrable, 'el rol de negocio no puede borrar pagos')

  await app.query('rollback')
  console.log('\n(rollback: no queda ni una fila de la prueba)')
} catch (e) {
  await app.query('rollback').catch(() => {})
  console.error('\nERROR EN EL FLUJO:', e.message)
  fallos++
} finally {
  await app.end()
}

// Limpia el tenant de prueba.
await maestro.query('delete from instituciones where id = $1', [institucionId])
await maestro.query('delete from usuarios where id = $1', [usuarioId])
await maestro.end()

console.log(fallos === 0 ? '\nTODO OK\n' : `\n${fallos} FALLO(S)\n`)
process.exit(fallos === 0 ? 0 : 1)
