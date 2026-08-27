import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

/*
  Todo lo que este sistema sabe de Jitsi cabe aqui.

  Jitsi Meet es software libre y se despliega de dos maneras que no se parecen
  en nada desde el lado del permiso:

    1. Un servidor publico -meet.jit.si- que no conoce a nadie. Cualquiera con
       el nombre de la sala entra. No hay token que valga: mandarle uno hace
       que rechace la conexion.

    2. Un servidor propio con el modulo de tokens de Prosody activado. Ahi la
       entrada la firma este backend, sala por sala y persona por persona, y
       quien no traiga token no pasa de la puerta.

  El codigo soporta los dos y elige solo: si hay secreto configurado firma, y
  si no, no. Esa es la unica bifurcacion, y esta aqui para que el resto del
  modulo no tenga que preguntarselo.

  Con el servidor publico la seguridad la sostiene el nombre de la sala, que es
  aleatorio y de 32 caracteres hexadecimales -no se adivina y no se comparte
  fuera de la aplicacion-. Es suficiente para empezar y claramente peor que un
  token: quien reenvia el enlace por fuera reparte el acceso. Por eso el aviso
  del arranque no es decorativo.
*/

export type PersonaEnSala = {
  usuarioId: string;
  nombre: string;
  correo: string;
  avatarUrl: string | null;
};

export type AccesoSala = {
  dominio: string;
  sala: string;
  /* null cuando el despliegue no exige token (servidor publico). */
  token: string | null;
  esModerador: boolean;
};

@Injectable()
export class JitsiServicio {
  private readonly bitacora = new Logger('Jitsi');
  private readonly dominio: string;
  private readonly appId: string;
  private readonly secreto: string | null;
  private readonly minutos: number;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.dominio = (
      config.get<string>('JITSI_DOMINIO') ?? 'meet.jit.si'
    ).replace(/^https?:\/\//, '');
    this.appId = config.get<string>('JITSI_APP_ID') ?? 'dr360training';
    this.secreto = config.get<string>('JITSI_APP_SECRETO') || null;
    this.minutos = Number(config.get('JITSI_TOKEN_MINUTOS') ?? 240);

    if (!this.secreto) {
      this.bitacora.warn(
        `Sin JITSI_APP_SECRETO: las salas de ${this.dominio} se protegen solo ` +
          'por el nombre aleatorio. Para clases reales, despliega Jitsi con ' +
          'tokens y rellena JITSI_APP_ID y JITSI_APP_SECRETO.',
      );
    }
  }

  get servidor(): string {
    return this.dominio;
  }

  get exigeToken(): boolean {
    return this.secreto !== null;
  }

  /*
    El nombre de la sala. En minusculas y sin acentos porque Jitsi normaliza a
    minusculas por dentro: una sala con mayusculas no coincide con el "room"
    del token y la entrada se rechaza con un error que no dice por que.

    No lleva el nombre del curso ni el del centro. Un nombre legible se adivina
    -y con el servidor publico, adivinarlo es entrar-.
  */
  nombreDeSala(): string {
    return `dr360-${randomBytes(16).toString('hex')}`;
  }

  /*
    El token de entrada.

    Va atado a UNA sala: el claim room impide que quien recibe un token para su
    clase lo reutilice en la de al lado. Y la condicion de moderador no la
    decide el navegador sino esta linea, que es la razon de que el alumnado no
    pueda expulsar a nadie ni terminar la reunion por su cuenta.
  */
  async acceso(
    sala: string,
    persona: PersonaEnSala,
    esModerador: boolean,
    permiteGrabacion: boolean,
  ): Promise<AccesoSala> {
    if (!this.secreto) {
      return { dominio: this.dominio, sala, token: null, esModerador };
    }

    const grabar = esModerador && permiteGrabacion;
    const token = await this.jwt.signAsync(
      {
        context: {
          user: {
            id: persona.usuarioId,
            name: persona.nombre,
            email: persona.correo,
            avatar: persona.avatarUrl ?? undefined,
            // Prosody lo lee como texto en unas versiones y como booleano en
            // otras. Mandar los dos sale gratis y evita un fallo que solo
            // aparece al actualizar el servidor de Jitsi.
            moderator: esModerador,
            affiliation: esModerador ? 'owner' : 'member',
          },
          features: {
            recording: grabar,
            livestreaming: false,
            transcription: false,
            'outbound-call': false,
            'sip-outbound-call': false,
          },
        },
        room: sala,
      },
      {
        secret: this.secreto,
        algorithm: 'HS256',
        issuer: this.appId,
        audience: this.appId,
        subject: this.dominio,
        expiresIn: `${this.minutos}m`,
      },
    );

    return { dominio: this.dominio, sala, token, esModerador };
  }
}
