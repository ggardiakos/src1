import { Module } from '@nestjs/common';
import { CustomLoggerService } from './logger/logger.service';
import { SecretManagerService } from './services/secret-manager.service';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { CsrfGuard } from './guards/csrf.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { SentryInterceptor } from './interceptors/sentry.interceptor';

@Module({
  providers: [
    CustomLoggerService,
    SecretManagerService,
    AllExceptionsFilter,
    CsrfGuard,
    LoggingInterceptor,
    SentryInterceptor,
  ],
  exports: [
    CustomLoggerService,
    SecretManagerService,
    AllExceptionsFilter,
    CsrfGuard,
    LoggingInterceptor,
    SentryInterceptor,
  ],
})
export class CommonModule {}
