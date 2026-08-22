import { useMemo, useState } from 'react'
import { Clock, Send, UserPlus } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { cn } from '../../ui/cn'
import { DialogoInvitar } from '../DialogoInvitar'
import {
  BarraFiltros,
  EncabezadoPagina,
  EstadoDeInvitacion,
  FiltroSelect,
  MenuFila,
  PieDeTabla,
  RolesDePersona,
} from '../piezas'
import { invitaciones, type Invitacion } from '../datos'

/*
  Las invitaciones son personas a medio entrar, y por eso tienen pantalla
  propia y no una fila mas en usuarios: lo que se hace con ellas es distinto
  -reenviar, revocar, esperar- y lo que importa es el tiempo que les queda.

  Una invitacion que vence manana no es lo mismo que una que vence en cinco
  dias, asi que la columna de expiracion se resalta cuando aprieta.
*/
export function Invitaciones() {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('pendiente')
  const [invitando, setInvitando] = useState(false)

  const filtradas = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return invitaciones.filter((i) => {
      if (estado !== 'todas' && i.estado !== estado) return false
      if (!buscado) return true
      return i.correo.toLowerCase().includes(buscado)
    })
  }, [texto, estado])

  const pendientes = invitaciones.filter((i) => i.estado === 'pendiente')

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Invitaciones"
        descripcion="Nadie entra a una institución sin aceptar una invitación. Hasta que la acepta, la persona no tiene membresía y no ve un solo dato de la institución."
        accion={
          <Boton
            variante="primario"
            iconoIzq={<UserPlus size={15} strokeWidth={1.5} />}
            onClick={() => setInvitando(true)}
          >
            Invitar persona
          </Boton>
        }
      />

      {pendientes.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-aviso/25 bg-aviso-tenue px-4 py-3">
          <Clock size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-aviso" />
          <p className="text-[13px] leading-relaxed text-tinta">
            <span className="font-medium">
              {pendientes.length} invitaciones esperando respuesta.
            </span>{' '}
            <span className="text-tinta-media">
              Una vence mañana. Al vencer, el enlace deja de funcionar y hay que enviar una
              nueva.
            </span>
          </p>
        </div>
      )}

      <Ficha>
        <BarraFiltros>
          <Buscador
            valor={texto}
            alCambiar={setTexto}
            placeholder="Buscar por correo"
            className="min-w-[240px] flex-1"
          />
          <FiltroSelect
            etiqueta="Estado"
            valor={estado}
            alCambiar={setEstado}
            opciones={[
              { valor: 'pendiente', texto: 'Pendientes' },
              { valor: 'aceptada', texto: 'Aceptadas' },
              { valor: 'expirada', texto: 'Expiradas' },
              { valor: 'revocada', texto: 'Revocadas' },
              { valor: 'todas', texto: 'Todas' },
            ]}
          />
        </BarraFiltros>

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={Send}
            titulo="No hay invitaciones aquí"
            texto="Cuando invites a alguien, aparecerá en esta lista hasta que acepte o venza el enlace."
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
                <Th>Correo</Th>
                <Th className="w-56">Roles</Th>
                <Th className="w-28">Estado</Th>
                <Th className="w-32">Vence</Th>
                <Th className="hidden w-40 lg:table-cell">Invitada por</Th>
                <Th className="w-10" />
              </Encabezado>
              <tbody>
                {filtradas.map((invitacion) => (
                  <Fila key={invitacion.id}>
                    <TdDato className="text-tinta">{invitacion.correo}</TdDato>
                    <Td>
                      <RolesDePersona roles={invitacion.roles} />
                    </Td>
                    <Td>
                      <EstadoDeInvitacion estado={invitacion.estado} />
                    </Td>
                    <TdDato
                      className={cn(
                        invitacion.expira === 'Mañana'
                          ? 'font-medium text-aviso'
                          : 'text-tinta-media',
                      )}
                    >
                      {invitacion.expira}
                    </TdDato>
                    <Td className="hidden text-[13px] text-tinta-media lg:table-cell">
                      {invitacion.invitadaPor}
                    </Td>
                    <Td className="pr-3">
                      <MenuFila acciones={accionesDe(invitacion)} />
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
            <PieDeTabla
              mostradas={filtradas.length}
              total={invitaciones.length}
              sustantivo="invitaciones"
            />
          </>
        )}
      </Ficha>

      <DialogoInvitar abierto={invitando} alCerrar={() => setInvitando(false)} />
    </div>
  )
}

function accionesDe(invitacion: Invitacion) {
  if (invitacion.estado === 'pendiente') {
    return [
      { etiqueta: 'Reenviar correo', alElegir: () => {} },
      { etiqueta: 'Copiar enlace', alElegir: () => {} },
      { etiqueta: 'Editar roles', alElegir: () => {} },
      { etiqueta: 'Revocar invitación', alElegir: () => {}, peligrosa: true },
    ]
  }
  return [
    { etiqueta: 'Volver a invitar', alElegir: () => {} },
    { etiqueta: 'Eliminar del historial', alElegir: () => {}, peligrosa: true },
  ]
}
