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
import { CategoriasServicio } from './categorias.servicio';
import { CursosServicio } from './cursos.servicio';
import { SedesServicio } from './sedes.servicio';
import {
  ActualizarCursoDto,
  ActualizarSedeDto,
  CategoriaDto,
  CrearCursoDto,
  CrearSedeDto,
  ListarCursosDto,
} from './dto/catalogo.dto';

/*
  El catalogo de la institucion: sus cursos, como los agrupa y donde los
  imparte. Es lo mismo visto por tres ventanas, y las tres comparten la regla.

  Leer lo puede cualquier miembro. Que el centro imparte Ingles Basico los
  martes a las seis no es informacion reservada: es justamente lo que se
  anuncia. Escribir, solo quien administra.

  Los metodos de escritura devuelven la lista completa ya actualizada. Son
  listas de decenas de filas, no de miles, y devolverlas le ahorra al navegador
  una segunda vuelta para enterarse de lo que acaba de hacer.
*/
@Controller('catalogo')
export class CatalogoControlador {
  constructor(
    private readonly cursos: CursosServicio,
    private readonly categorias: CategoriasServicio,
    private readonly sedes: SedesServicio,
  ) {}

  // --- Cursos ----------------------------------------------------------------

  @Get('cursos')
  listarCursos(@Actual() s: Sesion, @Query() f: ListarCursosDto) {
    return this.cursos.listar(s, f);
  }

  /*
    Va antes que 'cursos/:id'. Nest resuelve las rutas en el orden en que se
    declaran, y al reves 'instructores' entraria por el comodin y moriria en el
    ParseUUIDPipe con un 400 que no explica nada.
  */
  @Roles('propietario', 'administrador')
  @Get('cursos/instructores')
  listarInstructores(@Actual() s: Sesion) {
    return this.cursos.listarInstructores(s);
  }

  @Get('cursos/:id')
  detalleCurso(@Actual() s: Sesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.cursos.detalle(s, id);
  }

  @Roles('propietario', 'administrador')
  @Post('cursos')
  crearCurso(
    @Actual() s: Sesion,
    @Body() d: CrearCursoDto,
    @DeDonde() o: Origen,
  ) {
    return this.cursos.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('cursos/:id')
  actualizarCurso(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarCursoDto,
    @DeDonde() o: Origen,
  ) {
    return this.cursos.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('cursos/:id')
  eliminarCurso(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.cursos.eliminar(s, id, o);
  }

  // --- Categorias ------------------------------------------------------------

  @Get('categorias')
  listarCategorias(@Actual() s: Sesion) {
    return this.categorias.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('categorias')
  crearCategoria(
    @Actual() s: Sesion,
    @Body() d: CategoriaDto,
    @DeDonde() o: Origen,
  ) {
    return this.categorias.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('categorias/:id')
  actualizarCategoria(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CategoriaDto,
    @DeDonde() o: Origen,
  ) {
    return this.categorias.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('categorias/:id')
  eliminarCategoria(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.categorias.eliminar(s, id, o);
  }

  // --- Sedes -----------------------------------------------------------------

  @Get('sedes')
  listarSedes(@Actual() s: Sesion) {
    return this.sedes.listar(s);
  }

  @Roles('propietario', 'administrador')
  @Post('sedes')
  crearSede(
    @Actual() s: Sesion,
    @Body() d: CrearSedeDto,
    @DeDonde() o: Origen,
  ) {
    return this.sedes.crear(s, d, o);
  }

  @Roles('propietario', 'administrador')
  @Patch('sedes/:id')
  actualizarSede(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActualizarSedeDto,
    @DeDonde() o: Origen,
  ) {
    return this.sedes.actualizar(s, id, d, o);
  }

  @Roles('propietario', 'administrador')
  @HttpCode(HttpStatus.OK)
  @Post('sedes/:id/principal')
  marcarSedePrincipal(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.sedes.marcarPrincipal(s, id, o);
  }

  @Roles('propietario', 'administrador')
  @Delete('sedes/:id')
  eliminarSede(
    @Actual() s: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @DeDonde() o: Origen,
  ) {
    return this.sedes.eliminar(s, id, o);
  }
}
