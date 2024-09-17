// src/modules/redis/redis.service.ts

import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import * as IORedis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: IORedis.Redis,
  ) {
    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redisClient.on('ready', () => {
      this.logger.log('Redis client is ready');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis client error', err);
    });

    this.redisClient.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.redisClient.on('reconnecting', () => {
      this.logger.log('Reconnecting to Redis...');
    });
  }

  /**
   * Pings the Redis server to check connectivity.
   * @returns The response from the Redis server.
   */
  async ping(): Promise<string> {
    try {
      const response = await this.redisClient.ping();
      this.logger.debug(`Redis ping response: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Redis ping failed', error);
      throw error;
    }
  }

  /**
   * Sets a key-value pair in Redis with an optional TTL (time to live).
   * @param key - The key to set.
   * @param value - The value to set.
   * @param ttl - Time to live in seconds.
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redisClient.set(key, value, 'EX', ttl);
      } else {
        await this.redisClient.set(key, value);
      }
      this.logger.debug(`Set key ${key} in Redis`);
    } catch (error) {
      this.logger.error(`Failed to set key ${key} in Redis`, error);
      throw error;
    }
  }

  /**
   * Gets the value of a key from Redis.
   * @param key - The key to retrieve.
   * @returns The value associated with the key.
   */
  async get(key: string): Promise<string | null> {
    try {
      const value = await this.redisClient.get(key);
      this.logger.debug(`Get key ${key} from Redis: ${value}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to get key ${key} from Redis`, error);
      throw error;
    }
  }

  /**
   * Deletes a key from Redis.
   * @param key - The key to delete.
   * @returns The number of keys that were removed.
   */
  async del(key: string): Promise<number> {
    try {
      const result = await this.redisClient.del(key);
      this.logger.debug(`Deleted key ${key} from Redis`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete key ${key} from Redis`, error);
      throw error;
    }
  }

  /**
   * Clears the entire Redis database.
   */
  async flushAll(): Promise<void> {
    try {
      await this.redisClient.flushall();
      this.logger.warn('Flushed all keys from Redis');
    } catch (error) {
      this.logger.error('Failed to flush Redis', error);
      throw error;
    }
  }

  /**
   * This method is called when the module is destroyed to close the Redis connection.
   */
  async onModuleDestroy() {
    this.logger.log('Closing Redis connection');
    await this.redisClient.quit();
  }
}
