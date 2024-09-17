import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const csrfToken = request.headers['x-csrf-token'] || request.body._csrf;

    if (!csrfToken || csrfToken !== request.session.csrfToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
