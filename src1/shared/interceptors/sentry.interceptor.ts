import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SentryInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const user = request.user; // Attach user details if available

        // Capture the error in Sentry
        Sentry.withScope((scope) => {
          scope.setTag('url', request.url);
          scope.setTag('method', request.method);
          scope.setTag('status_code', error.status || 500);
          scope.setExtra('body', request.body);
          scope.setExtra('query', request.query);
          scope.setExtra('params', request.params);
          if (user) {
            scope.setUser({
              id: user.id,
              email: user.email,
            });
          }
          Sentry.captureException(error);
        });

        // Log the error locally
        this.logger.error(
          `Error captured by Sentry: ${error.message}`,
          error.stack,
        );

        return throwError(error);
      }),
    );
  }
}
