import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import CircuitBreaker from 'opossum';

import { AppModule } from './app.module';
import { AppService } from './app.service';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { SentryInterceptor } from './shared/interceptors/sentry.interceptor';

import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';

import { TerminusModule } from '@nestjs/terminus';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const configService = app.get(ConfigService);
  const appService = app.get(AppService);

  // Capture raw body for potential use in webhooks or signatures
  const adapter = app.getHttpAdapter();
  adapter.getInstance().addContentTypeParser(
    '*',
    { parseAs: 'buffer' },
    (req: any, body: Buffer, done: (error: Error | null, body?: any) => void) => {
      req.rawBody = body.toString('utf8');
      done(null, body);
    },
  );

  // Initialize Sentry
  await initializeSentry(app, configService);

  // Apply global configurations
  applyGlobalConfigurations(app);

  // Register middlewares for security and optimization
  await registerMiddlewares(app, configService);

  // Set up Circuit Breaker with opossum
  setupCircuitBreaker();

  // Set up Swagger if not in production
  if (configService.get<string>('nodeEnv') !== 'production') {
    setupSwagger(app);
  }

  // Set up health checks
  setupHealthChecks(app);

  // Trust proxy settings (useful when behind a reverse proxy)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Enable shutdown hooks for graceful shutdown
  app.enableShutdownHooks();

  // Initialize the application using AppService
  await appService.initializeApp();

  // Start the server
  await startServer(app, configService);
}

async function initializeSentry(
  app: NestFastifyApplication,
  configService: ConfigService,
) {
  const sentryDsn = configService.get<string>('sentryDsn');
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.get<string>('nodeEnv'),
      tracesSampleRate: 1.0,
    });
    app.useGlobalInterceptors(new SentryInterceptor());
    Logger.log('Sentry initialized for error tracking');
  }
}

function applyGlobalConfigurations(app: NestFastifyApplication) {
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  Logger.log('Global interceptors, pipes, and filters applied');
}

async function registerMiddlewares(
  app: NestFastifyApplication,
  configService: ConfigService,
) {
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowedOrigins = configService
        .get<string>('allowedOrigins')
        ?.split(',') || [];
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
  });
  await app.register(fastifyHelmet);
  await app.register(fastifyCompress);
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  Logger.log('Security and optimization middlewares registered');
}

function setupCircuitBreaker() {
  const options = {
    timeout: 5000, // 5 seconds timeout
    errorThresholdPercentage: 50, // 50% of errors will trigger the circuit breaker
    resetTimeout: 30000, // After 30 seconds, try again
  };

  const breaker = new CircuitBreaker(asyncFunction, options);
  breaker.on('open', () => Logger.warn('Circuit breaker opened'));
  breaker.on('close', () => Logger.log('Circuit breaker closed'));

  Logger.log('Circuit breaker setup with opossum');
}

async function asyncFunction() {
  return await new Promise((resolve) => {
    setTimeout(() => resolve('Success'), 1000);
  });
}

function setupSwagger(app: NestFastifyApplication) {
  const config = new DocumentBuilder()
    .setTitle('Your API Title')
    .setDescription('Comprehensive API documentation')
    .setVersion('1.0')
    .addTag('users')
    .addTag('shopify')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  Logger.log('Swagger documentation set up at /api/docs');
}

function setupHealthChecks(app: NestFastifyApplication) {
  // Health checks are now handled within HealthModule
  Logger.log('Health check endpoint is managed by HealthModule');
}

async function startServer(
  app: NestFastifyApplication,
  configService: ConfigService,
) {
  const port = configService.get<number>('port') || 3000;
  await app.listen(port, '0.0.0.0');
  const url = await app.getUrl();
  Logger.log(`🚀 Application is running on: ${url}`);
  if (configService.get<string>('nodeEnv') !== 'production') {
    Logger.log(`📚 Swagger docs available at: ${url}/api/docs`);
  }
}

bootstrap().catch((error) => {
  Logger.error('Failed to start the application', error);
  process.exit(1);
});