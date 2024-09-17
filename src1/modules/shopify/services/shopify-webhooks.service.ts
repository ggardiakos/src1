// src/modules/shopify/services/shopify-webhooks.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopifyService } from './shopify.service';
import { RedisService } from '../../redis/redis.service';
import { QueueService } from '../../queue/queue.service';
import { ContentfulService } from '../../contentful/contentful.service';
import * as Sentry from '@sentry/node';
import { retry } from 'ts-retry-promise';
import { WebhookProcessingError } from '../errors/webhook-processing.error';
import { validateWebhookPayload } from '../utils/webhook-validator'; // Utility for validating webhook payloads
import { metrics } from '../../common/metrics'; // For capturing metrics like webhook processing time

@Injectable()
export class ShopifyWebhooksService {
  private readonly logger = new Logger(ShopifyWebhooksService.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly contentfulService: ContentfulService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handles the "PRODUCTS_CREATE" webhook event from Shopify.
   * Syncs the created product with Contentful and triggers background jobs.
   * @param payload - The webhook payload
   * @param shop - The shop domain
   */
  @metrics.measure
  async handleProductCreate(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload); // Validate incoming payload
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_CREATE for Product ID: ${productId} from shop: ${shop}`,
      );

      // Clear any cached product data
      await this.redisService.del(`product:${productId}`);

      // Fetch the newly created product from Shopify
      const product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!product) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found.`,
        );
      }

      // Sync the product with Contentful (or another CMS)
      const contentfulProductInput = {
        title: product.title,
        description: product.description,
        // Add other necessary fields from the Shopify product to map into Contentful
      };
      await this.contentfulService.createProduct(contentfulProductInput);

      // Trigger background job to notify admins or perform other tasks
      await this.queueService.addTask({
        type: 'send-email',
        payload: {
          to: this.configService.get<string>('ADMIN_EMAIL'),
          subject: 'New Product Created',
          body: `A new product "${product.title}" has been created.`,
        },
      });

      this.logger.log(
        `Successfully processed PRODUCTS_CREATE for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing PRODUCTS_CREATE webhook', error);
      Sentry.captureException(error); // Send error to Sentry for tracking
      throw new WebhookProcessingError(
        'Failed to process PRODUCTS_CREATE webhook',
        error,
      );
    } finally {
      metrics.record('webhook_processing_time', Date.now() - startTime);
    }
  }

  /**
   * Handles the "PRODUCTS_UPDATE" webhook event from Shopify.
   * Syncs the updated product with Contentful and triggers background jobs.
   * @param payload - The webhook payload
   * @param shop - The shop domain
   */
  @metrics.measure
  async handleProductUpdate(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload); // Validate incoming payload
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_UPDATE for Product ID: ${productId} from shop: ${shop}`,
      );

      // Clear cached product data
      await this.redisService.del(`product:${productId}`);

      // Fetch the updated product from Shopify
      const product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!product) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found.`,
        );
      }

      // Sync the updated product with Contentful
      const contentfulProductInput = {
        title: product.title,
        description: product.description,
        // Map other necessary fields to Contentful
      };
      await this.contentfulService.updateProduct(contentfulProductInput);

      // Trigger background job if needed
      await this.queueService.addTask({
        type: 'send-email',
        payload: {
          to: this.configService.get<string>('ADMIN_EMAIL'),
          subject: 'Product Updated',
          body: `The product "${product.title}" has been updated.`,
        },
      });

      this.logger.log(
        `Successfully processed PRODUCTS_UPDATE for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing PRODUCTS_UPDATE webhook', error);
      Sentry.captureException(error);
      throw new WebhookProcessingError(
        'Failed to process PRODUCTS_UPDATE webhook',
        error,
      );
    } finally {
      metrics.record('webhook_processing_time', Date.now() - startTime);
    }
  }

  /**
   * Handles the "PRODUCTS_DELETE" webhook event from Shopify.
   * Removes the deleted product from Contentful and clears cache.
   * @param payload - The webhook payload
   * @param shop - The shop domain
   */
  @metrics.measure
  async handleProductDelete(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload); // Validate incoming payload
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_DELETE for Product ID: ${productId} from shop: ${shop}`,
      );

      // Clear cached product data
      await this.redisService.del(`product:${productId}`);

      // Remove product from Contentful
      await this.contentfulService.deleteProduct(productId);

      this.logger.log(
        `Successfully processed PRODUCTS_DELETE for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing PRODUCTS_DELETE webhook', error);
      Sentry.captureException(error);
      throw new WebhookProcessingError(
        'Failed to process PRODUCTS_DELETE webhook',
        error,
      );
    } finally {
      metrics.record('webhook_processing_time', Date.now() - startTime);
    }
  }

  /**
   * Generic webhook handler for Shopify events not specifically covered.
   * @param eventType - The type of the Shopify webhook event
   * @param payload - The webhook payload
   */
  async handleGenericEvent(eventType: string, payload: any): Promise<void> {
    this.logger.log(`Handling generic webhook event: ${eventType}`);
    try {
      await retry(async () => {
        this.logger.log(`Processing event ${eventType} with payload: ${JSON.stringify(payload)}`);
        // Add logic for handling other events as needed
      }, {
        retries: 3,
        delay: 1000,
        onError: (error, attempt) => {
          this.logger.warn(`Attempt ${attempt} to process ${eventType} failed: ${error.message}`);
          Sentry.captureException(error);
        },
      });

      this.logger.log(`${eventType} webhook processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process ${eventType} webhook`, error);
      Sentry.captureException(error);
      throw new WebhookProcessingError(`Failed to process ${eventType} webhook`, error);
    }
  }
}
