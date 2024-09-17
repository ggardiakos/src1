// src/modules/redis/controller/redis.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Controller('redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Pings the Redis server to verify connectivity.
   * Example: GET /redis/ping
   */
  @Get('ping')
  async pingRedis(): Promise<{ response: string }> {
    const response = await this.redisService.ping();
    return { response };
  }

  /**
   * Sets a key-value pair in Redis.
   * Example: GET /redis/set?key=foo&value=bar&ttl=60
   */
  @Get('set')
  async setKey(
    @Query('key') key: string,
    @Query('value') value: string,
    @Query('ttl') ttl?: number,
  ): Promise<{ success: boolean }> {
    await this.redisService.set(key, value, ttl ? Number(ttl) : undefined);
    return { success: true };
  }

  /**
   * Gets the value of a key from Redis.
   * Example: GET /redis/get?key=foo
   */
  @Get('get')
  async getKey(@Query('key') key: string): Promise<{ value: string | null }> {
    const value = await this.redisService.get(key);
    return { value };
  }

  /**
   * Deletes a key from Redis.
   * Example: GET /redis/del?key=foo
   */
  @Get('del')
  async delKey(@Query('key') key: string): Promise<{ deleted: number }> {
    const deleted = await this.redisService.del(key);
    return { deleted };
  }
}
