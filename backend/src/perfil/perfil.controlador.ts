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
import { PerfilServicio } from './perfil.servicio';
import { ActualizarPerfilDto, CambiarContrasenaDto } from './dto/perfil.dto';

/*
  Sin @Roles y sin exigir institucion: el perfil es de la persona, no de su
  papel dentro de un centro. Quien tiene sesion tiene perfil, y es el mismo
  aunque pertenezca a tres instituciones o a ninguna.
*/
@Controller('perfil')
export class PerfilControlador {
  constructor(private readonly perfil: PerfilServicio) {}

  @Get()
  ver(@Actual() s: Sesion) {
    return this.perfil.ver(s);
  }

  @Patch()
  actualizar(
    @Actual() s: Sesion,
    @Body() datos: ActualizarPerfilDto,
    @DeDonde() origen: Origen,
  ) {
    return this.perfil.actualizar(s, datos, origen);
  }

  @Post('contrasena')
  cambiarContrasena(
    @Actual() s: Sesion,
    @Body() datos: CambiarContrasenaDto,
    @DeDonde() origen: Origen,
  ) {
    return this.perfil.cambiarContrasena(s, datos, origen);
  }

  @Post('sesiones/cerrar-las-demas')
  cerrarLasDemas(@Actual() s: Sesion, @DeDonde() origen: Origen) {
    return this.perfil.cerrarLasDemas(s, origen);
  }

  @Delete('sesiones/:id')
  @HttpCode(204)
  cerrarSesion(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() origen: Origen,
  ) {
    return this.perfil.cerrarSesion(s, id, origen);
  }
}
