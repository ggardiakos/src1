import { HttpException, HttpStatus } from '@nestjs/common';

export class ContentfulApiError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}
