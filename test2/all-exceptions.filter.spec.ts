import type { ArgumentsHost } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { HttpException, HttpStatus, Logger } from '@nestjs/common'

import { AllExceptionsFilter } from './all-exceptions.filter'

describe('allExceptionsFilter', () => {
  let filter: AllExceptionsFilter
  let loggerSpy: jest.SpyInstance

  beforeEach(() => {
    filter = new AllExceptionsFilter()
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should catch a generic error and send a 500 response', () => {
    const mockJson = jest.fn()
    const mockStatus = jest.fn().mockReturnValue({ send: mockJson })
    const mockResponse = { status: mockStatus } as unknown as FastifyReply

    const mockRequest = { url: '/test' }
    const host: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost

    filter.catch(new Error('Test error'), host)

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String),
      path: '/test',
      message: 'Internal server error',
    })
    expect(loggerSpy).toHaveBeenCalledWith(
      `Status: ${HttpStatus.INTERNAL_SERVER_ERROR} Error: "Internal server error"`,
    )
  })

  it('should catch an HttpException and send the correct status and message', () => {
    const mockJson = jest.fn()
    const mockStatus = jest.fn().mockReturnValue({ send: mockJson })
    const mockResponse = { status: mockStatus } as unknown as FastifyReply

    const mockRequest = { url: '/test' }
    const host: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost

    const httpException = new HttpException('Forbidden', HttpStatus.FORBIDDEN)
    filter.catch(httpException, host)

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN)
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      timestamp: expect.any(String),
      path: '/test',
      message: 'Forbidden',
    })
    expect(loggerSpy).toHaveBeenCalledWith(
      `Status: ${HttpStatus.FORBIDDEN} Error: "Forbidden"`,
    )
  })
})
