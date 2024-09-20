import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard } from '@nestjs/throttler'

import { SecurityService } from './security.service'

describe('security Throttling', () => {
  let securityService: SecurityService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityService, ThrottlerGuard],
    }).compile()

    securityService = module.get<SecurityService>(SecurityService)
  })

  it('should rate limit excessive requests', async () => {
    // Simulate making too many requests within TTL
    for (let i = 0; i < 101; i++) {
      await expect(securityService.validateToken('test-token')).resolves.not.toThrow()
    }

    await expect(securityService.validateToken('test-token')).rejects.toThrow(
      'Rate limit exceeded',
    )
  })
})
