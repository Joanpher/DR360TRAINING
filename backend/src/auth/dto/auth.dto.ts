import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

const enMinusculas = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

export class RegistroDto {
  @recortar()
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres.' })
  nombres!: string;

  @recortar()
  @IsString()
  @Length(2, 80, { message: 'Los apellidos deben tener entre 2 y 80 caracteres.' })
  apellidos!: string;

  @enMinusculas()
  @IsEmail({}, { message: 'Ese correo no parece valido.' })
  @MaxLength(160)
  correo!: string;

  /*
    Largo minimo antes que reglas de simbolos: una frase larga resiste mas que
    ocho caracteres con una mayuscula y un numero obligatorios, que es lo que
    empuja a la gente a escribir Educa2026! y reutilizarla en todas partes.
  */
  @IsString()
  @MinLength(10, { message: 'La contrasena debe tener al menos 10 caracteres.' })
  @MaxLength(200)
  contrasena!: string;
}

/*
  Un solo formulario para dos clases de credencial.

  El personal entra con su correo; un estudiante de colegio entra con su
  matricula, porque un nino de primaria no tiene correo. En vez de dos
  formularios, se recibe un campo "identidad" y se decide por su forma: si
  lleva arroba es un correo, si no es una matricula.

  Esa decision se toma aqui y no se le pide a quien entra: nadie deberia tener
  que saber que tipo de credencial tiene antes de escribirla.
*/
export class EntrarDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 200, { message: 'Escribe tu correo o tu matricula.' })
  identidad!: string;

  @IsString()
  @MaxLength(200)
  contrasena!: string;
}

export class ElegirInstitucionDto {
  @IsUUID('4', { message: 'Institucion no valida.' })
  institucionId!: string;
}

export class CrearInstitucionDto {
  @recortar()
  @IsString()
  @Length(3, 160, { message: 'El nombre debe tener entre 3 y 160 caracteres.' })
  nombre!: string;

  /*
    El slug es la direccion publica de la institucion (itc.dr360training.com) y no se
    reutiliza nunca. La misma regla que valida la columna en la base.
  */
  @enMinusculas()
  @Matches(/^[a-z0-9]([a-z0-9-]{1,38})?[a-z0-9]$/, {
    message:
      'El identificador solo admite minusculas, numeros y guiones, entre 3 y 40 caracteres.',
  })
  slug!: string;

  @recortar()
  @IsString()
  @Length(2, 12, { message: 'Las siglas deben tener entre 2 y 12 caracteres.' })
  siglas!: string;

  @IsString()
  @Matches(/^(universidad|instituto|colegio|academia|corporativa)$/, {
    message: 'Tipo de institucion no valido.',
  })
  tipo!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'El pais va en dos letras mayusculas.' })
  pais!: string;

  @IsString()
  @MaxLength(60)
  zonaHoraria!: string;
}
