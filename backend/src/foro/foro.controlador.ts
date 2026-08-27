import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { DeDonde, type Origen } from '../comun/auditoria';
import { Actual, type Sesion } from '../comun/sesion';
import { ForoServicio } from './foro.servicio';
import {
  ActualizarMensajeDto,
  ActualizarTemaDto,
  CrearMensajeDto,
  CrearTemaDto,
} from './dto/foro.dto';

/*
  Sin @Roles: el foro es de todo el que este dentro del curso, y quien esta
  dentro no lo decide el rol sino la inscripcion o el ser su instructor. Eso ya
  lo resuelven las politicas de la 0016 con puede_ver_curso_aula, y repetirlo
  aqui con una lista de roles solo conseguiria dejar fuera a alguien que la base
  si deja entrar.
*/
@Controller('foro')
export class ForoControlador {
  constructor(private readonly foro: ForoServicio) {}

  @Get('curso/:cursoId')
  listar(@Actual() s: Sesion, @Param('cursoId', ParseUUIDPipe) cursoId: string) {
    return this.foro.listar(s, cursoId);
  }

  @Get('temas/:id')
  detalle(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.foro.detalle(s, id);
  }

  @Post('curso/:cursoId/temas')
  crearTema(
    @Actual() s: Sesion,
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() datos: CrearTemaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.foro.crearTema(s, cursoId, datos, origen);
  }

  @Patch('temas/:id')
  actualizarTema(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: ActualizarTemaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.foro.actualizarTema(s, id, datos, origen);
  }

  @Delete('temas/:id')
  @HttpCode(204)
  eliminarTema(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.foro.eliminarTema(s, id, origen);
  }

  @Post('temas/:id/mensajes')
  responder(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: CrearMensajeDto,
  ) {
    return this.foro.responder(s, id, datos);
  }

  @Patch('mensajes/:id')
  actualizarMensaje(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: ActualizarMensajeDto,
  ) {
    return this.foro.actualizarMensaje(s, id, datos);
  }

  @Delete('mensajes/:id')
  @HttpCode(204)
  eliminarMensaje(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.foro.eliminarMensaje(s, id, origen);
  }
}
