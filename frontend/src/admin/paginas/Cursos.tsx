import { useMemo, useState } from 'react'
import { BookOpen, Plus, TriangleAlert } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { AreaTexto } from '../../ui/AreaTexto'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { cn } from '../../ui/cn'
import {
  BarraFiltros,
  Cifras,
  EncabezadoPagina,
  EstadoDeCurso,
  FiltroSelect,
  MenuFila,
  PieDeTabla,
} from '../piezas'
import { cursosAdmin, periodos, personas, programas, type CursoAdmin } from '../datos'

/*
  Un curso en Educa no es una asignatura: es una asignatura impartida por
  alguien, en un periodo, con un cupo. La misma "Desarrollo de Aplicaciones
  Web" son dos cursos distintos si hay dos secciones, y por eso la columna de
  codigo lleva siempre la seccion pegada.

  Un curso sin docente es el problema mas caro de esta pantalla -nadie puede
  inscribirse, nadie puede publicar material-, asi que no se dibuja como una
  celda vacia sino como una alerta con su boton al lado.
*/
export function Cursos() {
  const [texto, setTexto] = useState('')
  const [periodo, setPeriodo] = useState(
    periodos.find((p) => p.estado === 'activo')?.codigo ?? 'todos',
  )
  const [programa, setPrograma] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [creando, setCreando] = useState(false)

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return cursosAdmin.filter((c) => {
      if (periodo !== 'todos' && c.periodo !== periodo) return false
      if (programa !== 'todos' && c.programa !== programa) return false
      // "Sin docente" no es un estado del curso sino una carencia; se filtra
      // por la misma casilla porque es lo que se busca cuando se busca eso.
      if (estado === 'sin-docente' && c.docente !== null) return false
      if (estado !== 'todos' && estado !== 'sin-docente' && c.estado !== estado) return false
      if (!buscado) return true
      return (
        c.asignatura.toLowerCase().includes(buscado) ||
        c.codigo.toLowerCase().includes(buscado) ||
        (c.docente ?? '').toLowerCase().includes(buscado)
      )
    })
  }, [texto, periodo, programa, estado])

  const delPeriodo = cursosAdmin.filter((c) => c.periodo === periodo)
  const inscritos = delPeriodo.reduce((suma, c) => suma + c.inscritos, 0)
  const cupos = delPeriodo.reduce((suma, c) => suma + c.cupo, 0)
  const sinDocente = delPeriodo.filter((c) => !c.docente).length

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Cursos"
        descripcion="Cada fila es una asignatura impartida en un periodo por un docente. Un curso en borrador no aparece para los estudiantes: solo empieza a existir para ellos cuando se publica."
        accion={
          <Boton
            variante="primario"
            iconoIzq={<Plus size={15} strokeWidth={1.75} />}
            onClick={() => setCreando(true)}
          >
            Crear curso
          </Boton>
        }
      />

      {periodo !== 'todos' && (
        <Ficha>
          <Cifras
            datos={[
              {
                etiqueta: 'Cursos',
                valor: String(delPeriodo.length),
                pie: `Periodo ${periodo}`,
              },
              {
                etiqueta: 'Publicados',
                valor: String(delPeriodo.filter((c) => c.estado === 'publicado').length),
                pie: `${delPeriodo.filter((c) => c.estado === 'borrador').length} en borrador`,
              },
              {
                etiqueta: 'Sin docente',
                valor: String(sinDocente),
                pie: 'No se pueden publicar',
                alerta: sinDocente > 0,
              },
              {
                etiqueta: 'Ocupación',
                valor: cupos ? `${Math.round((inscritos / cupos) * 100)}%` : '—',
                pie: `${inscritos} de ${cupos} cupos`,
              },
            ]}
          />
        </Ficha>
      )}

      <Ficha>
        <BarraFiltros>
          <Buscador
            valor={texto}
            alCambiar={setTexto}
            placeholder="Buscar por asignatura, código o docente"
            className="min-w-[240px] flex-1"
          />
          <FiltroSelect
            etiqueta="Periodo"
            valor={periodo}
            alCambiar={setPeriodo}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              ...periodos.map((p) => ({ valor: p.codigo, texto: p.codigo })),
            ]}
          />
          <FiltroSelect
            etiqueta="Programa"
            valor={programa}
            alCambiar={setPrograma}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              ...programas.map((p) => ({ valor: p.nombre, texto: p.codigo })),
            ]}
          />
          <FiltroSelect
            etiqueta="Estado"
            valor={estado}
            alCambiar={setEstado}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              { valor: 'publicado', texto: 'Publicados' },
              { valor: 'borrador', texto: 'Borradores' },
              { valor: 'cerrado', texto: 'Cerrados' },
              { valor: 'sin-docente', texto: 'Sin docente' },
            ]}
          />
        </BarraFiltros>

        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={BookOpen}
            titulo="No hay cursos con esos filtros"
            texto="Cambia el periodo o el programa, o crea el primer curso de este periodo."
            accion={
              <Boton variante="primario" onClick={() => setCreando(true)}>
                Crear curso
              </Boton>
            }
          />
        ) : (
          <>
            <Tabla>
              <Encabezado>
                <Th className="w-32">Código</Th>
                <Th>Asignatura</Th>
                <Th className="w-52">Docente</Th>
                <Th className="hidden w-40 xl:table-cell">Programa</Th>
                <Th className="w-36">Inscritos</Th>
                <Th className="w-28">Estado</Th>
                <Th className="w-10" />
              </Encabezado>
              <tbody>
                {filtrados.map((curso) => (
                  <Fila key={curso.id}>
                    <TdDato className="text-pizarra">
                      {curso.codigo}-{curso.seccion}
                    </TdDato>
                    <Td>
                      <p className="text-[13.5px] font-medium text-tinta">
                        {curso.asignatura}
                      </p>
                      <p className="mt-0.5 font-dato text-[11.5px] text-tinta-suave">
                        {curso.creditos} cr · {curso.modalidad} · {curso.periodo}
                      </p>
                    </Td>
                    <Td>
                      {curso.docente ? (
                        <span className="text-[13px] text-tinta-media">{curso.docente}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-correccion">
                          <TriangleAlert size={14} strokeWidth={1.75} />
                          Sin asignar
                        </span>
                      )}
                    </Td>
                    <Td className="hidden text-[13px] text-tinta-media xl:table-cell">
                      {curso.programa}
                    </Td>
                    <Td>
                      <Ocupacion inscritos={curso.inscritos} cupo={curso.cupo} />
                    </Td>
                    <Td>
                      <EstadoDeCurso estado={curso.estado} />
                    </Td>
                    <Td className="pr-3">
                      <MenuFila acciones={accionesDe(curso)} />
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
            <PieDeTabla
              mostradas={filtrados.length}
              total={cursosAdmin.length}
              sustantivo="cursos"
            />
          </>
        )}
      </Ficha>

      <DialogoCrearCurso abierto={creando} alCerrar={() => setCreando(false)} />
    </div>
  )
}

