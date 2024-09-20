// src/modules/queue/queue.service.spec.ts

import type { TestingModule } from '@nestjs/testing'
import type { Queue } from 'bullmq'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Test } from '@nestjs/testing'

import { QueueService } from './queue.service'

describe('queueService', () => {
  let service: QueueService
  let queue: Queue

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BullModule.registerQueue({ name: 'default' })],
      providers: [
        QueueService,
        {
          provide: getQueueToken('default'),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: '123' }),
            getJobCounts: jest.fn().mockResolvedValue({
              waiting: 0,
              active: 1,
              completed: 10,
              failed: 0,
            }),
          },
        },
      ],
    }).compile()

    service = module.get<QueueService>(QueueService)
    queue = module.get<Queue>(getQueueToken('default'))
  })

  it('should add a job to the queue', async () => {
    const jobId = await service.addJob('test-job', { type: 'email', payload: { email: 'test@test.com' } })
    expect(jobId).toBe('123')
    expect(queue.add).toHaveBeenCalledWith('test-job', { type: 'email', payload: { email: 'test@test.com' } })
  })

  it('should return the queue status', async () => {
    const status = await service.getQueueStatus()
    expect(status).toEqual({ waiting: 0, active: 1, completed: 10, failed: 0 })
  })
})
