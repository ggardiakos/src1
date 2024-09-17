// src/modules/queue/queue.processor.ts

import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('default')
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  @Process('sendEmail')
  async handleSendEmailJob(job: Job<any>): Promise<void> {
    this.logger.log(`Processing email job with ID: ${job.id}`);
    const { email, subject, body } = job.data;

    // Simulate sending an email (replace with actual email service)
    this.logger.log(`Sending email to: ${email}, Subject: ${subject}`);
    console.log(`Email body: ${body}`);

    // Here you can integrate with an email provider like SendGrid, SES, etc.
  }

  @Process('generateReport')
  async handleGenerateReportJob(job: Job<any>): Promise<void> {
    this.logger.log(`Processing report generation job with ID: ${job.id}`);
    const { userId, reportType } = job.data;

    // Simulate report generation logic
    this.logger.log(`Generating report for user: ${userId}, Type: ${reportType}`);

    // Implement actual report generation logic here
  }

  @Process()
  async handleGenericJob(job: Job<any>): Promise<void> {
    this.logger.log(`Processing generic job with ID: ${job.id}`);
    // Add logic for generic jobs
    console.log(`Processing job with data:`, job.data);
  }
}
