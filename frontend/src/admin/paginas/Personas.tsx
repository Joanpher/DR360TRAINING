import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, UserPlus, Users } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { Dialogo } from '../../ui/Dialogo'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { cn } from '../../ui/cn'
import { iniciales } from '../../app/sesion'
import { DialogoInvitar } from '../DialogoInvitar'
import {
  BarraFiltros,
  EncabezadoPagina,
  EstadoDeMembresia,
  FiltroSelect,
  MenuFila,
  PieDeTabla,
  RolesDePersona,
} from '../piezas'
import { personas, type Persona } from '../datos'

const OPCIONES_ROL = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'administrador', texto: 'Administración' },
  { valor: 'docente', texto: 'Instructores' },
  { valor: 'estudiante', texto: 'Estudiantes' },
  { valor: 'invitado', texto: 'Invitados' },
]

const OPCIONES_ESTADO = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'activa', texto: 'Activas' },
  { valor: 'invitada', texto: 'Invitadas' },
  { valor: 'suspendida', texto: 'Suspendidas' },
  { valor: 'retirada', texto: 'Retiradas' },
]

/*
  La pantalla de personas es la que mas se usa del panel, y por eso es una
  tabla y no una cuadricula de tarjetas: quien administra viene a buscar a
  alguien concreto o a comparar una columna -quien no ha entrado nunca, quien
  esta suspendido-, y eso solo se hace bien en filas alineadas.

  Buscar y filtrar viven sobre la tabla y no en un cajon lateral: son parte de
  leerla, no una funcion aparte.
*/
export function Personas() {
  const [texto, setTexto] = useState('')
  const [rol, setRol] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [invitando, setInvitando] = useState(false)
  const [importando, setImportando] = useState(false)

  const filtradas = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return personas.filter((p) => {
      if (rol === 'administrador') {
        if (!p.roles.some((r) => r === 'administrador' || r === 'propietario')) return false
      } else if (rol !== 'todos' && !p.roles.includes(rol as Persona['roles'][number])) {
        return false
      }
      if (estado !== 'todos' && p.estado !== estado) return false
      if (!buscado) return true
      return (
        p.nombre.toLowerCase().includes(buscado) ||
        p.correo.toLowerCase().includes(buscado) ||
        (p.codigo ?? '').toLowerCase().includes(buscado)
      )
    })
  }, [texto, rol, estado])

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Todas las personas que pertenecen a la institución. Un usuario existe una sola vez en DR360TRAINING; lo que se administra aquí es su membresía: el rol que tiene dentro de esta institución y su estado."
        accion={
          <div className="flex gap-2">
            <Boton
              variante="secundario"
              iconoIzq={<Upload size={15} strokeWidth={1.5} />}
              onClick={() => setImportando(true)}
            >
              Importar CSV
            </Boton>
            <Boton
              variante="primario"
              iconoIzq={<UserPlus size={15} strokeWidth={1.5} />}
              onClick={() => setInvitando(true)}
            >
              Invitar persona
            </Boton>
          </div>
        }
      />

      <Ficha>
        <BarraFiltros>
          <Buscador
            valor={texto}
            alCambiar={setTexto}
            placeholder="Buscar por nombre, correo o matrícula"
            className="min-w-[260px] flex-1"
          />
          <FiltroSelect etiqueta="Rol" valor={rol} alCambiar={setRol} opciones={OPCIONES_ROL} />
          <FiltroSelect
            etiqueta="Estado"
            valor={estado}
            alCambiar={setEstado}
            opciones={OPCIONES_ESTADO}
          />
        </BarraFiltros>

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={Users}
            titulo="Nadie coincide con ese filtro"
            texto="Prueba con otro término de búsqueda, o invita a la persona si todavía no está en la institución."
            accion={
              <Boton variante="primario" onClick={() => setInvitando(true)}>
                Invitar persona
              </Boton>
            }
          />
        ) : (
          <>
            <Tabla>
              <Encabezado>
                <Th>Persona</Th>
                <Th className="w-32">Código</Th>
                <Th className="w-56">Roles</Th>
                <Th className="hidden w-48 xl:table-cell">Programa</Th>
                <Th className="w-28">Estado</Th>
                <Th className="hidden w-32 lg:table-cell">Último acceso</Th>
                <Th className="w-10" />
              </Encabezado>
              <tbody>
                {filtradas.map((persona) => (
                  <Fila key={persona.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xs font-dato text-[12px] font-semibold',
                            persona.estado === 'activa'
                              ? 'bg-pizarra-tenue text-pizarra'
                              : 'bg-lienzo text-tinta-suave',
                          )}
                        >
                          {iniciales(persona.nombre)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-tinta">
                            {persona.nombre}
                          </p>
                          <p className="truncate font-dato text-[11.5px] text-tinta-suave">
                            {persona.correo}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <TdDato className="text-tinta-media">{persona.codigo ?? '—'}</TdDato>
                    <Td>
                      <RolesDePersona roles={persona.roles} />
                    </Td>
                    <Td className="hidden text-[13px] text-tinta-media xl:table-cell">
                      {persona.programa ?? '—'}
                    </Td>
                    <Td>
                      <EstadoDeMembresia estado={persona.estado} />
                    </Td>
                    <TdDato className="hidden text-tinta-suave lg:table-cell">
                      {persona.ultimoAcceso ?? 'Nunca'}
                    </TdDato>
                    <Td className="pr-3">
                      <MenuFila
                        acciones={accionesDe(persona)}
                      />
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
            <PieDeTabla
              mostradas={filtradas.length}
              total={personas.length}
              sustantivo="personas"
            />
          </>
        )}
      </Ficha>

      <p className="text-[12.5px] leading-relaxed text-tinta-suave">
        ¿Buscas a alguien que aún no aceptó?{' '}
        <Link to="/admin/invitaciones" className="text-pizarra underline-offset-4 hover:underline">
          Revisa las invitaciones pendientes
        </Link>
        .
      </p>

      <DialogoInvitar abierto={invitando} alCerrar={() => setInvitando(false)} />
      <DialogoImportar abierto={importando} alCerrar={() => setImportando(false)} />
    </div>
  )
}

