import { createContext, useContext } from 'react'
import type { Curso } from '../admin/catalogo'
import type { Reunion } from './reuniones'

export type ValorPortal = {
  cursos: Curso[]
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
  /*
    Las salas abiertas ahora mismo. Vive en el contexto y no en cada pantalla
    porque la consulta se repite cada pocos segundos: con un sondeo por
    componente, tener abiertas la barra de navegacion y la agenda a la vez
    duplicaria el trafico para pintar exactamente lo mismo.
  */
  enVivo: Reunion[]
}

export const ContextoPortal = createContext<ValorPortal | null>(null)

export function usePortal(): ValorPortal {
  const valor = useContext(ContextoPortal)
  if (!valor) throw new Error('usePortal fuera de ProveedorPortal')
  return valor
}
