#!/usr/bin/env node
/*
  Runner de migraciones de educa.

  Un archivo .sql por migracion, aplicado una sola vez, dentro de una
  transaccion, con el resto de procesos esperando en un lock. Nada mas: las
  migraciones son SQL puro porque las politicas de RLS, los grants por columna
  y las funciones SECURITY DEFINER son justo lo que ningun ORM sabe versionar.

    node db/migrar.mjs            aplica lo pendiente
    node db/migrar.mjs estado     que hay aplicado y que falta
    node db/migrar.mjs abajo --si revierte la ultima (usa el .down.sql)
    node db/migrar.mjs nueva <nombre>
    node db/migrar.mjs sellar <archivo.sql>   marca como aplicada sin ejecutarla

  Conexion: DATABASE_URL, o las PGHOST/PGUSER/... de siempre. Se lee tambien un
  .env en la raiz del backend, sin dependencias.
*/

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const AQUI = dirname(fileURLToPath(import.meta.url))
const DIR_MIGRACIONES = join(AQUI, 'migrations')
const RAIZ = join(AQUI, '..')
const LLAVE_LOCK = 0x65647563 // 'educ'

const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s)
const ok = (s) => color(32, s)
const mal = (s) => color(31, s)
const tenue = (s) => color(90, s)

function cargarEnv() {
  const ruta = join(RAIZ, '.env')
  if (!existsSync(ruta)) return
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const corte = limpia.indexOf('=')
    if (corte < 1) continue
    const clave = limpia.slice(0, corte).trim()
    let valor = limpia.slice(corte + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    if (process.env[clave] === undefined) process.env[clave] = valor
  }
}

function huella(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex').slice(0, 16)
}

function listarArchivos() {
  return readdirSync(DIR_MIGRACIONES)
    .filter((n) => n.endsWith('.sql') && !n.endsWith('.down.sql'))
    .sort()
    .map((nombre) => {
      const sql = readFileSync(join(DIR_MIGRACIONES, nombre), 'utf8')
      return { nombre, sql, hash: huella(sql) }
    })
}

async function prepararLedger(cliente) {
  await cliente.query('create schema if not exists app')
  await cliente.query(`
    create table if not exists app.migraciones (
      id          integer generated always as identity primary key,
      nombre      text        not null unique,
      hash        text        not null,
      duracion_ms integer     not null,
      aplicada_en timestamptz not null default now()
    )
  `)
}

async function aplicadas(cliente) {
  const { rows } = await cliente.query(
    'select nombre, hash, aplicada_en from app.migraciones order by nombre',
  )
  return new Map(rows.map((r) => [r.nombre, r]))
}

async function conectar() {
  cargarEnv()
  const cliente = new pg.Client(
    process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
        }
      : {},
  )
  await cliente.connect()
  const { rows } = await cliente.query('select current_database() as db, current_user as usuario')
  console.log(tenue(`${rows[0].usuario}@${rows[0].db}`))
  return cliente
}

async function arriba() {
  const cliente = await conectar()
  try {
    await cliente.query('select pg_advisory_lock($1)', [LLAVE_LOCK])
    await prepararLedger(cliente)
    const yaEstan = await aplicadas(cliente)

    // Una migracion editada despues de aplicada deja la base y el repositorio
    // contando historias distintas. Mejor parar aqui.
    for (const m of listarArchivos()) {
      const previa = yaEstan.get(m.nombre)
      if (previa && previa.hash !== m.hash) {
        throw new Error(
          `${m.nombre} cambio despues de aplicarse (${previa.hash} -> ${m.hash}). ` +
            'Escribe una migracion nueva en vez de editar una ya aplicada.',
        )
      }
    }

    const pendientes = listarArchivos().filter((m) => !yaEstan.has(m.nombre))
    if (pendientes.length === 0) {
      console.log(ok('Todo al dia.'))
      return
    }

    for (const m of pendientes) {
      const enTransaccion = !/^--\s*sin-transaccion/m.test(m.sql)
      const inicio = Date.now()
      process.stdout.write(`  ${m.nombre} ... `)
      try {
        if (enTransaccion) await cliente.query('begin')
        await cliente.query(m.sql)
        const ms = Date.now() - inicio
        await cliente.query(
          'insert into app.migraciones (nombre, hash, duracion_ms) values ($1, $2, $3)',
          [m.nombre, m.hash, ms],
        )
        if (enTransaccion) await cliente.query('commit')
        console.log(ok(`ok ${ms} ms`))
      } catch (e) {
        if (enTransaccion) await cliente.query('rollback').catch(() => {})
        console.log(mal('fallo'))
        throw e
      }
    }
    console.log(ok(`\n${pendientes.length} migracion(es) aplicada(s).`))
  } finally {
    await cliente.query('select pg_advisory_unlock($1)', [LLAVE_LOCK]).catch(() => {})
    await cliente.end()
  }
}

