// src/modules/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  HealthCheck,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const databaseTimeout =
      this.configService.get<number>('health.databaseTimeout') || 300;

    return this.health.check([
      // Database health check
      async () => this.db.pingCheck('database', { timeout: databaseTimeout }),

      // Disk health check (e.g., ensure at least 50% free space)
      async () =>
        this.disk.checkStorage('disk health', {
          thresholdPercent: 0.5,
          path: '/',
        }),

      // Memory health check (e.g., ensure at least 150MB free)
      async () =>
        this.memory.checkHeap('memory heap', 150 * 1024 * 1024 /* 150MB */),

      // External service health check (e.g., Shopify API)
      async () =>
        this.http.pingCheck(
          'shopify',
          this.configService.get<string>('shopify.apiUrl') || 'https://api.shopify.com',
        ),
    ]);
  }
}