/*
  Las acciones cambian segun el estado, y a un propietario no se le puede
  quitar el rol: es la unica cuenta que garantiza que la institucion no se
  quede sin nadie que pueda administrarla.
*/
function accionesDe(persona: Persona) {
  const esPropietario = persona.roles.includes('propietario')
  return [
    { etiqueta: 'Ver perfil', alElegir: () => {} },
    { etiqueta: 'Editar roles', alElegir: () => {} },
    { etiqueta: 'Cambiar programa', alElegir: () => {} },
    ...(persona.estado === 'invitada'
      ? [{ etiqueta: 'Reenviar invitación', alElegir: () => {} }]
      : []),
    ...(esPropietario
      ? []
      : persona.estado === 'suspendida'
        ? [{ etiqueta: 'Reactivar membresía', alElegir: () => {} }]
        : [
            { etiqueta: 'Suspender membresía', alElegir: () => {}, peligrosa: true },
            { etiqueta: 'Retirar de la institución', alElegir: () => {}, peligrosa: true },
          ]),
  ]
}

function DialogoImportar({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Importar personas desde CSV"
      descripcion="Para dar de alta un grupo completo. Cada fila se convierte en una invitación; nadie entra sin aceptar."
      ancho="lg"
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={alCerrar}>
            Revisar archivo
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-regla-fuerte bg-lienzo px-6 py-10 text-center hover:border-pizarra hover:bg-pizarra-tenue">
          <Upload size={20} strokeWidth={1.5} className="text-tinta-suave" />
          <span className="text-[13.5px] font-medium text-tinta">
            Arrastra el archivo o haz clic para elegirlo
          </span>
          <span className="text-[12px] text-tinta-suave">CSV separado por comas · hasta 5 MB</span>
          <input type="file" accept=".csv" className="hidden" />
        </label>

        <div className="rounded-sm border border-regla bg-lienzo px-4 py-3">
          <p className="etiqueta-dato mb-2 text-tinta-suave">Columnas esperadas</p>
          <code className="block overflow-x-auto whitespace-pre font-dato text-[12px] leading-relaxed text-tinta-media">
            correo,nombres,apellidos,rol,codigo,programa
          </code>
          <p className="mt-2 text-[12px] leading-relaxed text-tinta-suave">
            <span className="font-medium text-tinta-media">rol</span> acepta estudiante, docente,
            coordinador, administrador o invitado.{' '}
            <span className="font-medium text-tinta-media">programa</span> debe coincidir con el
            código de un programa registrado.
          </p>
        </div>

        <p className="text-[12.5px] leading-relaxed text-tinta-media">
          Antes de enviar nada verás una vista previa con las filas válidas y las que tienen
          errores. Nada se aplica hasta que confirmes.
        </p>
      </div>
    </Dialogo>
  )
}
