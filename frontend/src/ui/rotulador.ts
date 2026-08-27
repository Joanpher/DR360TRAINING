/*
  El puente entre los tokens de color y las clases de Tailwind.

  Tailwind compila las clases que encuentra escritas enteras en el codigo, asi
  que `bg-rotulador-${color}-tenue` no existiria nunca en la hoja final. Estos
  mapas son la forma de elegir color con una variable sin perder eso: las siete
  clases estan escritas literalmente aqui, y el resto del sistema solo pasa el
  nombre del rotulador.
*/

export type Rotulador =
  | 'azul'
  | 'violeta'
  | 'cian'
  | 'menta'
  | 'ambar'
  | 'coral'
  | 'magenta'

export const rotuladores: Rotulador[] = [
  'azul',
  'violeta',
  'cian',
  'menta',
  'ambar',
  'coral',
  'magenta',
]

export const textoRotulador: Record<Rotulador, string> = {
  azul: 'text-rotulador-azul',
  violeta: 'text-rotulador-violeta',
  cian: 'text-rotulador-cian',
  menta: 'text-rotulador-menta',
  ambar: 'text-rotulador-ambar',
  coral: 'text-rotulador-coral',
  magenta: 'text-rotulador-magenta',
}

export const fondoRotulador: Record<Rotulador, string> = {
  azul: 'bg-rotulador-azul-tenue',
  violeta: 'bg-rotulador-violeta-tenue',
  cian: 'bg-rotulador-cian-tenue',
  menta: 'bg-rotulador-menta-tenue',
  ambar: 'bg-rotulador-ambar-tenue',
  coral: 'bg-rotulador-coral-tenue',
  magenta: 'bg-rotulador-magenta-tenue',
}

export const fondoRotuladorHover: Record<Rotulador, string> = {
  azul: 'group-hover:bg-rotulador-azul-tenue',
  violeta: 'group-hover:bg-rotulador-violeta-tenue',
  cian: 'group-hover:bg-rotulador-cian-tenue',
  menta: 'group-hover:bg-rotulador-menta-tenue',
  ambar: 'group-hover:bg-rotulador-ambar-tenue',
  coral: 'group-hover:bg-rotulador-coral-tenue',
  magenta: 'group-hover:bg-rotulador-magenta-tenue',
}

export const bordeRotulador: Record<Rotulador, string> = {
  azul: 'border-rotulador-azul-borde',
  violeta: 'border-rotulador-violeta-borde',
  cian: 'border-rotulador-cian-borde',
  menta: 'border-rotulador-menta-borde',
  ambar: 'border-rotulador-ambar-borde',
  coral: 'border-rotulador-coral-borde',
  magenta: 'border-rotulador-magenta-borde',
}

/* La misma tinta, pero solo cuando el raton esta sobre el grupo. */
export const textoRotuladorHover: Record<Rotulador, string> = {
  azul: 'group-hover:text-rotulador-azul',
  violeta: 'group-hover:text-rotulador-violeta',
  cian: 'group-hover:text-rotulador-cian',
  menta: 'group-hover:text-rotulador-menta',
  ambar: 'group-hover:text-rotulador-ambar',
  coral: 'group-hover:text-rotulador-coral',
  magenta: 'group-hover:text-rotulador-magenta',
}

/* La franja de color del borde superior de una tarjeta. */
export const barraRotulador: Record<Rotulador, string> = {
  azul: 'bg-rotulador-azul',
  violeta: 'bg-rotulador-violeta',
  cian: 'bg-rotulador-cian',
  menta: 'bg-rotulador-menta',
  ambar: 'bg-rotulador-ambar',
  coral: 'bg-rotulador-coral',
  magenta: 'bg-rotulador-magenta',
}

/*
  Un color estable para una cosa que no tiene color propio -un curso, una
  categoria-. Estable importa: si el mismo curso cambiara de color en cada
  recarga, el color dejaria de servir para reconocerlo.
*/
export function rotuladorDe(semilla: string): Rotulador {
  let suma = 0
  for (let i = 0; i < semilla.length; i += 1) suma = (suma * 31 + semilla.charCodeAt(i)) % 100000
  return rotuladores[suma % rotuladores.length]
}
