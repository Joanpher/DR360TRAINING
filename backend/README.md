# API de DR360TRAINING

NestJS sobre PostgreSQL. La particularidad del proyecto es que **el aislamiento
entre instituciones no lo hace este código**: lo hace la base de datos con Row
Level Security. Aquí no se escribe `where institucion_id = ...` en ninguna
consulta — se abre la transacción, se fija el contexto y Postgres decide qué
filas existen. El detalle está en [db/README.md](db/README.md).

## Arrancar

```bash
cp .env.example .env    # y rellenar las tres URL de conexión y el JWT_SECRETO
npm install
npm run db:migrar       # aplica lo que falte en la base
npm run start:dev       # http://localhost:3000/api
```

`GET /api/salud` responde si la API y la base están vivas.

## Los dos pools

| Pool | Rol de Postgres | Para qué |
|---|---|---|
| `conContexto()` | `educa_app` | todo el negocio, con usuario e institución fijados |
| `conIdentidad()` | `educa_auth` | login, registro, refresco, invitaciones |

`educa_auth` existe porque el login ocurre **antes** de que haya usuario o
institución en el contexto. Sin un rol aparte habría que abrir un agujero en las
políticas de `usuarios` para todo el mundo. Además ninguno de los dos puede
escribir `usuarios.es_superadmin`: no está en ningún grant de columna, así que
nadie se asciende a sí mismo ni aunque la política le deje editar su fila.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/auth/registro` | crea la cuenta (sin institución) y abre sesión |
| `POST` | `/api/auth/entrar` | inicia sesión |
| `POST` | `/api/auth/refrescar` | renueva el acceso con la cookie httpOnly |
| `POST` | `/api/auth/salir` | revoca la sesión |
| `POST` | `/api/auth/institucion` | elige institución y devuelve un token con ese contexto |
| `GET` | `/api/auth/yo` | usuario, instituciones y roles |
| `GET` | `/api/instituciones/disponible?slug=` | si el identificador está libre |
| `POST` | `/api/instituciones` | crea la institución (onboarding) |

## Cómo se sostiene una sesión

Dos fichas con trabajos distintos:

- **Access token** (JWT, 15 min). Viaja en `Authorization: Bearer`, no se guarda
  en ninguna parte del servidor y en el navegador vive solo en memoria — nunca
  en `localStorage`, donde cualquier script inyectado lo alcanzaría.
- **Refresh token** (30 días). Viaja en una cookie `httpOnly` que el JavaScript
  no puede leer, y en la base solo se guarda su hash SHA-256: robar la tabla
  `sesiones` no da sesiones utilizables.

Cada refresco **rota** el token: el usado deja de servir en el momento en que se
entrega el siguiente. Al recargar la página el access token se pierde, que es lo
correcto, y la cookie lo recupera.

El access token lleva `sub` (usuario), `sid` (sesión), `ins` (institución) y
`roles`. Los roles van solo para que la interfaz sepa qué dibujar; quién puede
hacer qué lo decide la base con las mismas políticas para todos.

## Contraseñas

`scrypt` del propio Node: sin dependencias nativas que compilar y memoria-dura,
que es lo que encarece un ataque por GPU. Los parámetros de coste van dentro del
hash (`scrypt$16384$8$1$sal$hash`), no en una constante, para poder subirlos sin
invalidar las contraseñas ya guardadas.

Un correo que no existe tarda lo mismo que uno que sí, y devuelve el mismo
mensaje: el formulario de acceso no es sitio para averiguar quién tiene cuenta.
A los cinco intentos fallidos la cuenta se bloquea quince minutos.

## Errores

`FiltroErroresPg` traduce los errores de Postgres a HTTP. Buena parte de las
reglas del sistema viven en la base — unicidad por institución, claves foráneas
que no cruzan tenants, políticas, triggers — y cuando una se dispara es la regla
hablando, no un fallo del servidor: convertirla en un 500 escondería justo la
información útil.

| Código PG | HTTP | Ejemplo |
|---|---|---|
| `23505` | 409 | «Ya existe una cuenta con ese correo» |
| `42501` | 403 | la fila cae fuera de lo que el rol puede tocar (incluye RLS) |
| `23503` | 400 | referencia a algo que no existe en esta institución |
| `P0001` | 409 | un `raise` nuestro, con el mensaje ya redactado |

## Qué falta

- Envío de correo: el token de verificación se guarda, pero el enlace sale por
  el log en vez de por correo.
- Recuperar contraseña: la tabla `tokens_verificacion` ya contempla el tipo
  `reseteo_contrasena`; falta el flujo.
- Invitaciones: la tabla y las políticas están en 0001; falta el endpoint.
- El modelo académico (cursos, inscripciones, tareas, calificaciones) entra en
  la migración 0002.
