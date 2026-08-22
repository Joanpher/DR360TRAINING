import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { Check, Globe, Plus, RefreshCw, TriangleAlert } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import { Etiqueta } from '../../ui/Etiqueta'
import { Ficha, FichaCabecera } from '../../ui/Ficha'
import { Selector } from '../../ui/Selector'
import { AreaTexto } from '../../ui/AreaTexto'
import { cn } from '../../ui/cn'
import { useSesion } from '../../app/sesion'
import { pedir } from '../../datos/api'
import { useConsulta, useGuardar } from '../../datos/consulta'
import { EncabezadoPagina, Esqueleto, MenuFila, Nota } from '../piezas'

/*
  Configuracion de la institucion. Va toda en una pagina y no repartida en
  pestañas: son cosas que se tocan una vez al año, y esconderlas detras de
  pestañas obliga a buscarlas cuando por fin hacen falta.

  El orden es por consecuencia: primero lo que se ve por fuera (datos, marca),
  luego lo que decide quien puede entrar (dominios), y al final lo que rompe
  cosas si se cambia (escala de calificacion, archivar).

  Cada bloque guarda por su cuenta contra su propio endpoint. Un unico boton
  "Guardar todo" al final obligaria a mandar la escala de calificacion cada vez
  que alguien corrige una errata en el nombre.
*/

type Institucion = {
  id: string
  slug: string
  nombre: string
  siglas: string | null
  tipo: string
  estado: string
  pais: string
  zonaHoraria: string
  idioma: string
  correoSoporte: string | null
  sitioWeb: string | null
  descripcion: string | null
  marca: { colorPrimario?: string; colorAcento?: string; logoUrl?: string | null }
}

type Dominio = {
  id: string
  dominio: string
  autoafiliar: boolean
  rolPorDefecto: string
  verificado: boolean
  registroTxt: string
}

type Tramo = { letra: string; desde: number; hasta: number; puntos: number }

type Configuracion = {
  institucion: Institucion
  dominios: Dominio[]
  escala: Tramo[]
  esPropietario: boolean
}

const COLOR_PRIMARIO = '#1E5245'
const COLOR_ACENTO = '#5FB79A'

