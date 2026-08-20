import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
  ValidateNested,
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

const TIPOS_DOCUMENTO = ['cedula', 'acta_nacimiento', 'pasaporte', 'otro'] as const;
const PARENTESCOS = ['madre', 'padre', 'tutor', 'abuelo', 'hermano', 'tio', 'otro'] as const;

export class RepresentanteDto {
  /*
    Si ya existe en el colegio -una madre que inscribe a su segundo hijo- se
    manda su id y no se vuelven a pedir sus datos. Esa es toda la razon de que
    representantes sea una tabla aparte.
  */
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @recortar()
  @IsString()
  @Length(2, 80, { message: 'El nombre del representante es obligatorio.' })
  nombres!: string;

  @recortar()
  @IsString()
  @Length(2, 80, { message: 'Los apellidos del representante son obligatorios.' })
  apellidos!: string;

  @IsIn(PARENTESCOS, { message: 'Parentesco no valido.' })
  parentesco!: string;

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
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(40)
  telefonoTrabajo?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsEmail({}, { message: 'El correo del representante no parece valido.' })
  @MaxLength(160)
  correo?: string | null;

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
  lugarTrabajo?: string | null;

  /* Quien recibe la factura y a quien se llama primero. Uno solo por estudiante. */
  @IsOptional()
  @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional()
  @IsBoolean()
  puedeRetirar?: boolean;
}

export class InscribirDto {
  // --- Quien es el estudiante ------------------------------------------------

  @recortar()
  @IsString()
  @Length(2, 80, { message: 'El nombre del estudiante es obligatorio.' })
  nombres!: string;

  @recortar()
  @IsString()
  @Length(2, 80, { message: 'Los apellidos del estudiante son obligatorios.' })
  apellidos!: string;

  /*
    Opcional a proposito: muchos ninos de inicial no tienen correo propio, y esa
    es justamente la razon de que la matricula sea la credencial de acceso.
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento no es valida.' })
  fechaNacimiento?: string | null;

  @IsOptional()
  @IsIn(['f', 'm'], { message: 'Sexo no valido.' })
  sexo?: string | null;

  @IsOptional()
  @recortar()
  @IsString()
  @MaxLength(60)
  nacionalidad?: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(120)
  lugarNacimiento?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  direccion?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(40)
  telefonoCasa?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(8)
  tipoSangre?: string | null;

  @IsOptional() @vacioEsNulo() @IsString() @MaxLength(500)
  condicionesMedicas?: string | null;

  @IsOptional() @vacioEsNulo() @IsString() @MaxLength(500)
  alergias?: string | null;

  @IsOptional() @vacioEsNulo() @IsString() @MaxLength(160)
  colegioProcedencia?: string | null;

  @IsOptional() @vacioEsNulo() @IsString() @MaxLength(500)
  observaciones?: string | null;

  // --- Donde entra -----------------------------------------------------------

  @IsUUID('4', { message: 'La seccion no es valida.' })
  seccionId!: string;

  // --- Quien responde por el -------------------------------------------------

  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => RepresentanteDto)
  representantes!: RepresentanteDto[];

  // --- Que se le cobra -------------------------------------------------------

  /*
    Que conceptos se le generan. Si no viene, se aplican los obligatorios del
    ano escolar. Se deja elegir porque un colegio perdona la inscripcion a un
    hermano o a una beca, y eso no puede obligar a borrar el cargo despues.
  */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  conceptos?: string[];

  @IsOptional()
  @IsBoolean()
  sinCobros?: boolean;
}

export class ActualizarInscripcionDto {
  @IsOptional()
  @IsUUID('4')
  seccionId?: string;

  @IsOptional()
  @IsIn(['preinscrito', 'inscrito', 'retirado', 'promovido', 'repitente'])
  estado?: string;

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
  anoEscolarId?: string;

  @IsOptional()
  @IsUUID('4')
  seccionId?: string;

  @IsOptional()
  @IsIn(['preinscrito', 'inscrito', 'retirado', 'promovido', 'repitente'])
  estado?: string;

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
// Conceptos de cobro
// ---------------------------------------------------------------------------

export class ConceptoDto {
  @IsOptional()
  @IsUUID('4')
  anoEscolarId?: string | null;

  @recortar()
  @IsString()
  @Length(2, 120)
  nombre!: string;

  @IsIn(['inscripcion', 'mensualidad', 'material', 'uniforme', 'actividad', 'otro'])
  tipo!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto no es valido.' })
  @Min(0)
  monto!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  cuotas?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  diaVencimiento?: number | null;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class RegistrarPagoDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto no es valido.' })
  @Min(0.01)
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha del pago no es valida.' })
  recibidoEn?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  nota?: string | null;
}
