import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorApi, pedir } from './api'

/*
  Lo mínimo para que una pantalla del panel lea del servidor sin repetir en
  cada una el mismo cuarteto de useState. No es una caché ni un cliente de
  datos: no reintenta, no deduplica, no revalida en foco. Si algún día hace
  falta eso, se cambia por una biblioteca; mientras tanto, esto se lee entero
  de una sentada y no esconde nada.

  Dos detalles que no son adorno:

  - `vigente` cancela el efecto de una petición cuya pantalla ya se desmontó.
    Sin eso React avisa de un setState sobre un componente muerto, y peor: una
    respuesta lenta puede pisar los datos de la pantalla siguiente.
  - `fijar` deja que quien guarda actualice la vista con lo que devolvió el
    servidor, sin pedir otra vez lo mismo. Los endpoints de escritura del panel
    devuelven el estado ya actualizado justo para esto.
*/
export function useConsulta<T>(ruta: string) {
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const vigente = useRef(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const respuesta = await pedir<T>(ruta)
      if (vigente.current) setDatos(respuesta)
    } catch (e) {
      if (vigente.current) {
        setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los datos.')
      }
    } finally {
      if (vigente.current) setCargando(false)
    }
  }, [ruta])

  useEffect(() => {
    vigente.current = true
    void cargar()
    return () => {
      vigente.current = false
    }
  }, [cargar])

  return { datos, cargando, error, recargar: cargar, fijar: setDatos }
}

/*
  El otro lado: guardar. Devuelve el estado de la operación para que el botón
  pueda decir "Guardando…" y el formulario mostrar el error donde ocurrió, en
  vez de un aviso global que no dice a qué campo mirar.

  El mensaje de éxito se borra solo a los pocos segundos porque no es
  información: es un acuse de recibo. El de error no, porque hay que leerlo.
*/
export function useGuardar() {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    [],
  )

  const guardar = useCallback(async <R>(operacion: () => Promise<R>): Promise<R | null> => {
    setGuardando(true)
    setError(null)
    setListo(false)
    try {
      const resultado = await operacion()
      setListo(true)
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setListo(false), 4000)
      return resultado
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
      return null
    } finally {
      setGuardando(false)
    }
  }, [])

  return { guardar, guardando, error, listo, limpiarError: () => setError(null) }
}
