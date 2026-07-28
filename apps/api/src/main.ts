import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  app.enableCors({
    origin,
    credentials: true,
  });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

bootstrap();
