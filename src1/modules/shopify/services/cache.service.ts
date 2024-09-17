// src/modules/shopify/services/cache.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@InjectRedis() private readonly redisClient: Redis) {}

  /**
   * Retrieves a value from Redis by key.
   * @param key - The key to retrieve
   * @returns The value associated with the key, or null if not found
   */
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.redisClient.get(key);
      this.logger.debug(`Retrieved value for key: ${key}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to get value for key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stores a key-value pair in Redis with an optional time-to-live (TTL).
   * @param key - The key to store
   * @param value - The value to store
   * @param ttlSeconds - The TTL for the key in seconds (optional)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
        this.logger.debug(`Set key: ${key} with TTL: ${ttlSeconds} seconds`);
      } else {
        await this.redisClient.set(key, value);
        this.logger.debug(`Set key: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a key from Redis.
   * @param key - The key to delete
   * @returns The number of keys that were removed
   */
  async del(key: string): Promise<number> {
    try {
      const result = await this.redisClient.del(key);a
      this.logger.debug(`Deleted key: ${key}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clears all keys from Redis.
   */
  async flushAll(): Promise<void> {
    try {
      await this.redisClient.flushall();
      this.logger.warn('Flushed all keys from Redis');
    } catch (error) {
      this.logger.error('Failed to flush Redis cache', error);
      throw error;
    }
  }
}
