// src/core/monitoring.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import tracer from 'dd-trace';

@Injectable()
export class MonitoringService {
  constructor(private readonly configService: ConfigService) {
    this.initializeDatadog();
  }

  private initializeDatadog() {
    tracer.init({
      service: this.configService.get<string>('datadog.serviceName') || 'my-app',
      env: this.configService.get<string>('datadog.env') || 'development',
      version: this.configService.get<string>('datadog.version') || '1.0.0',
      logInjection: true,
    });
  }
}
