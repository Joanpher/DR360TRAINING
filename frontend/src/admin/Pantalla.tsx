import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Boton } from '../ui/Boton'
import type { Rotulador } from '../ui/rotulador'
import { EncabezadoPagina, Esqueleto, Nota } from './piezas'

/*
  Las cuatro pantallas de estructura académica -y las que vienen después- se
  abren igual: piden una lista, y mientras llega no hay nada que enseñar. Este
  componente se queda con esos tres estados (cargando, falló, listo) para que
  cada pantalla escriba solo el tercero.

  El estado de error tiene botón de reintentar porque el fallo más común no es
  un permiso denegado sino una petición que no llegó: en ese caso volver a
  pedirla es exactamente lo que hay que hacer, y obligar a recargar la página
  entera para conseguirlo es peor.
*/
export function Pantalla<T>({
  titulo,
  descripcion,
  icono,
  color,
  accion,
  datos,
  cargando,
  error,
  recargar,
  children,
}: {
  titulo: string
  descripcion?: string
  icono?: LucideIcon
  color?: Rotulador
  accion?: ReactNode
  datos: T | null
  cargando: boolean
  error: string | null
  recargar: () => void
  children: (datos: T) => ReactNode
}) {
  if (cargando && !datos) {
    return (
      <div className="space-y-6">
        <EncabezadoPagina
          titulo={titulo}
          descripcion={descripcion}
          icono={icono}
          color={color}
        />
        <Esqueleto filas={4} />
      </div>
    )
  }

  if (error && !datos) {
    return (
      <div className="space-y-6">
        <EncabezadoPagina
          titulo={titulo}
          descripcion={descripcion}
          icono={icono}
          color={color}
        />
        <Nota tono="error">{error}</Nota>
        <Boton variante="secundario" onClick={recargar}>
          Reintentar
        </Boton>
      </div>
    )
  }

  if (!datos) return null

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo={titulo}
        descripcion={descripcion}
        icono={icono}
        color={color}
        accion={accion}
      />
      {children(datos)}
    </div>
  )
}
