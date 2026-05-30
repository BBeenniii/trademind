import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
  });

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
}

bootstrap();