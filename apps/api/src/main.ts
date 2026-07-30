import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origin.length === 1 ? origin[0] : origin,
    credentials: true,
  });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

bootstrap();
