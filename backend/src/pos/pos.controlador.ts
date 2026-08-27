import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import {
  ActualizarProductoPosDto,
  AgregarPagoPosDto,
  BuscarCandidatosDto,
  CrearVentaDto,
  ListarVentasDto,
  MotivoAnulacionDto,
} from './dto/pos.dto';
import { PosServicio } from './pos.servicio';

@Roles('propietario', 'administrador')
@Controller('pos')
export class PosControlador {
  constructor(private readonly pos: PosServicio) {}

  @Get('productos') productos(@Actual() s: Sesion) {
    return this.pos.productos(s);
  }
  @Patch('productos/:id') actualizarProducto(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarProductoPosDto,
    @DeDonde() o: Origen,
  ) {
    return this.pos.actualizarProducto(s, id, d, o);
  }
  @Get('candidatos') candidatos(
    @Actual() s: Sesion,
    @Query() f: BuscarCandidatosDto,
  ) {
    return this.pos.candidatos(s, f);
  }
  @Get('ventas') listar(@Actual() s: Sesion, @Query() f: ListarVentasDto) {
    return this.pos.listar(s, f);
  }
  @Post('ventas') crear(
    @Actual() s: Sesion,
    @Body() d: CrearVentaDto,
    @DeDonde() o: Origen,
  ) {
    return this.pos.crearVenta(s, d, o);
  }
  @HttpCode(200)
  @Post('ventas/:id/pagos')
  pagar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AgregarPagoPosDto,
    @DeDonde() o: Origen,
  ) {
    return this.pos.agregarPago(s, id, d, o);
  }
  @HttpCode(200)
  @Post('ventas/:id/anular')
  anular(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: MotivoAnulacionDto,
    @DeDonde() o: Origen,
  ) {
    return this.pos.anular(s, id, d.motivo, o);
  }
}
