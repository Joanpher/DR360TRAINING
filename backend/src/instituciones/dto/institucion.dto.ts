import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

const enMinusculas = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/*
  Un campo de texto opcional que se puede vaciar. Sin esto no habria forma de
  borrar el correo de soporte: mandar cadena vacia lo dejaria como '' y no
  mandarlo significa "no lo toques". La cadena vacia se convierte en null, que
  es lo que la columna entiende por "no hay".
*/
const vacioEsNulo = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  });

export class ActualizarInstitucionDto {
  @IsOptional()
  @recortar()
  @IsString()
  @Length(3, 160, { message: 'El nombre debe tener entre 3 y 160 caracteres.' })
  nombre?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 12, { message: 'Las siglas deben tener entre 2 y 12 caracteres.' })
  siglas?: string;

  /*
    El slug es la direccion publica de la institucion. Se deja cambiar porque a
    veces se registra con una errata, pero cada cambio rompe los enlaces ya
    compartidos, asi que queda en la bitacora como cualquier otra cosa.
  */
  @IsOptional()
  @enMinusculas()
  @Matches(/^[a-z0-9]([a-z0-9-]{1,38})?[a-z0-9]$/, {
    message:
      'El identificador solo admite minusculas, numeros y guiones, entre 3 y 40 caracteres.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(universidad|instituto|colegio|academia|corporativa)$/, {
    message: 'Tipo de institucion no valido.',
  })
  tipo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'El pais va en dos letras mayusculas.' })
  pais?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @MaxLength(60)
  zonaHoraria?: string;

  @IsOptional()
  @enMinusculas()
  @Matches(/^[a-z]{2}$/, { message: 'El idioma va en dos letras.' })
  idioma?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsEmail({}, { message: 'El correo de soporte no parece valido.' })
  @MaxLength(160)
  correoSoporte?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsUrl({ require_protocol: true }, { message: 'El sitio web debe empezar por https://' })
  @MaxLength(300)
  sitioWeb?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(400)
  descripcion?: string | null;
}

/*
  La marca vive en una columna jsonb y no en columnas propias porque es la
  parte del sistema que mas va a crecer y la que menos se consulta: nadie filtra
  instituciones por color de acento.
*/
export class MarcaDto {
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color va en formato #RRGGBB.' })
  colorPrimario?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color va en formato #RRGGBB.' })
  colorAcento?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsUrl({ require_protocol: true }, { message: 'La direccion del logo no es valida.' })
  @MaxLength(500)
  logoUrl?: string | null;
}

export class CrearDominioDto {
  @enMinusculas()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/, { message: 'Ese dominio no tiene un formato valido.' })
  @MaxLength(200)
  dominio!: string;

  @IsOptional()
  @IsBoolean()
  autoafiliar?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(estudiante|docente|coordinador|administrador|invitado)$/, {
    message: 'Rol por defecto no valido.',
  })
  rolPorDefecto?: string;
}

export class ActualizarDominioDto {
  @IsOptional()
  @IsBoolean()
  autoafiliar?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(estudiante|docente|coordinador|administrador|invitado)$/, {
    message: 'Rol por defecto no valido.',
  })
  rolPorDefecto?: string;
}

/*
  Un tramo de la escala de calificacion. La validacion de que los tramos no se
  solapan ni dejan huecos no cabe aqui -depende de los demas tramos- y se hace
  en el servicio.
*/
export class TramoDto {
  @recortar()
  @IsString()
  @Length(1, 3, { message: 'La letra va de 1 a 3 caracteres.' })
  letra!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  desde!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  hasta!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  /* Puntos por cien: 4.00 se guarda como 400, para no arrastrar decimales. */
  puntos!: number;
}

export class EscalaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TramoDto)
  tramos!: TramoDto[];
}

export class ArchivarDto {
  /*
    Escribir el nombre de la institucion no es teatro: es lo que separa
    "archivar" de un clic sin querer en un boton rojo. La comprobacion se hace
    en el servidor porque en el navegador cualquiera la salta.
  */
  @recortar()
  @IsString()
  @MaxLength(160)
  confirmacion!: string;
}
