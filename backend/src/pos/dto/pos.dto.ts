import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const vacioEsNulo = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  });

export class BuscarCandidatosDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}

export class ListarVentasDto {
  @IsOptional()
  @IsIn(['pendiente', 'pagada', 'anulada'])
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}

export class CrearVentaDto {
  @IsUUID('4', { message: 'La inscripción no es válida.' })
  inscripcionId!: string;

  @IsUUID('4', { message: 'El producto no es válido.' })
  productoId!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto recibido no es válido.' },
  )
  @Min(0)
  montoRecibido!: number;

  @IsIn(['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'])
  metodo!: string;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(80)
  referencia?: string | null;

  @IsOptional()
  @vacioEsNulo()
  @IsString()
  @MaxLength(300)
  nota?: string | null;
}

export class AgregarPagoPosDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto no es válido.' })
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
  @IsString()
  @MaxLength(300)
  nota?: string | null;
}

export class ActualizarProductoPosDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class MotivoAnulacionDto {
  @IsString()
  @MaxLength(300)
  motivo!: string;
}
