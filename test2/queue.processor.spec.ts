// src/modules/queue/queue.processor.spec.ts
import type { TestingModule } from '@nestjs/testing'
import type { Job } from 'bullmq'
import { Test } from '@nestjs/testing'

import { QueueProcessor } from './queue.processor'

describe('queueProcessor', () => {
  let processor: QueueProcessor

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueProcessor],
    }).compile()

    processor = module.get<QueueProcessor>(QueueProcessor)
  })

  it('should process email job', async () => {
    const job = {
      id: '123',
      data: { type: 'sendEmail', payload: { email: 'test@example.com' } },
    } as Job

    await expect(processor.handleProcessTask(job)).resolves.not.toThrow()
  })

  it('should throw for unknown job types', async () => {
    const job = {
      id: '123',
      data: { type: 'unknownJobType', payload: {} },
    } as Job

    await expect(processor.handleProcessTask(job)).rejects.toThrow('Unknown task type')
  })
})
