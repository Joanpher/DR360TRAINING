/*
  Las cuentas de fechas que comparten los dos calendarios, el del estudiante y
  el de quien imparte. Vivian dentro de CalendarioEstudiante hasta que hubo un
  segundo calendario; se sacaron aqui en vez de copiarlas porque una rejilla de
  mes que empieza en lunes en una pantalla y en domingo en otra es la clase de
  discrepancia que nadie nota hasta que alguien falta a una clase.

  Todo en hora local a proposito. El servidor manda y recibe UTC, pero un
  calendario se mira desde donde uno esta: una entrega que vence a las 23:00 del
  martes en Santo Domingo tiene que caer en el martes de la rejilla, no en el
  miercoles UTC.
*/

export const DIAS_REJILLA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

/*
  Las seis semanas que se pintan de un mes. Seis y no las que hagan falta: con
  un numero fijo la rejilla no cambia de alto al pasar de mes, que es un salto
  visual molesto y ademas mueve los botones bajo el cursor.
*/
export function rangoCalendario(mes: Date) {
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  // getDay() da 0 para domingo; esto lo convierte a "cuantos dias hay que
  // retroceder para llegar al lunes de esa semana".
  const desplazamiento = (primero.getDay() + 6) % 7
  const desde = new Date(primero)
  desde.setDate(desde.getDate() - desplazamiento)
  const dias = Array.from({ length: 42 }, (_, indice) => {
    const fecha = new Date(desde)
    fecha.setDate(fecha.getDate() + indice)
    return fecha
  })
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + 42)
  return { desde, hasta, dias }
}

export function inicioDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

/* La clave con la que se agrupa por dia. Local, no toISOString(). */
export function claveFecha(fecha: Date): string {
  const ano = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function formatoDiaCompleto(fecha: Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fecha)
}

export function horaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}
