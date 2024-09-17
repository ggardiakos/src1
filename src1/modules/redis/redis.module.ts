// src/modules/redis/redis.module.ts

import { Module, DynamicModule, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as IORedis from 'ioredis';

@Global()
@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: async (configService: ConfigService) => {
            const redisOptions: IORedis.RedisOptions = {
              host: configService.get<string>('redis.host'),
              port: configService.get<number>('redis.port'),
              password: configService.get<string>('redis.password') || undefined,
              db: configService.get<number>('redis.db') || 0,
            };
            const client = new IORedis(redisOptions);
            client.on('error', (err) => {
              console.error('Redis Client Error', err);
            });
            return client;
          },
          inject: [ConfigService],
        },
        RedisService,
      ],
      exports: ['REDIS_CLIENT', RedisService],
    };
  }

  static forRootAsync(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: async (configService: ConfigService) => {
            const redisOptions: IORedis.RedisOptions = {
              host: configService.get<string>('redis.host'),
              port: configService.get<number>('redis.port'),
              password: configService.get<string>('redis.password') || undefined,
              db: configService.get<number>('redis.db') || 0,
            };
            const client = new IORedis(redisOptions);
            client.on('error', (err) => {
              console.error('Redis Client Error', err);
            });
            return client;
          },
          inject: [ConfigService],
        },
        RedisService,
      ],
      exports: ['REDIS_CLIENT', RedisService],
    };
  }
}
