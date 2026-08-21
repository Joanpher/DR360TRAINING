import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function arrancar() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // credentials: true porque el refresco viaja en una cookie httpOnly, y sin
  // esto el navegador no la manda desde el origen de la aplicacion web.
  app.enableCors({
    origin: config.get('ORIGEN_WEB') ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const puerto = Number(config.get('PORT') ?? 3000);
  // Render enruta el trafico al contenedor desde fuera, no por su loopback:
  // escuchando solo en localhost el puerto quedaria abierto para nadie y el
  // health check daria el despliegue por muerto.
  await app.listen(puerto, '0.0.0.0');
  new Logger('dr360').log(`API escuchando en el puerto ${puerto}, prefijo /api`);
}

void arrancar();
