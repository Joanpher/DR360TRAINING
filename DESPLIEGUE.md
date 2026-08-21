# Despliegue: API en Render, web en Vercel

| Pieza    | Donde  | Raiz        | Configuracion          |
| -------- | ------ | ----------- | ---------------------- |
| API Nest | Render | `backend/`  | `render.yaml`          |
| Web Vite | Vercel | `frontend/` | `frontend/vercel.json` |

## Por que Vercel hace de proxy y no se llama a Render directamente

El frontend sigue llamando a `/api/...` en relativo. Vercel reenvia esas rutas a
Render con un *rewrite*, asi que **el navegador solo ve un dominio**.

No es un capricho: la sesion se sostiene con una cookie `httpOnly` +
`SameSite=Strict`. Si la web llamara a `educa-api.onrender.com` desde
`tu-app.vercel.app`, esa cookie seria de terceros y el navegador dejaria de
mandarla —la sesion se caeria en cada refresco—. Arreglarlo por la otra via
obliga a `SameSite=None`, a CORS con credenciales y a mantener una lista de
origenes permitidos, que es mas superficie y mas cosas que se rompen. Con el
proxy no hace falta nada de eso y el codigo del frontend no cambia.

El precio es un salto extra de red por peticion. A cambio la API queda detras
del dominio de Vercel.

---

## 1. Desplegar la API en Render

1. Render → **New → Blueprint** → conectar `Joanpher/DR360TRAINING`.
   Detecta `render.yaml` y crea el servicio `educa-api`.
2. Rellenar las variables marcadas como `sync: false`:

   | Variable            | Valor                                         |
   | ------------------- | --------------------------------------------- |
   | `DATABASE_URL_APP`  | `postgres://educa_app:CLAVE@HOST:5432/educa`  |
   | `DATABASE_URL_AUTH` | `postgres://educa_auth:CLAVE@HOST:5432/educa` |
   | `JWT_SECRETO`       | secreto largo y aleatorio                     |
   | `ORIGEN_WEB`        | dejar vacia (ver mas abajo)                   |

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   `PORT` lo inyecta Render (10000): no definirlo. `DATABASE_URL` —el usuario
   maestro— tampoco: solo lo usa `db/migrar.mjs` desde tu maquina, y lo que no
   esta subido no se puede filtrar.

3. Ajustar `region` en `render.yaml` a la region de RDS si no es `virginia`.
   Cada consulta cruza esa distancia.
4. Anotar la URL que asigna Render, del estilo `https://educa-api.onrender.com`.

### Acceso a RDS

La instancia tiene que aceptar conexiones desde Render: accesible
publicamente y con el *security group* abierto. Render solo da IPs de salida
fijas —para meterlas en la lista— a partir de los planes de pago.

### Comprobacion

```
GET https://educa-api.onrender.com/api/salud
```

Debe responder `{"api":"ok","base":"ok",...}`. Si dice `"base":"sin conexion"`,
el proceso vive pero no alcanza RDS: es red o credenciales, no despliegue.

### Sobre el plan free

Se duerme a los 15 minutos sin trafico y la siguiente peticion tarda ~30-60
segundos en despertarlo. Para enseñarle el sistema a alguien, conviene abrir
`/api/salud` un minuto antes.

## 2. Apuntar el frontend a esa URL

En [`frontend/vercel.json`](frontend/vercel.json), cambiar el `destination` por
la URL real de Render:

```json
{
  "source": "/api/:ruta*",
  "destination": "https://TU-SERVICIO.onrender.com/api/:ruta*"
}
```

El `/api` se conserva en los dos lados porque Nest sirve todo bajo ese prefijo.

Las respuestas de la API llevan datos de sesion, asi que la cabecera
`x-vercel-enable-rewrite-caching: 0` corta cualquier cacheo en el CDN. Sin ella,
Vercel respeta las cabeceras de cache de la API y una respuesta de un usuario
podria acabar servida a otro.

## 3. Desplegar la web en Vercel

1. Vercel → **Add New → Project** → importar el repositorio.
2. **Root Directory: `frontend`** (importante: ahi vive `vercel.json`).
   Framework: Vite. El resto por defecto.
3. **Deploy**. El frontend no necesita ninguna variable de entorno.

La regla `"/(.*)" → "/index.html"` es el *fallback* del SPA. Se aplica solo
cuando ningun fichero estatico coincide, asi que `/assets/*` no se ve afectado.

## 4. Migraciones

No las ejecuta ninguna de las dos plataformas. Se aplican a mano contra RDS con
el usuario maestro, antes de publicar:

```bash
cd backend
npm run db:estado    # que hay aplicado
npm run db:migrar    # aplicar lo pendiente
```

`educa_app` y `educa_auth` se crean sin contrasena en la migracion 0001: hay que
asignarselas con el usuario maestro antes de que la API arranque.

## 5. Verificar

- `https://TU-APP.vercel.app/api/salud` → `api: ok`, `base: ok`. Que responda
  **por el dominio de Vercel** es lo que confirma que el proxy funciona.
- Entrar a `/admin/grados` y recargar: sigue en pie (fallback del SPA).
- Iniciar sesion, recargar y ver que la sesion sobrevive: la cookie de refresco
  viaja bien.

## Notas

- `NODE_ENV=production` va fijado en `render.yaml`, y de el dependen el
  `secure: true` y el `SameSite=Strict` de la cookie de refresco.
- `ORIGEN_WEB` solo entra en juego si alguien llama a la API sin pasar por el
  proxy. A traves de Vercel el navegador ni siquiera manda `Origin`, asi que
  CORS no interviene.
- El pool va a 5 conexiones (`PG_POOL_MAX`) porque hay dos pools por instancia y
  la instancia de RDS esta compartida con otros proyectos.
- La conexion a RDS usa `rejectUnauthorized: false` por el certificado de la CA
  de AWS. Endurecerlo pasa por cargar el bundle de AWS y ponerlo en `true`.
