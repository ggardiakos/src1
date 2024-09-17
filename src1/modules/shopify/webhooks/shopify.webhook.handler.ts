import { Injectable, Logger } from '@nestjs/common';
import { ShopifyWebhooks } from '@nestjs-shopify/webhooks';
import { ConfigService } from '@nestjs/config';
import { ShopifyService } from '../services/shopify.service';
import { RedisService } from '../../redis/redis.service';
import { QueueService } from '../../queue/queue.service';
import { ContentfulService } from '../../contentful/contentful.service';
import * as Sentry from '@sentry/node';
import { Product } from '../graphql/schemas';
import { CreateProductInput } from '../graphql/dto/create-product.input';
import { validateWebhookPayload } from '../utils/webhook-validator';
import { WebhookProcessingError } from '../errors/webhook-processing.error';
import { retry } from 'ts-retry-promise';
import { metrics } from '../../common/metrics';

@Injectable()
export class ShopifyWebhookHandler {
  private readonly logger = new Logger(ShopifyWebhookHandler.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly contentfulService: ContentfulService,
    private readonly configService: ConfigService,
  ) {}

  async handleProductCreate(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload);
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_CREATE for Product ID: ${productId} from shop: ${shop}`,
      );

      // Remove product from cache
      await this.redisService.del(`product:${productId}`);

      // Fetch the product details from Shopify
      const product: Product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!product) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found.`,
        );
      }

      // Map to Contentful product input format
      const contentfulProductInput: CreateProductInput = {
        title: product.title,
        description: product.description,
        // Add other necessary fields here
      };

      // Sync the product with Contentful
      await this.contentfulService.createProduct(contentfulProductInput);

      // Add a background job to notify via email or other system
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
      Sentry.captureException(error);
      throw new WebhookProcessingError(
        'Failed to process PRODUCTS_CREATE webhook',
        error,
      );
    } finally {
      metrics.record('webhook_processing_time', Date.now() - startTime);
    }
  }

  async handleProductUpdate(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload);
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_UPDATE for Product ID: ${productId} from shop: ${shop}`,
      );

      // Invalidate product cache
      await this.redisService.del(`product:${productId}`);

      // Fetch updated product details from Shopify
      const updatedProduct: Product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!updatedProduct) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found.`,
        );
      }

      // Update Contentful product with the new details
      await this.contentfulService.updateProduct({
        id: updatedProduct.id,
        title: updatedProduct.title,
        description: updatedProduct.description,
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

  async handleProductDelete(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload);
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_DELETE for Product ID: ${productId} from shop: ${shop}`,
      );

      // Invalidate product cache
      await this.redisService.del(`product:${productId}`);

      // Remove the product from Contentful
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

  // Other webhook handling methods can be implemented similarly
}