/* Cupo lleno no es un error, pero es una decision que alguien tiene que tomar. */
function Ocupacion({ inscritos, cupo }: { inscritos: number; cupo: number }) {
  const porcentaje = cupo ? Math.round((inscritos / cupo) * 100) : 0
  const lleno = inscritos >= cupo
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-14 shrink-0 bg-regla">
        <div
          className={cn('h-full', lleno ? 'bg-aviso' : 'bg-pizarra')}
          style={{ width: `${Math.min(100, porcentaje)}%` }}
        />
      </div>
      <span className="font-dato text-[12.5px] tabular-nums text-tinta-media">
        {inscritos}/{cupo}
      </span>
    </div>
  )
}

function accionesDe(curso: CursoAdmin) {
  return [
    { etiqueta: 'Abrir el curso', alElegir: () => {} },
    { etiqueta: 'Editar datos', alElegir: () => {} },
    {
      etiqueta: curso.docente ? 'Cambiar docente' : 'Asignar docente',
      alElegir: () => {},
    },
    { etiqueta: 'Gestionar inscritos', alElegir: () => {} },
    { etiqueta: 'Duplicar en otro periodo', alElegir: () => {} },
    ...(curso.estado === 'borrador'
      ? [{ etiqueta: 'Publicar', alElegir: () => {} }]
      : curso.estado === 'publicado'
        ? [{ etiqueta: 'Cerrar curso', alElegir: () => {}, peligrosa: true }]
        : []),
    { etiqueta: 'Eliminar', alElegir: () => {}, peligrosa: true },
  ]
}

/*
  El formulario esta partido en tres bloques con la misma logica que la base:
  que se imparte, quien lo imparte y como se inscribe. Crear el curso lo deja
  en borrador siempre; publicar es un acto aparte, porque abre la inscripcion.
*/
function DialogoCrearCurso({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const docentes = personas.filter(
    (p) => p.roles.includes('docente') && p.estado === 'activa',
  )

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Crear curso"
      descripcion="Se crea en borrador. Los estudiantes no lo verán hasta que lo publiques."
      ancho="lg"
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="secundario" onClick={alCerrar}>
            Guardar borrador
          </Boton>
          <Boton variante="primario" onClick={alCerrar}>
            Crear y publicar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <BloqueFormulario titulo="Qué se imparte">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr_100px]">
            <Campo etiqueta="Código" placeholder="ISW-126" autoFocus />
            <Campo etiqueta="Asignatura" placeholder="Desarrollo de Aplicaciones Web" />
            <Campo etiqueta="Sección" placeholder="01" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector
              etiqueta="Programa"
              opciones={programas
                .filter((p) => p.activo)
                .map((p) => ({ valor: p.id, texto: p.nombre }))}
            />
            <Campo etiqueta="Créditos" type="number" defaultValue={4} min={1} max={12} />
          </div>
          <AreaTexto
            etiqueta="Descripción"
            placeholder="Aparece en la ficha del curso que ven los estudiantes."
            rows={2}
          />
        </BloqueFormulario>

        <BloqueFormulario titulo="Quién lo imparte">
          <Selector
            etiqueta="Docente"
            vacio="Asignar más tarde"
            ayuda="Solo aparecen las personas con rol docente y membresía activa. Sin docente, el curso no se puede publicar."
            opciones={docentes.map((d) => ({ valor: d.id, texto: d.nombre }))}
          />
        </BloqueFormulario>

        <BloqueFormulario titulo="Cómo se inscribe">
          <div className="grid gap-4 sm:grid-cols-3">
            <Selector
              etiqueta="Periodo"
              opciones={periodos
                .filter((p) => p.estado !== 'cerrado')
                .map((p) => ({ valor: p.codigo, texto: p.codigo }))}
            />
            <Selector
              etiqueta="Modalidad"
              opciones={[
                { valor: 'presencial', texto: 'Presencial' },
                { valor: 'virtual', texto: 'Virtual' },
                { valor: 'hibrida', texto: 'Híbrida' },
              ]}
            />
            <Campo etiqueta="Cupo" type="number" defaultValue={30} min={1} />
          </div>
        </BloqueFormulario>
      </div>
    </Dialogo>
  )
}

function BloqueFormulario({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="etiqueta-dato mb-1 w-full border-b border-regla pb-2 text-tinta-suave">
        {titulo}
      </legend>
      {children}
    </fieldset>
  )
}
