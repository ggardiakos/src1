import { HttpException, HttpStatus } from '@nestjs/common';

export class ShopifyAPIError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}
