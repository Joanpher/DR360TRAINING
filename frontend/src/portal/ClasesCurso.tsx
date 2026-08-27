import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, MapPin, Plus } from 'lucide-react'
import {
  DIAS_SEMANA,
  fechaLegible,
  nombreModalidad,
  type Curso,
} from '../admin/catalogo'
import { useConsulta } from '../datos/consulta'
import { DialogoNuevaReunion, ListaReuniones } from './piezasClase'
import type { RespuestaCurso, Reunion } from './reuniones'
import { Boton } from '../ui/Boton'
import { Ficha, FichaCabecera } from '../ui/Ficha'

/*
  La pestana "Clases" de un curso: las sesiones en vivo arriba y el horario
  semanal debajo.

  Estan juntas porque responden a la misma pregunta desde dos distancias.
  "Cuando es la clase" lo contesta el horario, que es lo que se pacto al
  inscribirse y no cambia. "Donde entro ahora" lo contesta la sala, que existe
  solo ese rato. Separarlas en dos pestanas obligaria a mirar en dos sitios
  para saber si hay clase hoy.
*/

const CADA = 20_000

export function ClasesCurso({ curso }: { curso: Curso }) {
  const { datos, cargando, error, recargar, fijar } = useConsulta<RespuestaCurso>(
    `/reuniones/curso/${curso.id}`,
  )
  const [convocando, setConvocando] = useState(false)

  useEffect(() => {
    const reloj = setInterval(() => void recargar(), CADA)
    return () => clearInterval(reloj)
  }, [recargar])

  const reemplazar = useCallback(
    (reunion: Reunion) => {
      fijar((previo) =>
        previo
          ? {
              ...previo,
              reuniones: previo.reuniones.some((r) => r.id === reunion.id)
                ? previo.reuniones.map((r) => (r.id === reunion.id ? reunion : r))
                : [reunion, ...previo.reuniones],
            }
          : { reuniones: [reunion], puedeGestionar: true },
      )
    },
    [fijar],
  )

  const puedeGestionar = datos?.puedeGestionar ?? false
  const reuniones = datos?.reuniones ?? []
  const activas = reuniones.filter(
    (r) => r.salaAbierta || r.estado === 'programada' || r.estado === 'en_curso',
  )
  const pasadas = reuniones.filter(
    (r) => r.estado === 'finalizada' || r.estado === 'cancelada',
  )

  const convocar = puedeGestionar && (
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
    return <div className="h-64 animate-pulse rounded-md bg-superficie" />
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="border border-correccion/30 bg-correccion-tenue px-3 py-2 text-[12.5px] text-correccion">
          {error}
        </p>
      )}

      <ListaReuniones
        titulo="Sesiones en vivo"
        descripcion={
          puedeGestionar
            ? 'Abre la sala y el grupo la verá aparecer en su pantalla.'
            : 'Entra cuando el instructor abra la sala.'
        }
        reuniones={activas}
        alCambiar={reemplazar}
        accion={convocar || undefined}
        vacio={{
          titulo: 'No hay sesiones convocadas',
          texto: puedeGestionar
            ? 'Convoca una sesión ahora o prográmala para más tarde. La sala se crea sola.'
            : 'Cuando el instructor abra una sala aparecerá aquí y podrás unirte.',
        }}
      />

      {pasadas.length > 0 && (
        <ListaReuniones
          titulo="Sesiones anteriores"
          reuniones={pasadas}
          alCambiar={reemplazar}
          vacio={{ titulo: '', texto: '' }}
        />
      )}

      <HorarioSemanal curso={curso} />

      {convocando && (
        <DialogoNuevaReunion
          abierto
          alCerrar={() => setConvocando(false)}
          cursoId={curso.id}
          cursoNombre={`${curso.codigo} · ${curso.nombre}`}
          alCrear={reemplazar}
        />
      )}
    </div>
  )
}

function HorarioSemanal({ curso }: { curso: Curso }) {
  if (curso.horarios.length === 0) return null

  return (
    <Ficha>
      <FichaCabecera
        titulo="Horario semanal"
        descripcion={`${fechaLegible(curso.iniciaEn)} – ${fechaLegible(curso.terminaEn)}`}
      />
      <ul>
        {curso.horarios.map((horario) => (
          <li
            key={`${horario.diaSemana}-${horario.horaInicio}`}
            className="flex flex-wrap items-center gap-4 border-b border-regla px-5 py-4 last:border-b-0"
          >
            <CalendarClock size={18} className="text-pizarra" />
            <div className="min-w-36">
              <p className="text-[14px] font-semibold text-tinta">
                {DIAS_SEMANA[horario.diaSemana - 1]?.largo}
              </p>
              <p className="font-dato text-[12px] text-tinta-media">
                {horario.horaInicio} – {horario.horaFin}
              </p>
            </div>
            <p className="ml-auto flex items-center gap-2 text-[13px] text-tinta-media">
              <MapPin size={14} />{' '}
              {[curso.sede, curso.aula].filter(Boolean).join(' · ') ||
                nombreModalidad[curso.modalidad]}
            </p>
          </li>
        ))}
      </ul>
    </Ficha>
  )
}
