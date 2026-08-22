import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt) as (
  clave: string | Buffer,
  sal: Buffer,
  largo: number,
  opciones: { N: number; r: number; p: number },
) => Promise<Buffer>;

/*
  scrypt viene en el propio Node: sin dependencias nativas que compilar y sin
  una libreria mas que mantener al dia. Es memoria-dura, que es justo lo que
  encarece un ataque por fuerza bruta con GPU.

  Los parametros van dentro del hash, no en una constante del codigo. El dia que
  haya que subir el coste, las contrasenas viejas se siguen verificando con los
  parametros con que se crearon y se rehacen al siguiente inicio de sesion.
*/
const COSTE = { N: 16384, r: 8, p: 1 };
const LARGO_SAL = 16;
const LARGO_HASH = 32;

export async function hashearContrasena(clara: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL);
  const hash = await derivar(clara.normalize('NFKC'), sal, LARGO_HASH, COSTE);
  return [
    'scrypt',
    COSTE.N,
    COSTE.r,
    COSTE.p,
    sal.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

export async function verificarContrasena(
  clara: string,
  guardado: string | null,
): Promise<boolean> {
  if (!guardado) return false;

  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, salB64, hashB64] = partes;
  const sal = Buffer.from(salB64, 'base64url');
  const esperado = Buffer.from(hashB64, 'base64url');

  const calculado = await derivar(
    clara.normalize('NFKC'),
    sal,
    esperado.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    },
  );

  return timingSafeEqual(calculado, esperado);
}

/*
  Cuando el correo no existe hay que tardar lo mismo que cuando existe. Si no,
  el tiempo de respuesta dice quien tiene cuenta aqui y quien no, que en una
  plataforma con instituciones reales es informacion que no toca dar.
*/
export async function gastarTiempoDeVerificacion(): Promise<void> {
  await derivar(
    'contrasena-que-no-existe',
    randomBytes(LARGO_SAL),
    LARGO_HASH,
    COSTE,
  );
}
