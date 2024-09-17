// src/modules/queue/queue.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface JobData {
  email?: string;
  subject?: string;
  body?: string;
  userId?: string;
  reportType?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('default') private readonly queue: Queue) {}

  async addEmailJob(email: string, subject: string, body: string): Promise<void> {
    const jobData: JobData = { email, subject, body };
    this.logger.log(`Adding email job to queue: ${email}`);
    await this.queue.add('sendEmail', jobData);
  }

  async addReportGenerationJob(userId: string, reportType: string): Promise<void> {
    const jobData: JobData = { userId, reportType };
    this.logger.log(`Adding report generation job for user: ${userId}`);
    await this.queue.add('generateReport', jobData);
  }

  // You can add other utility methods as needed
  async addGenericJob(jobName: string, data: JobData): Promise<void> {
    this.logger.log(`Adding generic job: ${jobName}`);
    await this.queue.add(jobName, data);
  }

  async getQueueJobCounts(): Promise<any> {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();

    return { waiting, active, completed, failed };
  }
}
