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
  Put,
  Query,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, Roles, type Sesion } from '../comun/sesion';
import { CrearInstitucionDto } from '../auth/dto/auth.dto';
import {
  ActualizarDominioDto,
  ActualizarInstitucionDto,
  ArchivarDto,
  CrearDominioDto,
  EscalaDto,
  MarcaDto,
} from './dto/institucion.dto';
import { InstitucionesServicio } from './instituciones.servicio';

/*
  El decorador @Roles es comodidad, no seguridad: convierte en un 403 legible lo
  que si no llegaria a la base y volveria como "cero filas afectadas" o como un
  error de politica. Quitarlo no abriria ningun dato -las politicas de RLS
  siguen ahi- pero dejaria mensajes de error peores.

  Leer la configuracion no lleva @Roles: cualquier miembro puede ver el nombre y
  la marca de su institucion. Escribir, todo.
*/
@Controller('instituciones')
export class InstitucionesControlador {
  constructor(private readonly instituciones: InstitucionesServicio) {}

  @Get('disponible')
  async disponible(@Actual() sesion: Sesion, @Query('slug') slug: string) {
    return this.instituciones.slugDisponible(sesion, (slug ?? '').toLowerCase());
  }

  @Post()
  async crear(@Actual() sesion: Sesion, @Body() datos: CrearInstitucionDto) {
    const abierta = await this.instituciones.crear(sesion, datos);
    const { refresco: _oculto, ...publico } = abierta;
    return publico;
  }

  // ---------------------------------------------------------------------------

  @Get('actual')
  async actual(@Actual() sesion: Sesion) {
    return this.instituciones.leerActual(sesion);
  }

  @Roles('propietario', 'administrador')
  @Patch('actual')
  async actualizar(
    @Actual() sesion: Sesion,
    @Body() datos: ActualizarInstitucionDto,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.actualizar(sesion, datos, origen);
  }

  @Roles('propietario', 'administrador')
  @Put('actual/marca')
  async marca(
    @Actual() sesion: Sesion,
    @Body() datos: MarcaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.guardarMarca(sesion, datos, origen);
  }

  @Roles('propietario', 'administrador')
  @Put('actual/escala')
  async escala(
    @Actual() sesion: Sesion,
    @Body() datos: EscalaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.guardarEscala(sesion, datos, origen);
  }

  // --- Dominios de correo ----------------------------------------------------

  @Roles('propietario', 'administrador')
  @Post('actual/dominios')
  async agregarDominio(
    @Actual() sesion: Sesion,
    @Body() datos: CrearDominioDto,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.agregarDominio(sesion, datos, origen);
  }

  @Roles('propietario', 'administrador')
  @Patch('actual/dominios/:id')
  async actualizarDominio(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: ActualizarDominioDto,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.actualizarDominio(sesion, id, datos, origen);
  }

  @Roles('propietario', 'administrador')
  @HttpCode(HttpStatus.OK)
  @Post('actual/dominios/:id/verificar')
  async verificarDominio(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.verificarDominio(sesion, id, origen);
  }

  @Roles('propietario', 'administrador')
  @Delete('actual/dominios/:id')
  async eliminarDominio(
    @Actual() sesion: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.eliminarDominio(sesion, id, origen);
  }

  // --- Archivar --------------------------------------------------------------

  @Roles('propietario')
  @HttpCode(HttpStatus.OK)
  @Post('actual/archivar')
  async archivar(
    @Actual() sesion: Sesion,
    @Body() datos: ArchivarDto,
    @DeDonde() origen: Origen,
  ) {
    return this.instituciones.archivar(sesion, datos, origen);
  }
}