export function Institucion() {
  const { datos, cargando, error, recargar, fijar } = useConsulta<Configuracion>(
    '/instituciones/actual',
  )

  if (cargando && !datos) {
    return (
      <div className="space-y-6">
        <EncabezadoPagina titulo="Datos y marca" />
        <Esqueleto filas={4} />
      </div>
    )
  }

  if (error || !datos) {
    return (
      <div className="space-y-6">
        <EncabezadoPagina titulo="Datos y marca" />
        <Nota tono="error">{error ?? 'No se pudo cargar la configuración.'}</Nota>
        <Boton variante="secundario" onClick={() => void recargar()}>
          Reintentar
        </Boton>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Datos y marca"
        descripcion="Cómo se llama la institución, cómo se ve dentro de DR360TRAINING y quién puede entrar con su correo."
      />

      <DatosGenerales institucion={datos.institucion} alGuardar={fijar} />
      <Dominios dominios={datos.dominios} alGuardar={fijar} />
      <Marca institucion={datos.institucion} alGuardar={fijar} />
      <Escala escala={datos.escala} alGuardar={fijar} />
      {datos.esPropietario && <Archivar institucion={datos.institucion} />}
    </div>
  )
}

type AlGuardar = Dispatch<SetStateAction<Configuracion | null>>

// ---------------------------------------------------------------------------
// Datos generales
// ---------------------------------------------------------------------------

function DatosGenerales({
  institucion,
  alGuardar,
}: {
  institucion: Institucion
  alGuardar: AlGuardar
}) {
  const { refrescarContexto } = useSesion()
  const { guardar, guardando, error, listo } = useGuardar()

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const campos = new FormData(e.currentTarget)
    const cuerpo = Object.fromEntries(campos.entries())

    const resultado = await guardar(() =>
      pedir<Configuracion>('/instituciones/actual', { metodo: 'PATCH', cuerpo }),
    )

    if (resultado) {
      alGuardar(resultado)
      // El nombre y las siglas se ven en la barra superior y en la lateral:
      // sin releer el contexto, ahí seguiría lo viejo hasta recargar.
      await refrescarContexto().catch(() => undefined)
    }
  }

  return (
    <Ficha>
      <form onSubmit={alEnviar}>
        <FichaCabecera
          titulo="Datos generales"
          descripcion="Aparecen en los documentos y actas que emite la plataforma"
          accion={
            <Boton type="submit" variante="secundario" tamano="sm" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
          }
        />

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          {(error || listo) && (
            <div className="sm:col-span-2">
              {error ? (
                <Nota tono="error">{error}</Nota>
              ) : (
                <Nota tono="exito">Datos guardados.</Nota>
              )}
            </div>
          )}

          <Campo etiqueta="Nombre" name="nombre" defaultValue={institucion.nombre} required />
          <Campo etiqueta="Siglas" name="siglas" defaultValue={institucion.siglas ?? ''} />
          <Campo
            etiqueta="Identificador"
            name="slug"
            defaultValue={institucion.slug}
            ayuda="Se usa en las direcciones web. Cambiarlo rompe los enlaces ya compartidos."
          />
          <Selector
            etiqueta="Tipo"
            name="tipo"
            defaultValue={institucion.tipo}
            opciones={[
              { valor: 'universidad', texto: 'Universidad' },
              { valor: 'instituto', texto: 'Instituto' },
              { valor: 'colegio', texto: 'Colegio' },
              { valor: 'academia', texto: 'Academia' },
              { valor: 'corporativa', texto: 'Corporativa' },
            ]}
          />
          <Selector
            etiqueta="País"
            name="pais"
            defaultValue={institucion.pais}
            opciones={[
              { valor: 'DO', texto: 'República Dominicana' },
              { valor: 'US', texto: 'Estados Unidos' },
              { valor: 'ES', texto: 'España' },
              { valor: 'MX', texto: 'México' },
              { valor: 'CO', texto: 'Colombia' },
            ]}
          />
          <Selector
            etiqueta="Zona horaria"
            name="zonaHoraria"
            defaultValue={institucion.zonaHoraria}
            ayuda="Decide a qué hora vence una entrega."
            opciones={[
              { valor: 'America/Santo_Domingo', texto: 'America/Santo_Domingo (UTC−4)' },
              { valor: 'America/New_York', texto: 'America/New_York' },
              { valor: 'America/Mexico_City', texto: 'America/Mexico_City' },
              { valor: 'America/Bogota', texto: 'America/Bogota' },
              { valor: 'Europe/Madrid', texto: 'Europe/Madrid' },
            ]}
          />
          <Campo
            etiqueta="Correo de soporte"
            name="correoSoporte"
            type="email"
            defaultValue={institucion.correoSoporte ?? ''}
            ayuda="A dónde escribe quien no puede entrar. Déjalo vacío si no hay."
          />
          <Campo
            etiqueta="Sitio web"
            name="sitioWeb"
            defaultValue={institucion.sitioWeb ?? ''}
            placeholder="https://uce.edu.do"
          />
          <div className="sm:col-span-2">
            <AreaTexto
              etiqueta="Descripción"
              name="descripcion"
              rows={2}
              defaultValue={institucion.descripcion ?? ''}
              placeholder="Una línea sobre la institución. Aparece en la pantalla de acceso."
            />
          </div>
        </div>
      </form>
    </Ficha>
  )
}

// ---------------------------------------------------------------------------
// Dominios de correo
// ---------------------------------------------------------------------------

