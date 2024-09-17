import { HttpException, HttpStatus } from '@nestjs/common';

export class ProductNotFoundError extends HttpException {
  constructor(productId: string) {
    super(`Product with ID ${productId} not found`, HttpStatus.NOT_FOUND);
  }
}
