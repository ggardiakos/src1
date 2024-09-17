// src/app.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopifyService } from './modules/shopify/services/shopify.service';
import { ContentfulService } from './modules/contentful/contentful.service';
import { MonitoringService } from './core/monitoring.service';
import { RedisService } from './modules/redis/redis.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly shopifyService: ShopifyService,
    private readonly contentfulService: ContentfulService,
    private readonly monitoringService: MonitoringService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Performs initial setup tasks for the application.
   */
  async initializeApp(): Promise<void> {
    this.logger.log('Initializing application...');

    try {
      // Preload data from Shopify and cache it
      await this.preloadShopifyData();

      // Initialize Contentful configurations
      await this.contentfulService.initialize();

      // Start monitoring services
      this.monitoringService.startMonitoring();

      this.logger.log('Application initialization complete.');
    } catch (error) {
      this.logger.error('Error during application initialization', error);
      throw error;
    }
  }

  /**
   * Preloads data from Shopify and caches it in Redis.
   */
  private async preloadShopifyData(): Promise<void> {
    this.logger.log('Preloading Shopify data...');

    try {
      // Fetch products from Shopify
      const products = await this.shopifyService.getAllProducts();

      // Cache products in Redis
      await this.redisService.set(
        'shopify:products',
        JSON.stringify(products),
        3600, // Cache for 1 hour
      );

      this.logger.log('Shopify data preloaded and cached.');
    } catch (error) {
      this.logger.error('Error preloading Shopify data', error);
      throw error;
    }
  }

  /**
   * Provides a simple health check endpoint.
   */
  getHealthStatus(): string {
    return 'OK';
  }
}
