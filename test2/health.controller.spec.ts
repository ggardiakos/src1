import type { TestingModule } from '@nestjs/testing'
import { HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus'
import { Test } from '@nestjs/testing'

import { HealthController } from './health.controller'

describe('healthController', () => {
  let controller: HealthController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthCheckService,
        HttpHealthIndicator,
        MemoryHealthIndicator,
        {
          provide: 'TypeOrmHealthIndicator',
          useValue: { pingCheck: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: 'RedisHealthIndicator',
          useValue: { pingCheck: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile()

    controller = module.get<HealthController>(HealthController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should return health checks', async () => {
    const result = await controller.check()
    expect(result).toBeDefined()
  })
})