function Dominios({
  dominios,
  alGuardar,
}: {
  dominios: Dominio[]
  alGuardar: AlGuardar
}) {
  const [agregando, setAgregando] = useState(false)
  const [instrucciones, setInstrucciones] = useState<Dominio | null>(null)
  const { guardar, guardando, error } = useGuardar()

  async function operar(operacion: () => Promise<Configuracion>) {
    const resultado = await guardar(operacion)
    if (resultado) alGuardar(resultado)
    return resultado
  }

  return (
    <>
      <Ficha>
        <FichaCabecera
          titulo="Dominios de correo"
          descripcion="Quien tenga un correo de un dominio verificado puede entrar sin invitación"
          accion={
            <Boton
              variante="secundario"
              tamano="sm"
              iconoIzq={<Plus size={14} strokeWidth={1.75} />}
              onClick={() => setAgregando(true)}
            >
              Añadir dominio
            </Boton>
          }
        />

        {error && (
          <div className="px-5 pt-4">
            <Nota tono="error">{error}</Nota>
          </div>
        )}

        {dominios.length === 0 ? (
          <p className="px-5 py-6 text-[13px] leading-relaxed text-tinta-media">
            No hay ningún dominio registrado. Sin dominios, todo el mundo entra por
            invitación, que es el camino más seguro pero también el más lento para dar de
            alta a una promoción entera.
          </p>
        ) : (
          <ul>
            {dominios.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 border-b border-regla px-5 py-3.5 last:border-b-0"
              >
                <Globe size={16} strokeWidth={1.5} className="shrink-0 text-tinta-suave" />
                <div className="min-w-0 flex-1">
                  <p className="font-dato text-[13px] text-tinta">{d.dominio}</p>
                  <p className="mt-0.5 text-[12px] text-tinta-suave">
                    {d.autoafiliar
                      ? `Alta automática como ${d.rolPorDefecto}`
                      : 'Solo por invitación'}
                  </p>
                </div>

                {d.verificado ? (
                  <Etiqueta tono="aprobado" icono={<Check size={11} strokeWidth={2.5} />}>
                    Verificado
                  </Etiqueta>
                ) : (
                  <button
                    onClick={() => setInstrucciones(d)}
                    className="etiqueta-dato inline-flex items-center gap-1 rounded-xs border border-aviso/25 bg-aviso-tenue px-1.5 py-0.5 text-aviso hover:border-aviso/50"
                  >
                    <TriangleAlert size={11} strokeWidth={2} />
                    Sin verificar
                  </button>
                )}

                <MenuFila
                  acciones={[
                    ...(d.verificado
                      ? []
                      : [
                          {
                            etiqueta: 'Verificar ahora',
                            alElegir: () => setInstrucciones(d),
                          },
                        ]),
                    {
                      etiqueta: d.autoafiliar ? 'Exigir invitación' : 'Permitir alta automática',
                      alElegir: () => {
                        void operar(() =>
                          pedir<Configuracion>(`/instituciones/actual/dominios/${d.id}`, {
                            metodo: 'PATCH',
                            cuerpo: { autoafiliar: !d.autoafiliar },
                          }),
                        )
                      },
                    },
                    {
                      etiqueta: 'Eliminar dominio',
                      peligrosa: true,
                      alElegir: () => {
                        void operar(() =>
                          pedir<Configuracion>(`/instituciones/actual/dominios/${d.id}`, {
                            metodo: 'DELETE',
                          }),
                        )
                      },
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Ficha>

      <DialogoDominio
        abierto={agregando}
        alCerrar={() => setAgregando(false)}
        alCrear={async (cuerpo) => {
          const r = await operar(() =>
            pedir<Configuracion>('/instituciones/actual/dominios', {
              metodo: 'POST',
              cuerpo,
            }),
          )
          if (r) setAgregando(false)
        }}
        guardando={guardando}
      />

      <DialogoVerificar
        dominio={instrucciones}
        alCerrar={() => setInstrucciones(null)}
        alVerificar={async (id) => {
          const r = await operar(() =>
            pedir<Configuracion>(`/instituciones/actual/dominios/${id}/verificar`, {
              metodo: 'POST',
            }),
          )
          if (r) setInstrucciones(null)
        }}
        guardando={guardando}
      />
    </>
  )
}

function DialogoDominio({
  abierto,
  alCerrar,
  alCrear,
  guardando,
}: {
  abierto: boolean
  alCerrar: () => void
  alCrear: (cuerpo: Record<string, unknown>) => Promise<void>
  guardando: boolean
}) {
  const [dominio, setDominio] = useState('')
  const [autoafiliar, setAutoafiliar] = useState('invitacion')
  const [rol, setRol] = useState('estudiante')

  useEffect(() => {
    if (abierto) {
      setDominio('')
      setAutoafiliar('invitacion')
      setRol('estudiante')
    }
  }, [abierto])

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Añadir dominio de correo"
      descripcion="Habrá que probar que el dominio es tuyo publicando un registro TXT en su DNS. Hasta entonces queda registrado pero sin efecto."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando || dominio.trim() === ''}
            onClick={() =>
              void alCrear({
                dominio: dominio.trim().toLowerCase(),
                autoafiliar: autoafiliar === 'automatica',
                rolPorDefecto: rol,
              })
            }
          >
            {guardando ? 'Añadiendo…' : 'Añadir dominio'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Dominio"
          placeholder="uce.edu.do"
          value={dominio}
          onChange={(e) => setDominio(e.target.value)}
          autoFocus
        />
        <Selector
          etiqueta="Al entrar por primera vez"
          value={autoafiliar}
          onChange={(e) => setAutoafiliar(e.target.value)}
          ayuda="El alta automática ahorra invitar a miles de estudiantes uno por uno, pero deja entrar a cualquiera que tenga un correo del dominio."
          opciones={[
            { valor: 'invitacion', texto: 'Exigir invitación' },
            { valor: 'automatica', texto: 'Crear la membresía automáticamente' },
          ]}
        />
        {autoafiliar === 'automatica' && (
          <Selector
            etiqueta="Con el rol de"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            opciones={[
              { valor: 'estudiante', texto: 'Estudiante' },
              { valor: 'docente', texto: 'Instructor' },
              { valor: 'invitado', texto: 'Invitado (solo lectura)' },
            ]}
          />
        )}
      </div>
    </Dialogo>
  )
}

/*
  Verificar es una comprobacion contra el DNS, no un formulario. Lo unico que
  hay que hacer aqui es enseñar el valor exacto que hay que publicar y dar un
  boton para volver a mirar. Que falle la primera vez es lo normal: la
  propagacion tarda.
*/
function DialogoVerificar({
  dominio,
  alCerrar,
  alVerificar,
  guardando,
}: {
  dominio: Dominio | null
  alCerrar: () => void
  alVerificar: (id: string) => Promise<void>
  guardando: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => setCopiado(false), [dominio?.id])

  if (!dominio) return null

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo={`Verificar ${dominio.dominio}`}
      descripcion="Publica este registro TXT en el DNS del dominio. Cuando esté propagado, vuelve aquí y comprueba."
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cerrar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando}
            iconoIzq={<RefreshCw size={15} strokeWidth={1.75} />}
            onClick={() => void alVerificar(dominio.id)}
          >
            {guardando ? 'Comprobando…' : 'Comprobar ahora'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="rounded-sm border border-regla">
          {[
            ['Tipo', 'TXT'],
            ['Nombre', dominio.dominio],
            ['Valor', dominio.registroTxt],
          ].map(([clave, valor]) => (
            <div
              key={clave}
              className="flex items-baseline gap-4 border-b border-regla px-4 py-2.5 last:border-b-0"
            >
              <dt className="etiqueta-dato w-16 shrink-0 text-tinta-suave">{clave}</dt>
              <dd className="min-w-0 flex-1 break-all font-dato text-[12.5px] text-tinta">
                {valor}
              </dd>
            </div>
          ))}
        </dl>

        <Boton
          variante="secundario"
          tamano="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(dominio.registroTxt)
            setCopiado(true)
          }}
        >
          {copiado ? 'Copiado' : 'Copiar el valor'}
        </Boton>

        <p className="text-[12.5px] leading-relaxed text-tinta-media">
          Los cambios de DNS pueden tardar de unos minutos a varias horas en propagarse.
          Si la comprobación falla, espera y vuelve a intentarlo: el valor no caduca.
        </p>
      </div>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
// Marca
// ---------------------------------------------------------------------------

function Marca({
  institucion,
  alGuardar,
}: {
  institucion: Institucion
  alGuardar: AlGuardar
}) {
  const { guardar, guardando, error, listo } = useGuardar()
  const [primario, setPrimario] = useState(institucion.marca.colorPrimario ?? COLOR_PRIMARIO)
  const [acento, setAcento] = useState(institucion.marca.colorAcento ?? COLOR_ACENTO)
  const [logo, setLogo] = useState(institucion.marca.logoUrl ?? '')

  async function alGuardarMarca() {
    const resultado = await guardar(() =>
      pedir<{ marca: Institucion['marca'] }>('/instituciones/actual/marca', {
        metodo: 'PUT',
        cuerpo: { colorPrimario: primario, colorAcento: acento, logoUrl: logo },
      }),
    )
    if (resultado) {
      alGuardar((previo) =>
        previo
          ? {
              ...previo,
              institucion: { ...previo.institucion, marca: resultado.marca },
            }
          : previo,
      )
    }
  }

  return (
    <Ficha>
      <FichaCabecera
        titulo="Marca"
        descripcion="El color se aplica a toda la plataforma para quien pertenece a esta institución"
        accion={
          <Boton
            variante="secundario"
            tamano="sm"
            disabled={guardando}
            onClick={() => void alGuardarMarca()}
          >
            {guardando ? 'Guardando…' : 'Guardar marca'}
          </Boton>
        }
      />

      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          {error && <Nota tono="error">{error}</Nota>}
          {listo && <Nota tono="exito">Marca guardada.</Nota>}

          <Campo
            etiqueta="Dirección del logotipo"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://uce.edu.do/logo.svg"
            ayuda="SVG o PNG con fondo transparente. La subida de archivos llegará cuando exista el almacenamiento; por ahora se enlaza."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoColor etiqueta="Color principal" valor={primario} alCambiar={setPrimario} />
            <CampoColor etiqueta="Color de acento" valor={acento} alCambiar={setAcento} />
          </div>
        </div>

        {/* Ver el color aplicado importa más que ver el código hexadecimal. */}
        <div className="rounded-sm border border-regla">
          <p className="etiqueta-dato border-b border-regla px-3 py-2 text-tinta-suave">
            Vista previa
          </p>
          <div className="reglado px-4 py-5" style={{ backgroundColor: primario }}>
            <p className="etiqueta-dato" style={{ color: acento }}>
              Clase en vivo
            </p>
            <p className="mt-2 font-dato text-[24px] font-medium leading-none text-white">
              00:47:12
            </p>
            <div
              className="mt-3 flex h-8 items-center justify-center rounded-sm text-[12px] font-medium"
              style={{ backgroundColor: acento, color: primario }}
            >
              Entrar a la clase
            </div>
          </div>
        </div>
      </div>
    </Ficha>
  )
}

function CampoColor({
  etiqueta,
  valor,
  alCambiar,
}: {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="etiqueta-dato text-[11.5px] font-semibold text-tinta">
        {etiqueta}
      </span>
      <div className="flex h-11 items-center gap-2 rounded-sm border border-regla-fuerte bg-superficie pl-2 pr-3 focus-within:border-pizarra focus-within:ring-2 focus-within:ring-pizarra/15">
        <input
          type="color"
          value={valor}
          onChange={(e) => alCambiar(e.target.value.toUpperCase())}
          aria-label={etiqueta}
          className="h-7 w-9 shrink-0 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={valor}
          onChange={(e) => alCambiar(e.target.value.toUpperCase())}
          spellCheck={false}
          className="w-full border-0 bg-transparent font-dato text-[13px] uppercase text-tinta focus:outline-none"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Escala de calificación
// ---------------------------------------------------------------------------

/*
  El servidor guarda y devuelve los tramos ordenados de menor a mayor, que es lo
  que hace facil validar que no hay huecos. Una escala se lee al reves -de A
  hacia abajo- asi que se invierte al pintarla y al editarla. El orden de
  guardado no cambia: quien valida es el servidor.
*/
const deMayorAMenor = (tramos: Tramo[]) => [...tramos].sort((a, b) => b.desde - a.desde)

function Escala({ escala, alGuardar }: { escala: Tramo[]; alGuardar: AlGuardar }) {
  const [editando, setEditando] = useState(false)
  const visibles = deMayorAMenor(escala)

  return (
    <>
      <Ficha>
        <FichaCabecera
          titulo="Escala de calificación"
          descripcion="Cómo se traduce un puntaje a letra y a índice"
          accion={
            <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
              Editar escala
            </Boton>
          }
        />
        <div
          className="grid divide-x divide-regla"
          style={{ gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))` }}
        >
          {visibles.map((tramo) => (
            <div key={tramo.letra} className="px-4 py-4 text-center">
              <p className="font-display text-[24px] font-bold leading-none text-tinta">
                {tramo.letra}
              </p>
              <p className="mt-2 font-dato text-[12px] tabular-nums text-tinta-media">
                {tramo.desde}–{tramo.hasta}
              </p>
              <p className="mt-0.5 font-dato text-[11px] tabular-nums text-tinta-suave">
                {(tramo.puntos / 100).toFixed(2)} pts
              </p>
            </div>
          ))}
        </div>
        <p className="border-t border-regla px-5 py-3 text-[12.5px] leading-relaxed text-tinta-media">
          Cambiar la escala no recalcula lo ya calificado: los periodos cerrados conservan la
          escala con la que se cerraron.
        </p>
      </Ficha>

      <DialogoEscala
        abierto={editando}
        escala={escala}
        alCerrar={() => setEditando(false)}
        alGuardar={alGuardar}
      />
    </>
  )
}

function DialogoEscala({
  abierto,
  escala,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean
  escala: Tramo[]
  alCerrar: () => void
  alGuardar: AlGuardar
}) {
  const [tramos, setTramos] = useState<Tramo[]>(() => deMayorAMenor(escala))
  const { guardar, guardando, error } = useGuardar()

  useEffect(() => {
    if (abierto) setTramos(deMayorAMenor(escala))
  }, [abierto, escala])

  function cambiar(i: number, campo: keyof Tramo, valor: string) {
    setTramos((previos) =>
      previos.map((tramo, j) =>
        j === i
          ? { ...tramo, [campo]: campo === 'letra' ? valor.toUpperCase() : Number(valor) }
          : tramo,
      ),
    )
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Editar escala de calificación"
      descripcion="Los tramos deben cubrir de 0 a 100 sin huecos ni solapes. Un puntaje que cae en un hueco no tendría letra que asignarle."
      ancho="lg"
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            disabled={guardando}
            onClick={async () => {
              const r = await guardar(() =>
                pedir<{ escala: Tramo[] }>('/instituciones/actual/escala', {
                  metodo: 'PUT',
                  cuerpo: { tramos },
                }),
              )
              if (r) {
                alGuardar((previo) =>
                  previo ? { ...previo, escala: r.escala } : previo,
                )
                alCerrar()
              }
            }}
          >
            {guardando ? 'Guardando…' : 'Guardar escala'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Nota tono="error">{error}</Nota>}

        <div className="grid grid-cols-[60px_1fr_1fr_1fr_36px] items-center gap-2">
          {['Letra', 'Desde', 'Hasta', 'Índice', ''].map((titulo, i) => (
            <span key={i} className="etiqueta-dato text-tinta-suave">
              {titulo}
            </span>
          ))}

          {tramos.map((tramo, i) => (
            <Renglon
              key={i}
              tramo={tramo}
              alCambiar={(campo, valor) => cambiar(i, campo, valor)}
              alQuitar={
                tramos.length > 2
                  ? () => setTramos((previos) => previos.filter((_, j) => j !== i))
                  : undefined
              }
            />
          ))}
        </div>

        <Boton
          variante="secundario"
          tamano="sm"
          iconoIzq={<Plus size={14} strokeWidth={1.75} />}
          onClick={() =>
            setTramos((previos) => [...previos, { letra: '', desde: 0, hasta: 0, puntos: 0 }])
          }
        >
          Añadir tramo
        </Boton>

        <p className="text-[12.5px] leading-relaxed text-tinta-suave">
          El índice se escribe en puntos por cien: 4.00 se guarda como 400. Así no hay
          decimales que redondear al calcular el promedio.
        </p>
      </div>
    </Dialogo>
  )
}

function Renglon({
  tramo,
  alCambiar,
  alQuitar,
}: {
  tramo: Tramo
  alCambiar: (campo: keyof Tramo, valor: string) => void
  alQuitar?: () => void
}) {
  const clase =
    'h-9 w-full rounded-sm border border-regla-fuerte bg-superficie px-2 font-dato text-[13px] tabular-nums text-tinta focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/15'

  return (
    <>
      <input
        value={tramo.letra}
        onChange={(e) => alCambiar('letra', e.target.value)}
        aria-label="Letra"
        className={cn(clase, 'text-center uppercase')}
      />
      <input
        type="number"
        value={tramo.desde}
        onChange={(e) => alCambiar('desde', e.target.value)}
        aria-label="Desde"
        className={clase}
      />
      <input
        type="number"
        value={tramo.hasta}
        onChange={(e) => alCambiar('hasta', e.target.value)}
        aria-label="Hasta"
        className={clase}
      />
      <input
        type="number"
        value={tramo.puntos}
        onChange={(e) => alCambiar('puntos', e.target.value)}
        aria-label="Índice en puntos por cien"
        className={clase}
      />
      <button
        type="button"
        onClick={alQuitar}
        disabled={!alQuitar}
        aria-label="Quitar tramo"
        className="flex h-9 w-9 items-center justify-center rounded-sm text-tinta-suave hover:bg-correccion-tenue hover:text-correccion disabled:cursor-not-allowed disabled:opacity-30"
      >
        ×
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Archivar
// ---------------------------------------------------------------------------

function Archivar({ institucion }: { institucion: Institucion }) {
  const { salir } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const { guardar, guardando, error } = useGuardar()

  const coincide = confirmacion.trim().toLowerCase() === institucion.nombre.trim().toLowerCase()

  return (
    <>
      <Ficha className="border-correccion/30">
        <FichaCabecera
          titulo="Archivar institución"
          descripcion="Deja de admitir accesos y congela todos los datos en solo lectura"
          accion={
            <Boton variante="peligro" tamano="sm" onClick={() => setAbierto(true)}>
              Archivar
            </Boton>
          }
        />
        <p className="px-5 py-4 text-[13px] leading-relaxed text-tinta-media">
          Nada se borra: los expedientes siguen consultables para quien tenga el rol de
          propietario. Es la salida cuando una institución deja de operar, no una forma de
          empezar de cero. Solo el propietario puede hacerlo.
        </p>
      </Ficha>

      <Dialogo
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Archivar la institución"
        ancho="sm"
        descripcion="Nadie podrá volver a entrar, incluido tú. Reabrirla requiere intervención manual."
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              disabled={!coincide || guardando}
              onClick={async () => {
                const r = await guardar(() =>
                  pedir<{ archivada: boolean }>('/instituciones/actual/archivar', {
                    metodo: 'POST',
                    cuerpo: { confirmacion },
                  }),
                )
                if (r) await salir()
              }}
            >
              {guardando ? 'Archivando…' : 'Archivar definitivamente'}
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Nota tono="error">{error}</Nota>}
          <Campo
            etiqueta={`Escribe "${institucion.nombre}" para confirmar`}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoFocus
          />
        </div>
      </Dialogo>
    </>
  )
}
