import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/*
  Solo cuatro campos, y no los seis que la 0001 dejo abiertos a educa_app.
  idioma y zona_horaria tienen columna y permiso, pero hoy no hay una sola linea
  del sistema que los lea: ofrecerlos seria un formulario que promete cambiar
  algo y no cambia nada. Cuando el calendario respete la zona horaria, se anaden
  aqui y no antes.
*/
export class ActualizarPerfilDto {
  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres.' })
  nombres?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 80, { message: 'Los apellidos deben tener entre 2 y 80 caracteres.' })
  apellidos?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  /*
    Mismo trato que la portada de un curso: una URL pegada o la imagen ya
    reescalada por el navegador como data URI. Sin almacenamiento de archivos
    todavia, el limite de largo es lo unico que separa un avatar de 200 KB de
    una fila de varios megas.
  */
  @IsOptional()
  @IsString()
  @MaxLength(400_000, { message: 'La imagen es demasiado grande.' })
  @Matches(/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/, {
    message: 'La foto debe ser una URL o una imagen JPEG, PNG o WebP.',
  })
  avatarUrl?: string | null;
}

export class CambiarContrasenaDto {
  @IsString()
  @MinLength(1, { message: 'Escribe tu contrasena actual.' })
  actual!: string;

  /* El mismo minimo que el registro: una frase larga antes que reglas de simbolos. */
  @IsString()
  @MinLength(10, { message: 'La contrasena nueva debe tener al menos 10 caracteres.' })
  @MaxLength(200)
  nueva!: string;
}
