import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as Sentry from '@sentry/node'
import { throwError } from 'rxjs'

import { SentryInterceptor } from './sentry.interceptor'

jest.mock('@sentry/node')

describe('sentryInterceptor', () => {
  let interceptor: SentryInterceptor
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SentryInterceptor],
    }).compile()

    interceptor = module.get<SentryInterceptor>(SentryInterceptor)
    logger = new Logger(SentryInterceptor.name)
    jest.spyOn(logger, 'error').mockImplementation(jest.fn())
  })

  const mockExecutionContext = (): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/test-url',
        method: 'GET',
        body: { key: 'value' },
        query: { search: 'test' },
        params: { id: '123' },
        user: { id: 'user1', email: 'user@example.com' },
      }),
    }),
  } as unknown as ExecutionContext)

  const mockCallHandler = (): CallHandler => ({
    handle: () => throwError(new Error('Test error')),
  })

  it('should capture the error and send it to Sentry with correct scope', async () => {
    const context = mockExecutionContext()
    const next = mockCallHandler()

    await expect(
      interceptor.intercept(context, next).toPromise(),
    ).rejects.toThrow('Test error')

    expect(Sentry.withScope).toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error))

    const sentryScopeCallback = (Sentry.withScope as jest.Mock).mock.calls[0][0]
    const mockScope = {
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setUser: jest.fn(),
    }

    sentryScopeCallback(mockScope)

    expect(mockScope.setTag).toHaveBeenCalledWith('url', '/test-url')
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'GET')
    expect(mockScope.setTag).toHaveBeenCalledWith('status_code', 500)
    expect(mockScope.setExtra).toHaveBeenCalledWith('body', { key: 'value' })
    expect(mockScope.setExtra).toHaveBeenCalledWith('query', { search: 'test' })
    expect(mockScope.setExtra).toHaveBeenCalledWith('params', { id: '123' })
    expect(mockScope.setUser).toHaveBeenCalledWith({
      id: 'user1',
      email: 'user@example.com',
    })
  })

  it('should log the error', async () => {
    const context = mockExecutionContext()
    const next = mockCallHandler()

    await expect(
      interceptor.intercept(context, next).toPromise(),
    ).rejects.toThrow('Test error')

    expect(logger.error).toHaveBeenCalledWith(
      'Exception captured by Sentry: Test error',
      expect.any(String),
    )
  })
})
