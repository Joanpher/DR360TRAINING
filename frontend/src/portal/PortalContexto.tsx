import type { ReactNode } from 'react'
import type { Curso } from '../admin/catalogo'
import { useConsulta } from '../datos/consulta'
import { ContextoPortal } from './contexto'

export function ProveedorPortal({ children }: { children: ReactNode }) {
  const { datos, cargando, error, recargar } = useConsulta<{ cursos: Curso[] }>(
    '/portal/cursos',
  )

  return (
    <ContextoPortal.Provider
      value={{ cursos: datos?.cursos ?? [], cargando, error, recargar }}
    >
      {children}
    </ContextoPortal.Provider>
  )
}
