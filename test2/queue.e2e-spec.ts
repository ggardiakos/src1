// test/queue.e2e-spec.ts

import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { Job, Queue } from 'bullmq'
import { AppModule } from '@appmodule'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { QueueService } from '@queueservice'
import { QueueEvents, Worker } from 'bullmq'

describe('Queue Integration (e2e)', () => {
  let app: INestApplication
  let queueService: QueueService
  let testQueue: Queue
  let queueEvents: QueueEvents
  let worker: Worker
  let logger: Logger

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRootAsync({
          useFactory: () => ({
            connection: {
              host: 'localhost', // Use your Redis host
              port: 6379, // Redis port
            },
          }),
        }),
        BullModule.registerQueue({
          name: 'my-queue',
        }),
        AppModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    logger = app.get<Logger>(Logger)
    await app.init()

    queueService = app.get<QueueService>(QueueService)
    testQueue = app.get<Queue>(getQueueToken('my-queue'))

    // Initialize QueueEvents to listen for job completion
    queueEvents = new QueueEvents('my-queue', {
      connection: { host: 'localhost', port: 6379 },
    })
    await queueEvents.waitUntilReady()

    // Initialize a Worker to process jobs in tests
    worker = new Worker(
      'my-queue',
      async (job: Job) => {
        // Simulate job processing based on job name
        if (job.name === 'test-job') {
          // You can customize processing logic here

        }
        else if (job.name === 'failing-job') {
          throw new Error('Processing failed')
        }
      },
      {
        connection: { host: 'localhost', port: 6379 },
      },
    )

    worker.on('error', (err) => {
      logger.error('Worker encountered an error:', err)
    })
  })

  afterAll(async () => {
    await worker.close()
    await queueEvents.close()
    await app.close()
  })

  afterEach(async () => {
    // Clean up the queue after each test
    await testQueue.obliterate({ force: true })
    await queueEvents.obliterate()
  })

  it('should add a job to the queue', async () => {
    const jobId = await queueService.addJob('test-job', { foo: 'bar' })

    expect(jobId).toBeDefined()

    const job = await testQueue.getJob(jobId)
    expect(job).toBeDefined()
    expect(job?.data.foo).toBe('bar')
  })

  it('should process the job and mark it as completed', async () => {
    const jobData = { foo: 'bar' }

    // Add the job
    const jobId = await queueService.addJob('test-job', jobData)

    // Listen for the 'completed' event
    const completedPromise = new Promise<void>((resolve) => {
      queueEvents.on('completed', (event) => {
        if (event.jobId === jobId) {
          resolve()
        }
      })
    })

    // Wait for the job to be completed
    await completedPromise

    // Verify the job status
    const completedJob = await testQueue.getJob(jobId)
    expect(completedJob).toBeDefined()
    expect(completedJob?.isCompleted()).toBe(true)
    expect(completedJob?.returnvalue).toBeUndefined() // Assuming no return value
  })

  it('should retry the job on failure', async () => {
    const jobData = { foo: 'bar' }
    const maxRetries = 2

    // Add a failing job with retry options
    const jobId = await queueService.addJob(
      'failing-job',
      jobData,
      maxRetries, // Number of retries
    )

    // Listen for the 'failed' event
    const failedPromise = new Promise<void>((resolve) => {
      queueEvents.on('failed', async (event) => {
        if (event.jobId === jobId) {
          // Check the number of attempts
          const job = await testQueue.getJob(jobId)
          if (job && job.attemptsMade > 0) {
            resolve()
          }
        }
      })
    })

    // Wait for the job to fail after retries
    await failedPromise

    // Verify the job status
    const failedJob = await testQueue.getJob(jobId)
    expect(failedJob).toBeDefined()
    expect(failedJob?.isFailed()).toBe(true)
    expect(failedJob?.failedReason).toBe('Processing failed')
    expect(failedJob?.attemptsMade).toBe(maxRetries + 1) // Initial attempt + retries
  })

  it('should fail after max retry attempts', async () => {
    const jobData = { foo: 'bar' }
    const maxRetries = 1

    // Add a failing job with retry options
    const jobId = await queueService.addJob(
      'failing-job',
      jobData,
      maxRetries, // Number of retries
    )

    // Listen for the 'failed' event
    const failedPromise = new Promise<void>((resolve) => {
      queueEvents.on('failed', async (event) => {
        if (event.jobId === jobId) {
          resolve()
        }
      })
    })

    // Wait for the job to fail after retries
    await failedPromise

    // Verify the job status
    const failedJob = await testQueue.getJob(jobId)
    expect(failedJob).toBeDefined()
    expect(failedJob?.isFailed()).toBe(true)
    expect(failedJob?.failedReason).toBe('Processing failed')
    expect(failedJob?.attemptsMade).toBe(maxRetries + 1) // Initial attempt + retries
  })
})
