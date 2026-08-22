const TIPOS_PORTADA = ['image/jpeg', 'image/png', 'image/webp']
const MAXIMO_ARCHIVO = 8 * 1024 * 1024
const MAXIMO_DATO = 1_400_000

export async function prepararPortadaCompleta(archivo: File): Promise<string> {
  if (!TIPOS_PORTADA.includes(archivo.type)) throw new Error('Selecciona una imagen JPEG, PNG o WebP.')
  if (archivo.size > MAXIMO_ARCHIVO) throw new Error('La imagen original no puede superar 8 MB.')

  const temporal = URL.createObjectURL(archivo)
  try {
    const imagen = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const elemento = new Image()
      elemento.onload = () => resolver(elemento)
      elemento.onerror = () => rechazar(new Error('El archivo no contiene una imagen valida.'))
      elemento.src = temporal
    })

    const ancho = 1200
    const alto = 675
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const contexto = lienzo.getContext('2d')
    if (!contexto) throw new Error('El navegador no pudo preparar la imagen.')

    contexto.fillStyle = '#f4f7fc'
    contexto.fillRect(0, 0, ancho, alto)
    const escala = Math.min(ancho / imagen.naturalWidth, alto / imagen.naturalHeight)
    const destinoAncho = Math.round(imagen.naturalWidth * escala)
    const destinoAlto = Math.round(imagen.naturalHeight * escala)
    contexto.drawImage(imagen, (ancho - destinoAncho) / 2, (alto - destinoAlto) / 2, destinoAncho, destinoAlto)

    const dato = lienzo.toDataURL('image/webp', 0.82)
    if (dato.length > MAXIMO_DATO) throw new Error('La imagen sigue siendo demasiado pesada despues de optimizarla.')
    return dato
  } finally {
    URL.revokeObjectURL(temporal)
  }
}
