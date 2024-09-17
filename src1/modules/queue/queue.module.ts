// src/modules/queue/queue.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { BullBoardModule } from 'nestjs-bull-board';
import { BullAdapter } from 'bull-board/bullAdapter';
import { Queue } from 'bullmq';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'default',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        name: configService.get<string>('bull.queueName') || 'default',
        defaultJobOptions: {
          attempts: configService.get<number>('bull.retryAttempts') || 3,
          backoff: {
            type: 'fixed',
            delay: configService.get<number>('bull.retryDelay') || 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      queues: [],
    }),
  ],
  providers: [QueueService, QueueProcessor],
  exports: [QueueService],
})
export class QueueModule {
  constructor(
    private readonly bullBoardModule: BullBoardModule,
    private readonly configService: ConfigService,
  ) {
    const queueName = this.configService.get<string>('bull.queueName') || 'default';
    const queue = new Queue(queueName, {
      connection: {
        host: this.configService.get<string>('redis.host'),
        port: this.configService.get<number>('redis.port'),
        password: this.configService.get<string>('redis.password'),
      },
    });

    this.bullBoardModule.addQueue(new BullAdapter(queue));
  }
}
