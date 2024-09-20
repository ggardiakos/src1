import { HttpStatus } from '@nestjs/common'

import { ProductNotFoundError } from './product-not-found-error'

describe('productNotFoundError', () => {
  it('should be an instance of HttpException', () => {
    const error = new ProductNotFoundError('123')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ProductNotFoundError)
  })

  it('should have status code NOT_FOUND (404)', () => {
    const error = new ProductNotFoundError('123')
    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND)
  })

  it('should return the correct error message with product ID', () => {
    const productId = '123'
    const error = new ProductNotFoundError(productId)
    expect(error.message).toBe(`Product with ID ${productId} not found`)
  })

  it('should include correct status and message in the response object', () => {
    const productId = '123'
    const error = new ProductNotFoundError(productId)
    const response = error.getResponse()

    expect(response).toEqual({
      statusCode: HttpStatus.NOT_FOUND,
      message: `Product with ID ${productId} not found`,
    })
  })
})
