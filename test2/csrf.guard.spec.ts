import type { ExecutionContext } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'

import { CsrfGuard } from './csrf.guard'

describe('csrfGuard', () => {
  let guard: CsrfGuard

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsrfGuard],
    }).compile()

    guard = module.get<CsrfGuard>(CsrfGuard)
  })

  it('should block requests without CSRF token', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext

    expect(guard.canActivate(context)).toBe(false)
  })

  it('should block requests with invalid CSRF token', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-csrf-token': 'invalid-token' },
        }),
      }),
    } as ExecutionContext

    expect(guard.canActivate(context)).toBe(false)
  })

  it('should allow requests with valid CSRF token', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-csrf-token': 'valid-token' },
        }),
      }),
    } as ExecutionContext

    expect(guard.canActivate(context)).toBe(true)
  })
})
