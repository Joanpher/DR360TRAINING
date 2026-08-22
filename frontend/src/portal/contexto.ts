import { createContext, useContext } from 'react'
import type { Curso } from '../admin/catalogo'

export type ValorPortal = {
  cursos: Curso[]
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
}

export const ContextoPortal = createContext<ValorPortal | null>(null)

export function usePortal(): ValorPortal {
  const valor = useContext(ContextoPortal)
  if (!valor) throw new Error('usePortal fuera de ProveedorPortal')
  return valor
}
