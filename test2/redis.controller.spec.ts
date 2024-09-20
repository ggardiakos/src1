import type { TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { RedisService } from '../redis.service'
import { RedisController } from './redis.controller'

describe('redisController', () => {
  let controller: RedisController
  let redisService: RedisService

  const mockRedisService = {
    ping: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedisController],
      providers: [
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile()

    controller = module.get<RedisController>(RedisController)
    redisService = module.get<RedisService>(RedisService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('pingRedis', () => {
    it('should return the Redis ping response', async () => {
      mockRedisService.ping.mockResolvedValue('PONG')
      const result = await controller.pingRedis()
      expect(result).toEqual({ response: 'PONG' })
      expect(redisService.ping).toHaveBeenCalled()
    })

    it('should throw BadRequestException if Redis ping fails', async () => {
      mockRedisService.ping.mockRejectedValue(new Error('Ping failed'))
      await expect(controller.pingRedis()).rejects.toThrow(BadRequestException)
    })
  })

  describe('setKey', () => {
    it('should set a key-value pair in Redis', async () => {
      mockRedisService.set.mockResolvedValue(true)
      const result = await controller.setKey('foo', 'bar', 60)
      expect(result).toEqual({ success: true })
      expect(redisService.set).toHaveBeenCalledWith('foo', 'bar', 60)
    })

    it('should throw BadRequestException if key or value is missing', async () => {
      await expect(controller.setKey('', 'bar')).rejects.toThrow(BadRequestException)
      await expect(controller.setKey('foo', '')).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException if Redis set operation fails', async () => {
      mockRedisService.set.mockRejectedValue(new Error('Set failed'))
      await expect(controller.setKey('foo', 'bar')).rejects.toThrow(BadRequestException)
    })
  })

  describe('getKey', () => {
    it('should return the value of a key from Redis', async () => {
      mockRedisService.get.mockResolvedValue('bar')
      const result = await controller.getKey('foo')
      expect(result).toEqual({ value: 'bar' })
      expect(redisService.get).toHaveBeenCalledWith('foo')
    })

    it('should throw BadRequestException if key is missing', async () => {
      await expect(controller.getKey('')).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException if Redis get operation fails', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Get failed'))
      await expect(controller.getKey('foo')).rejects.toThrow(BadRequestException)
    })
  })

  describe('delKey', () => {
    it('should delete a key from Redis', async () => {
      mockRedisService.del.mockResolvedValue(1)
      const result = await controller.delKey('foo')
      expect(result).toEqual({ deleted: 1 })
      expect(redisService.del).toHaveBeenCalledWith('foo')
    })

    it('should throw BadRequestException if key is missing', async () => {
      await expect(controller.delKey('')).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException if Redis delete operation fails', async () => {
      mockRedisService.del.mockRejectedValue(new Error('Delete failed'))
      await expect(controller.delKey('foo')).rejects.toThrow(BadRequestException)
    })
  })
})
