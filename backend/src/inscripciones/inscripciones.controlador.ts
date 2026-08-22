import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { CobrosServicio } from './cobros.servicio';
import {
  ActualizarInscripcionDto,
  CargoDto,
  InscribirDto,
  ListarInscripcionesDto,
  RegistrarPagoDto,
} from './dto/inscripciones.dto';
import { InscripcionesServicio } from './inscripciones.servicio';

/*
  Inscribir y cobrar es trabajo de administracion, no de cualquier miembro: la
  ficha lleva la cedula, el telefono y la direccion de una persona, y la cuenta
  lleva lo que debe. Todo el controlador exige rol de administracion, incluida
  la lectura.

  Es la diferencia con /catalogo: que el centro imparte Ingles Basico los
  martes a las seis es lo que se anuncia; quien esta dentro y cuanto pago, no.
*/
@Roles('propietario', 'administrador')
@Controller('inscripciones')
export class InscripcionesControlador {
  constructor(
    private readonly inscripciones: InscripcionesServicio,
    private readonly cobros: CobrosServicio,
  ) {}

  @Get()
  listar(@Actual() s: Sesion, @Query() f: ListarInscripcionesDto) {
    return this.inscripciones.listar(s, f);
  }

  @Get(':id')
  detalle(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.inscripciones.detalle(s, id);
  }

  /*
    El acto central. Devuelve la clave en claro cuando la persona es nueva: es
    la unica vez que existe fuera del hash, y quien la pide tiene que poder
    entregarsela ahi mismo.
  */
  @Post()
  inscribir(
    @Actual() s: Sesion,
    @Body() d: InscribirDto,
    @DeDonde() o: Origen,
  ) {
    return this.inscripciones.inscribir(s, d, o);
  }

  @Patch(':id')
  actualizar(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarInscripcionDto,
    @DeDonde() o: Origen,
  ) {
    return this.inscripciones.actualizar(s, id, d, o);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/clave')
  regenerarClave(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.inscripciones.regenerarClave(s, id, o);
  }

  // --- Cobro -----------------------------------------------------------------

  @Post(':id/cargos')
  crearCargo(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CargoDto,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.crearCargo(s, id, d, o);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cargos/:id/pagos')
  registrarPago(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RegistrarPagoDto,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.registrarPago(s, id, d, o);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cargos/:id/condonar')
  condonarCargo(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motivo') motivo: string,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.condonarCargo(s, id, motivo ?? '', o);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cargos/:id/anular')
  anularCargo(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motivo') motivo: string,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.anularCargo(s, id, motivo ?? '', o);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pagos/:id/anular')
  anularPago(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motivo') motivo: string,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.anularPago(s, id, motivo ?? '', o);
  }
}
