import { useMemo, useState } from 'react'
import { Download, ScrollText } from 'lucide-react'
import { Boton } from '../../ui/Boton'
import { Buscador } from '../../ui/Buscador'
import { EstadoVacio } from '../../ui/EstadoVacio'
import { Ficha } from '../../ui/Ficha'
import { Encabezado, Fila, Tabla, Td, TdDato, Th } from '../../ui/Tabla'
import { BarraFiltros, EncabezadoPagina, FiltroSelect, PieDeTabla } from '../piezas'
import { bitacora, personas } from '../datos'

/*
  La bitacora no se edita ni se borra: se lee. Por eso esta pantalla no tiene
  un solo boton de accion sobre las filas. En una plataforma donde se cambian
  notas y se dan de baja personas, poder responder "quien hizo esto y cuando"
  es tan importante como poder hacerlo.
*/
export function Bitacora() {
  const [texto, setTexto] = useState('')
  const [actor, setActor] = useState('todos')

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return bitacora.filter((e) => {
      if (actor !== 'todos' && e.actor !== actor) return false
      if (!buscado) return true
      return (
        e.accion.toLowerCase().includes(buscado) ||
        e.objeto.toLowerCase().includes(buscado) ||
        e.actor.toLowerCase().includes(buscado)
      )
    })
  }, [texto, actor])

  const actores = ['Sistema', ...personas.map((p) => p.nombre)].filter((nombre) =>
    bitacora.some((e) => e.actor === nombre),
  )

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        icono={ScrollText}
        color="violeta"
        titulo="Bitácora"
        descripcion="Todo cambio con consecuencias queda registrado: quién lo hizo, sobre qué y desde dónde. No se puede editar ni borrar."
        accion={
          <Boton variante="secundario" iconoIzq={<Download size={15} strokeWidth={1.5} />}>
            Exportar CSV
          </Boton>
        }
      />

      <Ficha>
        <BarraFiltros>
          <Buscador
            valor={texto}
            alCambiar={setTexto}
            placeholder="Buscar por acción, objeto o persona"
            className="min-w-[260px] flex-1"
          />
          <FiltroSelect
            etiqueta="Quién"
            valor={actor}
            alCambiar={setActor}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              ...actores.map((a) => ({ valor: a, texto: a })),
            ]}
          />
        </BarraFiltros>

        {filtrados.length === 0 ? (
          <EstadoVacio
            color="violeta"
            icono={ScrollText}
            titulo="Sin eventos que coincidan"
            texto="Prueba con otro término o quita el filtro de persona."
          />
        ) : (
          <>
            <Tabla>
              <Encabezado>
                <Th className="w-36">Cuándo</Th>
                <Th className="w-52">Quién</Th>
                <Th className="w-56">Qué hizo</Th>
                <Th>Sobre qué</Th>
                <Th className="hidden w-36 lg:table-cell">Desde</Th>
              </Encabezado>
              <tbody>
                {filtrados.map((evento) => (
                  <Fila key={evento.id}>
                    <TdDato className="text-tinta-suave">{evento.cuando}</TdDato>
                    <Td className="text-[13px] text-tinta">{evento.actor}</Td>
                    <Td className="text-[13px] text-tinta-media">{evento.accion}</Td>
                    <TdDato className="text-tinta-media">{evento.objeto}</TdDato>
                    <TdDato className="hidden text-tinta-suave lg:table-cell">
                      {evento.ip}
                    </TdDato>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
            <PieDeTabla
              mostradas={filtrados.length}
              total={bitacora.length}
              sustantivo="eventos"
            />
          </>
        )}
      </Ficha>

      <p className="text-[12.5px] leading-relaxed text-tinta-suave">
        Los eventos se conservan cinco años. La exportación incluye el rango filtrado y se
        entrega en CSV con una fila por evento.
      </p>
    </div>
  )
}
