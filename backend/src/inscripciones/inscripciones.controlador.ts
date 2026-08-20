import {
  Body,
  Controller,
  Delete,
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
  ConceptoDto,
  InscribirDto,
  ListarInscripcionesDto,
  RegistrarPagoDto,
} from './dto/inscripciones.dto';
import { InscripcionesServicio } from './inscripciones.servicio';

/*
  Inscribir y cobrar es trabajo de secretaria, no de cualquier miembro: el
  expediente lleva la direccion de la casa, el telefono de la madre y las
  alergias de un nino. Todo el controlador exige rol de administracion.
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

  @Post()
  inscribir(@Actual() s: Sesion, @Body() d: InscribirDto, @DeDonde() o: Origen) {
    return this.inscripciones.inscribir(s, d, o);
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

  // --- Conceptos de cobro ----------------------------------------------------

  @Get('cobros/conceptos')
  listarConceptos(@Actual() s: Sesion) {
    return this.cobros.listarConceptos(s);
  }

  @Post('cobros/conceptos')
  crearConcepto(@Actual() s: Sesion, @Body() d: ConceptoDto, @DeDonde() o: Origen) {
    return this.cobros.crearConcepto(s, d, o);
  }

  @Patch('cobros/conceptos/:id')
  actualizarConcepto(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ConceptoDto,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.actualizarConcepto(s, id, d, o);
  }

  @Delete('cobros/conceptos/:id')
  eliminarConcepto(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.eliminarConcepto(s, id, o);
  }

  // --- Pagos -----------------------------------------------------------------

  @HttpCode(HttpStatus.OK)
  @Post('cobros/cargos/:id/pagos')
  registrarPago(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RegistrarPagoDto,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.registrarPago(s, id, d, o);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cobros/cargos/:id/condonar')
  condonarCargo(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motivo') motivo: string,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.condonarCargo(s, id, motivo ?? '', o);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cobros/pagos/:id/anular')
  anularPago(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motivo') motivo: string,
    @DeDonde() o: Origen,
  ) {
    return this.cobros.anularPago(s, id, motivo ?? '', o);
  }
}
