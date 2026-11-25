import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { setupSwagger } from './common/swagger/swagger.setup';
import { ValidationPipe } from '@nestjs/common';
import { createDocsSiteRouter, readDocsSiteConfig } from './app/driver/docs/docs-site.router';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false
    })
  );

  app.useBodyParser('json', { limit: process.env.MADRE_BODY_LIMIT ?? '10mb' });
  app.useBodyParser('urlencoded', {
    limit: process.env.MADRE_BODY_LIMIT ?? '10mb',
    extended: true
  });

  setupSwagger(app, 'Madre API', 'API principal de Madre DB', ['']);

  // README.md + docs/ as a browsable site, outside the `api` prefix. The
  // markdown is read from the checkout the service runs from, so a git pull
  // is enough to publish a text change.
  const docsSite = readDocsSiteConfig(process.env);
  if (docsSite.enabled) {
    app.use(
      docsSite.path,
      createDocsSiteRouter({
        basePath: docsSite.path,
        rootDirectory: process.cwd(),
        credentials: docsSite.credentials
      })
    );
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

  console.log(`API running on port ${process.env.PORT ?? 3001}`);
}
bootstrap();
