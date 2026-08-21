# Despliegue en Vercel

El repositorio se despliega como **un solo proyecto de Vercel con dos servicios**
(`vercel.json` en la raiz):

| Servicio   | Raiz        | Que es                          | Rutas publicas |
| ---------- | ----------- | ------------------------------- | -------------- |
| `frontend` | `frontend/` | React + Vite (estatico)         | todo lo demas  |
| `backend`  | `backend/`  | NestJS (Vercel Function, Fluid) | `/api/*`       |

Los dos comparten dominio. Eso importa mas de lo que parece: la cookie de
refresco es `httpOnly` + `SameSite=Strict`, y solo viaja limpia si la web y la
API estan en el mismo origen. Por eso el frontend llama a `/api/...` en relativo
y no hay ninguna URL de API que configurar.

El servicio recibe la ruta original: `/api/salud` le llega al backend como
`/api/salud`, que es justo lo que espera el `setGlobalPrefix('api')` de Nest.

---

## 1. Variables de entorno en Vercel

En el panel del proyecto → **Settings → Environment Variables**. Marcar
Production y Preview (y Development si se va a usar `vercel dev`).

| Variable            | Obligatoria | Valor                                                       |
| ------------------- | ----------- | ----------------------------------------------------------- |
| `DATABASE_URL_APP`  | si          | `postgres://educa_app:CLAVE@HOST:5432/educa`                 |
| `DATABASE_URL_AUTH` | si          | `postgres://educa_auth:CLAVE@HOST:5432/educa`                |
| `JWT_SECRETO`       | si          | secreto largo y aleatorio (ver abajo)                        |
| `JWT_MINUTOS`       | no          | `15` por defecto                                             |
| `REFRESCO_DIAS`     | no          | `30` por defecto                                             |
| `PG_POOL_MAX`       | no          | `5` por defecto                                              |
| `ORIGEN_WEB`        | no          | solo si algun cliente externo consume la API                 |

Generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Dos cosas que **no** hay que poner:

- `PORT` — lo inyecta Vercel.
- `DATABASE_URL` (el usuario maestro) — solo lo usa `db/migrar.mjs` desde tu
  maquina. Si no esta en Vercel, no puede filtrarse desde ahi.

El frontend no necesita ninguna variable.

## 2. Acceso desde Vercel a RDS

Las funciones salen a internet con IP variable, asi que la instancia de RDS
tiene que ser accesible publicamente y su *security group* aceptar el trafico.
Si abrir el grupo entero no es aceptable, la alternativa es
[Secure Compute](https://vercel.com/docs/networking/secure-compute), que da IPs
fijas para poner en la lista.

Comprobacion rapida despues del primer despliegue:

```
GET https://TU-PROYECTO.vercel.app/api/salud
```

Debe responder `{"api":"ok","base":"ok",...}`. Si dice `"base":"sin conexion"`,
el problema es la red o las credenciales de RDS, no el despliegue.

## 3. Migraciones

Vercel **no** ejecuta migraciones. Se aplican a mano contra RDS antes de
publicar, con el usuario maestro:

```bash
cd backend
npm run db:estado    # que hay aplicado
npm run db:migrar    # aplicar lo pendiente
```

Recordar que `educa_app` y `educa_auth` se crean sin contrasena en la migracion
0001; hay que asignarselas con el usuario maestro antes de que la API arranque.

## 4. Importar el proyecto

1. Vercel → **Add New → Project** → importar `Joanpher/DR360TRAINING`.
2. Dejar el **Root Directory** en la raiz del repositorio (no elegir
   `frontend/` ni `backend/`): los servicios los define `vercel.json`.
3. Cargar las variables del paso 1.
4. **Deploy**.

Con la CLI seria lo mismo desde la raiz:

```bash
npx vercel        # preview
npx vercel --prod # produccion
```

## 5. Verificar despues de desplegar

- `/api/salud` → `api: ok`, `base: ok`.
- La landing carga en `/`.
- Entrar a `/admin/grados` y **recargar la pagina**: debe seguir funcionando.
  Eso confirma que el *fallback* SPA del servicio `frontend` esta bien (la
  regla `"/(.*)" → "/index.html"` dentro del servicio; se aplica solo cuando
  no hay un fichero estatico que coincida, asi que `/assets/*` no se ve
  afectado).
- Iniciar sesion y recargar: si la sesion sobrevive, la cookie de refresco
  viaja bien.

## Notas

- `NODE_ENV` vale `production` en Vercel por si solo, y de eso dependen el
  `secure: true` y el `SameSite=Strict` de la cookie de refresco.
- La conexion a RDS usa `rejectUnauthorized: false` porque el certificado es de
  la CA de AWS. Endurecerlo pasa por cargar el bundle de AWS y ponerlo en
  `true`.
- El pool va a 5 conexiones por defecto: hay dos pools por instancia de funcion
  y varias instancias a la vez, y la instancia de RDS esta compartida con otros
  proyectos.
