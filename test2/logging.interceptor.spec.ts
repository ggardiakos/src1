import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as Sentry from '@sentry/node'
import { lastValueFrom, of, throwError } from 'rxjs'

import { LoggingInterceptor } from './logging.interceptor'

jest.mock('@sentry/node')

describe('loggingInterceptor', () => {
  let interceptor: LoggingInterceptor
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile()

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor)
    logger = module.get<Logger>(Logger)
  })

  const mockExecutionContext = (): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: (): FastifyRequest => ({
        method: 'GET',
        url: '/test',
      } as FastifyRequest),
      getResponse: (): FastifyReply => ({
        statusCode: 200,
      } as FastifyReply),
    }),
  } as unknown as ExecutionContext)

  const mockCallHandler = (): CallHandler => ({
    handle: () => of('response'),
  })

  it('should log incoming request and response duration', async () => {
    const context = mockExecutionContext()
    const next = mockCallHandler()
    const startTime = Date.now()

    await lastValueFrom(interceptor.intercept(context, next))

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Incoming request'))
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Response sent in'))
    const duration = Date.now() - startTime
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`${duration}ms`))
  })

  it('should log error and send to Sentry on failure', async () => {
    const context = mockExecutionContext()
    const next = {
      handle: () => throwError(() => new Error('Test error')),
    } as CallHandler
    const startTime = Date.now()

    await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toThrow('Test error')

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error occurred after'),
      'Test error',
    )
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error))
    const duration = Date.now() - startTime
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`${duration}ms`))
  })

  it('should attach requestId to the request', async () => {
    const context = mockExecutionContext()
    const next = mockCallHandler()
    const request = context.switchToHttp().getRequest<FastifyRequest>()

    await lastValueFrom(interceptor.intercept(context, next))

    expect((request as any).requestId).toBeDefined() // Verifies that a requestId has been attached
  })
})
