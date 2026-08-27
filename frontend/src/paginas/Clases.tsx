import { useCallback, useEffect, useState } from 'react'
import { Plus, Radio, Video } from 'lucide-react'
import { useRol } from '../app/rol'
import { useConsulta } from '../datos/consulta'
import { usePortal } from '../portal/contexto'
import { DialogoNuevaReunion, ListaReuniones } from '../portal/piezasClase'
import type { RespuestaAgenda, Reunion } from '../portal/reuniones'
import { Boton } from '../ui/Boton'
import { EstadoVacio } from '../ui/EstadoVacio'
import { Ficha } from '../ui/Ficha'

/*
  Clases en vivo, de todos los cursos a la vez.

  El orden de la pagina es el orden de la urgencia: lo que esta ocurriendo
  ahora, lo que viene, y al final lo que ya paso. Un alumno que abre esta
  pantalla porque le han dicho "entra a la clase" tiene que encontrar el boton
  sin leer nada.

  Se recarga sola cada veinte segundos. Una clase que empieza no llega por
  ningun canal en vivo -no hay websockets en este sistema-, asi que sin esto
  habria que refrescar el navegador para ver aparecer la sala. Veinte segundos
  es suficientemente rapido para lo que cuesta: una consulta corta por persona.
*/
const CADA = 20_000

export function Clases() {
  const { rol } = useRol()
  const { cursos } = usePortal()
  const { datos, cargando, error, recargar, fijar } =
    useConsulta<RespuestaAgenda>('/reuniones/agenda')
  const [convocando, setConvocando] = useState(false)

  useEffect(() => {
    const reloj = setInterval(() => void recargar(), CADA)
    return () => clearInterval(reloj)
  }, [recargar])

  /*
    Cuando una tarjeta cambia de estado, el servidor devuelve la reunion ya
    actualizada. Se coloca en su sitio en vez de volver a pedir la agenda
    entera: pedirla haria parpadear la lista justo cuando alguien acaba de
    pulsar un boton.
  */
  const reemplazar = useCallback(
    (reunion: Reunion) => {
      fijar((previo) =>
        previo
          ? {
              reuniones: previo.reuniones.some((r) => r.id === reunion.id)
                ? previo.reuniones.map((r) => (r.id === reunion.id ? reunion : r))
                : [reunion, ...previo.reuniones],
            }
          : { reuniones: [reunion] },
      )
    },
    [fijar],
  )

  const puedeConvocar = rol === 'docente' || rol === 'admin'
  const reuniones = datos?.reuniones ?? []
  const enVivo = reuniones.filter((r) => r.salaAbierta)
  const proximas = reuniones.filter((r) => !r.salaAbierta && r.estado === 'programada')
  const pasadas = reuniones.filter(
    (r) => r.estado === 'finalizada' || r.estado === 'cancelada',
  )

  const convocar = puedeConvocar && (
    <Boton
      variante="primario"
      tamano="sm"
      iconoIzq={<Plus size={15} />}
      onClick={() => setConvocando(true)}
    >
      Convocar clase
    </Boton>
  )

  if (cargando && !datos) {
    return <div className="h-[420px] animate-pulse rounded-md bg-superficie" />
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-tight text-tinta">
            Clases en vivo
          </h1>
          <p className="mt-1 text-[13px] text-tinta-media">
            {rol === 'estudiante'
              ? 'Aquí aparecen las sesiones que abren tus instructores.'
              : 'Convoca una sala, inicia la sesión y pasa lista sin salir de aquí.'}
          </p>
        </div>
        {convocar}
      </header>

      {error && (
        <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12.5px] text-correccion">
          {error}
        </p>
      )}

      {reuniones.length === 0 ? (
        <Ficha>
          <EstadoVacio
            icono={Video}
            titulo="No hay clases en vivo"
            texto={
              puedeConvocar
                ? 'Convoca una sesión y tu grupo la verá aparecer aquí al instante.'
                : 'Cuando tu instructor abra una sala, la verás en esta pantalla y podrás unirte con un clic.'
            }
            accion={convocar || undefined}
          />
        </Ficha>
      ) : (
        <>
          {enVivo.length > 0 && (
            <ListaReuniones
              titulo="Ahora mismo"
              descripcion="Salas abiertas: puedes entrar ya."
              reuniones={enVivo}
              alCambiar={reemplazar}
              mostrarCurso
              vacio={{ titulo: '', texto: '' }}
            />
          )}

          {proximas.length > 0 && (
            <ListaReuniones
              titulo="Próximas"
              descripcion="Programadas y todavía sin abrir."
              reuniones={proximas}
              alCambiar={reemplazar}
              mostrarCurso
              vacio={{ titulo: '', texto: '' }}
            />
          )}

          {pasadas.length > 0 && (
            <ListaReuniones
              titulo="Últimos siete días"
              reuniones={pasadas}
              alCambiar={reemplazar}
              mostrarCurso
              vacio={{ titulo: '', texto: '' }}
            />
          )}

          {enVivo.length === 0 && proximas.length === 0 && (
            <Ficha>
              <EstadoVacio
                icono={Radio}
                titulo="Nada en vivo ahora"
                texto="No hay salas abiertas ni sesiones programadas por delante."
                accion={convocar || undefined}
              />
            </Ficha>
          )}
        </>
      )}

      {convocando && (
        <DialogoNuevaReunion
          abierto
          alCerrar={() => setConvocando(false)}
          cursos={cursos.map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre }))}
          alCrear={reemplazar}
        />
      )}
    </div>
  )
}