async function estado() {
  const cliente = await conectar()
  try {
    await prepararLedger(cliente)
    const yaEstan = await aplicadas(cliente)
    const archivos = listarArchivos()
    if (archivos.length === 0) console.log(tenue('  (sin migraciones)'))
    for (const m of archivos) {
      const previa = yaEstan.get(m.nombre)
      if (!previa) {
        console.log(`  ${tenue('pendiente')}  ${m.nombre}`)
      } else if (previa.hash !== m.hash) {
        console.log(`  ${mal('alterada ')}  ${m.nombre}  ${tenue(previa.hash + ' -> ' + m.hash)}`)
      } else {
        const fecha = previa.aplicada_en.toISOString().slice(0, 16).replace('T', ' ')
        console.log(`  ${ok('aplicada ')}  ${m.nombre}  ${tenue(fecha)}`)
      }
    }
    for (const nombre of yaEstan.keys()) {
      if (!archivos.some((m) => m.nombre === nombre)) {
        console.log(`  ${mal('huerfana')}  ${nombre}  ${tenue('aplicada pero ya no esta en el repositorio')}`)
      }
    }
  } finally {
    await cliente.end()
  }
}

async function abajo() {
  if (!process.argv.includes('--si')) {
    console.log(mal('Revertir borra datos. Repite el comando con --si para confirmarlo.'))
    process.exitCode = 1
    return
  }
  const cliente = await conectar()
  try {
    await cliente.query('select pg_advisory_lock($1)', [LLAVE_LOCK])
    await prepararLedger(cliente)
    const { rows } = await cliente.query(
      'select nombre from app.migraciones order by nombre desc limit 1',
    )
    if (rows.length === 0) {
      console.log(tenue('No hay nada que revertir.'))
      return
    }
    const nombre = rows[0].nombre
    const rutaDown = join(DIR_MIGRACIONES, nombre.replace(/\.sql$/, '.down.sql'))
    if (!existsSync(rutaDown)) throw new Error(`falta ${rutaDown}`)

    await cliente.query('begin')
    try {
      await cliente.query(readFileSync(rutaDown, 'utf8'))
      await cliente.query('delete from app.migraciones where nombre = $1', [nombre])
      await cliente.query('commit')
      console.log(ok(`Revertida ${nombre}.`))
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    }
  } finally {
    await cliente.query('select pg_advisory_unlock($1)', [LLAVE_LOCK]).catch(() => {})
    await cliente.end()
  }
}

/*
  Sellar: registrar una migracion como aplicada sin ejecutarla. Hace falta
  cuando el esquema se creo por fuera del runner (a mano, en un cliente SQL) y
  hay que poner al dia el ledger sin volver a correr el SQL sobre datos vivos.
  Comprobar antes que la base y el archivo dicen lo mismo es responsabilidad de
  quien lo usa: esto solo anota.
*/
async function sellar() {
  const nombre = process.argv[3]
  if (!nombre) throw new Error('uso: node db/migrar.mjs sellar <archivo.sql>')
  const m = listarArchivos().find((x) => x.nombre === nombre)
  if (!m) throw new Error(`no existe migrations/${nombre}`)

  const cliente = await conectar()
  try {
    await prepararLedger(cliente)
    const { rowCount } = await cliente.query(
      `insert into app.migraciones (nombre, hash, duracion_ms) values ($1, $2, 0)
       on conflict (nombre) do nothing`,
      [m.nombre, m.hash],
    )
    if (rowCount === 0) console.log(tenue(`${m.nombre} ya estaba registrada.`))
    else console.log(ok(`Sellada ${m.nombre} (${m.hash}) sin ejecutarla.`))
  } finally {
    await cliente.end()
  }
}

function nueva() {
  const nombre = process.argv[3]
  if (!nombre) throw new Error('uso: node db/migrar.mjs nueva <nombre_en_snake_case>')
  const ultimo = listarArchivos().at(-1)
  const numero = String((ultimo ? Number(ultimo.nombre.slice(0, 4)) : 0) + 1).padStart(4, '0')
  const base = `${numero}_${nombre.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`
  const cabecera = (t) => `-- ============================================================================\n-- ${numero} · ${t}\n-- ============================================================================\n\n`
  writeFileSync(join(DIR_MIGRACIONES, `${base}.sql`), cabecera(nombre), 'utf8')
  writeFileSync(join(DIR_MIGRACIONES, `${base}.down.sql`), cabecera(`Reversion de ${nombre}`), 'utf8')
  console.log(ok(`Creadas migrations/${base}.sql y migrations/${base}.down.sql`))
}

const comandos = { up: arriba, arriba, estado, abajo, down: abajo, nueva, sellar }
const comando = comandos[process.argv[2] ?? 'up']

if (!comando) {
  console.error(mal(`comando desconocido: ${process.argv[2]}`))
  console.error('usa: up | estado | abajo --si | nueva <nombre> | sellar <archivo.sql>')
  process.exit(1)
}

try {
  await comando()
} catch (e) {
  console.error(mal(`\n${e.message}`))
  if (e.detail) console.error(tenue(e.detail))
  if (e.hint) console.error(tenue(`pista: ${e.hint}`))
  if (e.position) console.error(tenue(`posicion: ${e.position}`))
  process.exit(1)
}
