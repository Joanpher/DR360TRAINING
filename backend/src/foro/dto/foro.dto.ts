import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/*
  El recorte va aqui y no en el servicio para que el largo se valide sobre el
  texto ya limpio: "   " son tres caracteres para MinLength y ninguno para la
  restriccion de la base, y sin esto el error llegaria desde Postgres en vez de
  desde el campo del formulario.
*/
const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CrearTemaDto {
  @recortar()
  @IsString()
  @MinLength(3, { message: 'El titulo debe tener al menos 3 caracteres.' })
  @MaxLength(160, { message: 'El titulo no puede pasar de 160 caracteres.' })
  titulo!: string;

  @recortar()
  @IsString()
  @MinLength(1, { message: 'Escribe el mensaje que abre el tema.' })
  @MaxLength(8000, { message: 'El mensaje no puede pasar de 8000 caracteres.' })
  cuerpo!: string;
}

/*
  Un solo DTO para dos permisos distintos: el autor corrige titulo y cuerpo,
  quien imparte fija y cierra. El servicio es quien reparte, porque aqui no se
  sabe todavia quien pregunta.
*/
export class ActualizarTemaDto {
  @IsOptional()
  @recortar()
  @IsString()
  @MinLength(3, { message: 'El titulo debe tener al menos 3 caracteres.' })
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @MinLength(1, { message: 'El mensaje no puede quedar vacio.' })
  @MaxLength(8000)
  cuerpo?: string;

  @IsOptional()
  @IsBoolean()
  fijado?: boolean;

  @IsOptional()
  @IsBoolean()
  cerrado?: boolean;
}

export class CrearMensajeDto {
  @recortar()
  @IsString()
  @MinLength(1, { message: 'Escribe una respuesta.' })
  @MaxLength(8000, { message: 'La respuesta no puede pasar de 8000 caracteres.' })
  cuerpo!: string;
}

export class ActualizarMensajeDto {
  @recortar()
  @IsString()
  @MinLength(1, { message: 'El mensaje no puede quedar vacio.' })
  @MaxLength(8000)
  cuerpo!: string;
}
