import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

const vacioEsNulo = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  });

const TIPOS_DOCUMENTO = [
  'cedula',
  'acta_nacimiento',
  'pasaporte',
  'otro',
] as const;
const ESTADOS = [
  'preinscrita',
  'activa',
  'completada',
  'retirada',
  'cancelada',
] as const;

/*
  Inscribir tiene dos caminos y un solo DTO, porque para quien esta delante del
  formulario es el mismo acto:

    · alguien nuevo    -> se manda nombres y apellidos. El sistema le crea la
                          cuenta, le emite matricula y clave, y lo mete al curso.
    · alguien conocido -> se manda membresiaId. Ya tiene matricula de cuando
                          tomo su primer curso; aqui solo se le suma otro.

  El segundo camino es la razon de que la matricula sea de la persona y no de la
  inscripcion. Quien lleva ingles y luego contabilidad es un alumno del centro
  con dos cursos, no dos alumnos.
*/
export class InscribirDto {
  @IsUUID('4', { message: 'El curso no es valido.' })
  cursoId!: string;

  // --- Camino A: ya es alumno del centro -------------------------------------

  @IsOptional()
  @IsUUID('4', { message: 'La persona seleccionada no es valida.' })
  membresiaId?: string;

  // --- Camino B: es alguien nuevo --------------------------------------------

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener al menos 2 caracteres.' })
  nombres?: string;

  @IsOptional()
  @recortar()
  @IsString()
  @Length(2, 80, {
    message: 'Los apellidos deben tener al menos 2 caracteres.',
  })
  apellidos?: string;

  /*
    Opcional. Un adulto que se apunta a un curso de oficios puede no tener
    correo, y esa es justamente la razon de que la credencial de acceso sea la
    matricula y no el buzon.
  */
  @IsOptional()
  @vacioEsNulo()
  @IsEmail({}, { message: 'Ese correo no parece valido.' })
  @MaxLength(160)
  correo?: string | null;

  @IsOptional()
  @IsIn(TIPOS_DOCUMENTO)
  tipoDocumento?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(40)
  documento?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de nacimiento no es valida.',
  })
  fechaNacimiento?: string | null;

  @IsOptional()
  @IsIn(['f', 'm'], { message: 'Sexo no valido.' })
  sexo?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  direccion?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(120)
  ocupacion?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(160)
  empresa?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(120)
  comoNosConocio?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(500)
  notas?: string | null;

  // --- Condiciones de la inscripcion -----------------------------------------

  @IsOptional()
  @IsIn(['preinscrita', 'activa'], {
    message: 'Una inscripcion nace preinscrita o activa.',
  })
  estado?: string;

  /* Beca, promocion o acuerdo. Nunca mas que el precio del curso. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El descuento no es valido.' })
  @Min(0)
  descuento?: number;

  /*
    Para cortesias e intercambios: se inscribe sin generar el cargo. No es lo
    mismo que un descuento del 100%, que si deja rastro de cuanto se perdono.
  */
  @IsOptional()
  @IsBoolean()
  sinCobro?: boolean;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}

export class ActualizarInscripcionDto {
  @IsOptional()
  @IsIn(ESTADOS, { message: 'Ese estado no existe.' })
  estado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  calificacion?: number | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  motivoRetiro?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}

export class ListarInscripcionesDto {
  @IsOptional()
  @IsUUID('4')
  cursoId?: string;

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: string;

  /* Solo las que deben algo. Es la vista que pide quien cobra. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  conDeuda?: boolean;

  @IsOptional()
  @recortar()
  @IsString()
  @MaxLength(120)
  busqueda?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  porPagina?: number;
}

// ---------------------------------------------------------------------------
// Cobro
// ---------------------------------------------------------------------------

/* Un cargo suelto: material, repeticion de examen, certificado impreso. */
export class CargoDto {
  @recortar()
  @IsString()
  @Length(2, 200, { message: 'El cargo necesita una descripcion.' })
  descripcion!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto no es valido.' })
  @Min(0)
  monto!: number;

  @IsOptional()
  @vacioEsNulo()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de vencimiento no es valida.',
  })
  venceEn?: string | null;
}

export class RegistrarPagoDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto no es valido.' })
  @Min(0.01, { message: 'Un pago tiene que ser mayor que cero.' })
  monto!: number;

  @IsIn(['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'])
  metodo!: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(80)
  referencia?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha del pago no es valida.',
  })
  recibidoEn?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  nota?: string | null;
}
