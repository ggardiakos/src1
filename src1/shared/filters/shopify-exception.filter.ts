import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ShopifyAPIError } from '../errors/shopify-api.error';

@Catch(ShopifyAPIError)
export class ShopifyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ShopifyExceptionFilter.name);

  catch(exception: ShopifyAPIError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception.message || 'Shopify API error';

    this.logger.error(
      `Shopify Exception - Status: ${status}, Message: ${message}`,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
