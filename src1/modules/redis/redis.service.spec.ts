// src/modules/redis/redis.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import * as IORedis from 'ioredis';

describe('RedisService', () => {
  let service: RedisService;
  let redisClient: IORedis.Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: 'REDIS_CLIENT',
          useFactory: () => {
            const redisMock = new IORedis(); // Mock Redis client
            jest.spyOn(redisMock, 'set');
            jest.spyOn(redisMock, 'get');
            jest.spyOn(redisMock, 'del');
            jest.spyOn(redisMock, 'ping');
            return redisMock;
          },
        },
        ConfigService,
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    redisClient = module.get<IORedis.Redis>('REDIS_CLIENT');
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should ping Redis', async () => {
    const pingResult = 'PONG';
    (redisClient.ping as jest.Mock).mockResolvedValue(pingResult);

    const result = await service.ping();
    expect(result).toBe(pingResult);
    expect(redisClient.ping).toHaveBeenCalledTimes(1);
  });

  it('should set a key with TTL', async () => {
    const key = 'test_key';
    const value = 'test_value';
    const ttl = 10;

    await service.set(key, value, ttl);
    expect(redisClient.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
  });

  it('should set a key without TTL', async () => {
    const key = 'test_key_no_ttl';
    const value = 'test_value';

    await service.set(key, value);
    expect(redisClient.set).toHaveBeenCalledWith(key, value);
  });

  it('should get a key', async () => {
    const key = 'test_key';
    const value = 'test_value';

    (redisClient.get as jest.Mock).mockResolvedValue(value);

    const result = await service.get(key);
    expect(result).toBe(value);
    expect(redisClient.get).toHaveBeenCalledWith(key);
  });

  it('should return null if key does not exist', async () => {
    const key = 'non_existent_key';

    (redisClient.get as jest.Mock).mockResolvedValue(null);

    const result = await service.get(key);
    expect(result).toBeNull();
    expect(redisClient.get).toHaveBeenCalledWith(key);
  });

  it('should delete a key', async () => {
    const key = 'test_key_to_delete';

    (redisClient.del as jest.Mock).mockResolvedValue(1);

    const result = await service.del(key);
    expect(result).toBe(1);
    expect(redisClient.del).toHaveBeenCalledWith(key);
  });
});
