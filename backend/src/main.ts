import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const isDev = env.NODE_ENV === 'development';

  const fastifyAdapter = new FastifyAdapter({
    logger: isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      bufferLogs: true,
    },
  );

  // Security headers via Helmet
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // Cross-Origin Resource Sharing
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  const host = '0.0.0.0';
  await app.listen(env.PORT, host);
  console.log(`🚀  CampusHinge NestJS + Fastify running on http://${host}:${env.PORT} [${env.NODE_ENV}]`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
