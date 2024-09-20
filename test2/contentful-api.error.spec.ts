import { HttpStatus } from '@nestjs/common'

import { ContentfulApiError } from './contentful-api-error'

describe('contentfulApiError', () => {
  it('should be an instance of HttpException', () => {
    const error = new ContentfulApiError('Contentful API failed')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ContentfulApiError)
  })

  it('should have status code BAD_GATEWAY (502)', () => {
    const error = new ContentfulApiError('Contentful API failed')
    expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY)
  })

  it('should return the correct error message', () => {
    const error = new ContentfulApiError('Contentful API failed')
    expect(error.message).toBe('Contentful API failed')
  })

  it('should include correct status and message in the response object', () => {
    const error = new ContentfulApiError('Contentful API failed')
    const response = error.getResponse()

    expect(response).toEqual({
      statusCode: HttpStatus.BAD_GATEWAY,
      message: 'Contentful API failed',
    })
  })
})
