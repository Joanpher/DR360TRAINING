import { Module } from '@nestjs/common';
import { CatalogoControlador } from './catalogo.controlador';
import { CategoriasServicio } from './categorias.servicio';
import { CursosServicio } from './cursos.servicio';
import { SedesServicio } from './sedes.servicio';
import { PortalControlador } from './portal.controlador';

@Module({
  controllers: [CatalogoControlador, PortalControlador],
  providers: [CursosServicio, CategoriasServicio, SedesServicio],
})
export class CatalogoModule {}
