import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AcademicoModule } from './academico/academico.module';
import { AppControlador } from './app.controlador';
import { AuthModule } from './auth/auth.module';
import { BaseDatosModule } from './basedatos/basedatos.module';
import { FiltroErroresPg } from './comun/errores-pg.filtro';
import { GuardiaAcceso } from './comun/sesion';
import { InscripcionesModule } from './inscripciones/inscripciones.module';
import { InstitucionesModule } from './instituciones/instituciones.module';
import { PersonasModule } from './personas/personas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    BaseDatosModule,
    AuthModule,
    InstitucionesModule,
    AcademicoModule,
    PersonasModule,
    InscripcionesModule,
  ],
  controllers: [AppControlador],
  providers: [
    /*
      El guardia va global y las rutas abiertas se marcan con @Publico(). Al
      reves —proteger ruta por ruta— el dia que alguien anade un endpoint y se
      olvida del decorador, queda abierto sin que nadie lo note. Asi el olvido
      falla del lado seguro.
    */
    { provide: APP_GUARD, useClass: GuardiaAcceso },
    { provide: APP_FILTER, useClass: FiltroErroresPg },
  ],
})
export class AppModule {}
