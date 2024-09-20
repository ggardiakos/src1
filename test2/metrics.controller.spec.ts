// src/core/metrics/metrics.controller.spec.ts

import type { TestingModule } from '@nestjs/testing'
import type { Response } from 'express'
import type { Counter, Gauge, Histogram } from 'prom-client'
import { Test } from '@nestjs/testing'
import { PrometheusModule } from '@willsoto/nestjs-prometheus'

import { QueueService } from '../queue/queue.service'
import { RedisService } from '../redis/redis.service'
import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics.service'

describe('metricsController', () => {
  let controller: MetricsController
  let queueService: QueueService
  let redisService: RedisService
  let metricsService: MetricsService

  // Mocked Prometheus Metrics
  const mockJobCounter = { inc: jest.fn() } as unknown as Counter<string>
  const mockRedisCommandCounter = { inc: jest.fn() } as unknown as Counter<string>
  const mockJobDurationHistogram = { observe: jest.fn() } as unknown as Histogram<string>
  const mockRedisDurationHistogram = { observe: jest.fn() } as unknown as Histogram<string>
  const mockActiveJobsGauge = { set: jest.fn() } as unknown as Gauge<string>
  const mockRedisCacheSizeGauge = { set: jest.fn() } as unknown as Gauge<string>
  const mockRequestCounter = { inc: jest.fn() } as unknown as Counter<string>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        MetricsService,
        {
          provide: QueueService,
          useValue: {
            getQueueStatus: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            ping: jest.fn(),
            getCacheSize: jest.fn(),
          },
        },
        // Mock Prometheus metrics
        {
          provide: 'queue_jobs_total',
          useValue: mockJobCounter,
        },
        {
          provide: 'redis_commands_total',
          useValue: mockRedisCommandCounter,
        },
        {
          provide: 'queue_jobs_duration_seconds',
          useValue: mockJobDurationHistogram,
        },
        {
          provide: 'redis_cache_duration_seconds',
          useValue: mockRedisDurationHistogram,
        },
        {
          provide: 'queue_jobs_active',
          useValue: mockActiveJobsGauge,
        },
        {
          provide: 'redis_cache_size',
          useValue: mockRedisCacheSizeGauge,
        },
        {
          provide: 'http_requests_total',
          useValue: mockRequestCounter,
        },
      ],
    }).compile()

    controller = module.get<MetricsController>(MetricsController)
    queueService = module.get<QueueService>(QueueService)
    redisService = module.get<RedisService>(RedisService)
    metricsService = module.get<MetricsService>(MetricsService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getMetrics', () => {
    let response: Partial<Response>

    beforeEach(() => {
      response = {
        set: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
    })

    it('should gather and return metrics successfully', async () => {
      // Mock queueService.getQueueStatus()
      (queueService.getQueueStatus as jest.Mock).mockResolvedValue({
        active: 5,
        completed: 100,
        failed: 2,
      });

      // Mock redisService.ping() and getCacheSize()
      (redisService.ping as jest.Mock).mockResolvedValue('PONG');
      (redisService.getCacheSize as jest.Mock).mockResolvedValue(2048)

      // Mock Prometheus metrics
      const mockMetrics = '# HELP http_requests_total Total number of HTTP requests\n'
        + '# TYPE http_requests_total counter\n'
        + 'http_requests_total{method="GET",route="/metrics",status="200"} 1\n'

      // Mock PrometheusModule.register().metrics()
      jest.spyOn(PrometheusModule, 'register').mockReturnValue({
        metrics: jest.fn().mockResolvedValue(mockMetrics),
      } as any)

      // Set Content-Type manually as it's hardcoded in the controller
      const contentType = 'text/plain; version=0.0.4; charset=utf-8'
      jest.spyOn(controller as any, 'set').mockImplementation((key: string, value: string) => {})

      await controller.getMetrics(response as Response)

      expect(queueService.getQueueStatus).toHaveBeenCalled()
      expect(metricsService.setActiveJobs).toHaveBeenCalledWith(5)
      expect(metricsService.incrementJobCounter).toHaveBeenCalledWith(100, 2) // completed + failed

      expect(redisService.ping).toHaveBeenCalled()
      expect(metricsService.incrementRedisCommands).toHaveBeenCalledWith('PING')
      expect(redisService.getCacheSize).toHaveBeenCalled()
      expect(metricsService.setRedisCacheSize).toHaveBeenCalledWith(2048)

      expect(metricsService.incrementRequestCounter).toHaveBeenCalledWith('GET', '/metrics', '200')

      expect(response.set).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8',
      )
      expect(response.end).toHaveBeenCalledWith(mockMetrics)
    })

    it('should handle errors gracefully', async () => {
      // Mock queueService.getQueueStatus() to throw an error
      (queueService.getQueueStatus as jest.Mock).mockRejectedValue(new Error('Queue error'))

      await controller.getMetrics(response as Response)

      expect(queueService.getQueueStatus).toHaveBeenCalled()
      expect(response.status).toHaveBeenCalledWith(500)
      expect(response.send).toHaveBeenCalledWith('Internal Server Error')
    })
  })

  describe('recordJobDuration', () => {
    it('should observe job duration', () => {
      const duration = 2.5
      metricsService.observeJobDuration(duration)
      expect(mockJobDurationHistogram.observe).toHaveBeenCalledWith(duration)
    })
  })

  describe('recordRedisCommandDuration', () => {
    it('should observe Redis command duration', () => {
      const duration = 0.75
      const operation = 'GET'
      metricsService.observeRedisCommandDuration(duration, operation)
      expect(mockRedisDurationHistogram.observe).toHaveBeenCalledWith(duration, { operation })
    })
  })
})
