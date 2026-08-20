import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fijarAcceso, fijarRenovador, pedir } from '../datos/api'

export type Usuario = {
  id: string
  correo: string
  nombres: string
  apellidos: string
  nombreCompleto: string
  correoVerificado: boolean
}

export type InstitucionDelUsuario = {
  id: string
  slug: string
  nombre: string
  siglas: string | null
  estado: string
  roles: string[]
  membresiaId: string
}

type RespuestaSesion = {
  acceso: string
  usuario: Usuario
  instituciones: InstitucionDelUsuario[]
  institucionActual: string | null
}

export type DatosRegistro = {
  nombres: string
  apellidos: string
  correo: string
  contrasena: string
}

export type DatosInstitucion = {
  nombre: string
  slug: string
  siglas: string
  tipo: string
  pais: string
  zonaHoraria: string
}

/*
  Tres estados y no dos. "cargando" existe porque al abrir la pagina todavia no
  se sabe si hay sesion: hay que preguntarselo al servidor con la cookie de
  refresco. Sin ese estado intermedio, la aplicacion parpadea mostrando la
  pantalla de acceso a alguien que si tiene sesion abierta.
*/
type Estado = 'cargando' | 'fuera' | 'dentro'

type Valor = {
  estado: Estado
  usuario: Usuario | null
  instituciones: InstitucionDelUsuario[]
  institucion: InstitucionDelUsuario | null
  roles: string[]
  entrar: (identidad: string, contrasena: string) => Promise<void>
  registrar: (datos: DatosRegistro) => Promise<void>
  salir: () => Promise<void>
  elegirInstitucion: (id: string) => Promise<void>
  crearInstitucion: (datos: DatosInstitucion) => Promise<void>
  /*
    Vuelve a leer quien soy y a que instituciones pertenezco, sin tocar los
    tokens. Hace falta cuando algo de dentro cambia lo que la barra superior
    muestra -renombrar la institucion, cambiar sus siglas-: sin esto el nombre
    viejo se queda en pantalla hasta que alguien recarga.
  */
  refrescarContexto: () => Promise<void>
}

const Contexto = createContext<Valor | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [instituciones, setInstituciones] = useState<InstitucionDelUsuario[]>([])
  const [institucionId, setInstitucionId] = useState<string | null>(null)

  const aplicar = useCallback((r: RespuestaSesion) => {
    fijarAcceso(r.acceso)
    setUsuario(r.usuario)
    setInstituciones(r.instituciones)
    setInstitucionId(r.institucionActual)
    setEstado('dentro')
  }, [])

  const limpiar = useCallback(() => {
    fijarAcceso(null)
    setUsuario(null)
    setInstituciones([])
    setInstitucionId(null)
    setEstado('fuera')
  }, [])

  // Al arrancar y cuando un token caduca: la cookie de refresco decide.
  useEffect(() => {
    let vigente = true

    const renovar = async () => {
      try {
        const r = await pedir<RespuestaSesion>('/auth/refrescar', { metodo: 'POST' })
        if (vigente) aplicar(r)
        return true
      } catch {
        if (vigente) limpiar()
        return false
      }
    }

    fijarRenovador(renovar)
    void renovar()

    return () => {
      vigente = false
      fijarRenovador(null)
    }
  }, [aplicar, limpiar])

  /*
    "identidad" y no "correo": el personal entra con su correo y un estudiante
    de colegio con su matricula, porque un nino de primaria no tiene correo. El
    servidor distingue una de otra por la arroba.
  */
  const entrar = useCallback(
    async (identidad: string, contrasena: string) => {
      aplicar(
        await pedir<RespuestaSesion>('/auth/entrar', {
          metodo: 'POST',
          cuerpo: { identidad, contrasena },
        }),
      )
    },
    [aplicar],
  )

  const registrar = useCallback(
    async (datos: DatosRegistro) => {
      aplicar(
        await pedir<RespuestaSesion>('/auth/registro', { metodo: 'POST', cuerpo: datos }),
      )
    },
    [aplicar],
  )

  const salir = useCallback(async () => {
    await pedir('/auth/salir', { metodo: 'POST' }).catch(() => undefined)
    limpiar()
  }, [limpiar])

  const elegirInstitucion = useCallback(
    async (id: string) => {
      aplicar(
        await pedir<RespuestaSesion>('/auth/institucion', {
          metodo: 'POST',
          cuerpo: { institucionId: id },
        }),
      )
    },
    [aplicar],
  )

  const refrescarContexto = useCallback(async () => {
    const r = await pedir<Omit<RespuestaSesion, 'acceso'>>('/auth/yo')
    setUsuario(r.usuario)
    setInstituciones(r.instituciones)
    setInstitucionId(r.institucionActual)
  }, [])

  const crearInstitucion = useCallback(
    async (datos: DatosInstitucion) => {
      aplicar(
        await pedir<RespuestaSesion>('/instituciones', { metodo: 'POST', cuerpo: datos }),
      )
    },
    [aplicar],
  )

  const valor = useMemo<Valor>(() => {
    const institucion = instituciones.find((i) => i.id === institucionId) ?? null
    return {
      estado,
      usuario,
      instituciones,
      institucion,
      roles: institucion?.roles ?? [],
      entrar,
      registrar,
      salir,
      elegirInstitucion,
      crearInstitucion,
      refrescarContexto,
    }
  }, [
    estado,
    usuario,
    instituciones,
    institucionId,
    entrar,
    registrar,
    salir,
    elegirInstitucion,
    crearInstitucion,
    refrescarContexto,
  ])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): Valor {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSesion fuera de ProveedorSesion')
  return valor
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
