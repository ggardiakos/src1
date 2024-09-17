import { Injectable, Logger } from '@nestjs/common';
import { ShopifyService } from '../services/shopify.service';
import { RedisService } from '../../redis/redis.service';
import { ContentfulService } from '../../contentful/contentful.service';
import { QueueService } from '../../queue/queue.service';
import { ConfigService } from '@nestjs/config';
import { Sentry } from '@sentry/node';
import { retry } from 'ts-retry-promise';
import { WebhookProcessingError } from '../errors/webhook-processing.error';
import { validateWebhookPayload } from '../utils/webhook-validator';
import { Product } from '../graphql/schemas';
import { CreateProductInput } from '../graphql/dto/create-product.input';

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly contentfulService: ContentfulService,
    private readonly configService: ConfigService,
  ) {}

  async processProductCreateEvent(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      // Validate the incoming webhook payload
      validateWebhookPayload(payload);
      const productId = payload.id;

      this.logger.log(
        `Processing product creation event for Product ID: ${productId} from shop: ${shop}`,
      );

      // Invalidate product cache in Redis
      await this.redisService.del(`product:${productId}`);

      // Fetch product details from Shopify
      const product: Product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!product) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found in Shopify.`,
        );
      }

      // Prepare Contentful product input
      const contentfulProductInput: CreateProductInput = {
        title: product.title,
        description: product.description,
        // Add other necessary fields here
      };

      // Sync product to Contentful
      await this.contentfulService.createProduct(contentfulProductInput);

      // Add a background job to notify via email or other systems
      await this.queueService.addTask({
        type: 'send-email',
        payload: {
          to: this.configService.get<string>('ADMIN_EMAIL'),
          subject: 'New Product Created',
          body: `A new product "${product.title}" has been created in the Shopify store.`,
        },
      });

      this.logger.log(
        `Successfully processed product creation event for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing product creation webhook event', error);
      Sentry.captureException(error);
      throw new WebhookProcessingError('Failed to process product creation webhook', error);
    } finally {
      const elapsed = Date.now() - startTime;
      this.logger.log(`Webhook processed in ${elapsed}ms`);
    }
  }

  async processProductUpdateEvent(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      // Validate the incoming webhook payload
      validateWebhookPayload(payload);
      const productId = payload.id;

      this.logger.log(
        `Processing product update event for Product ID: ${productId} from shop: ${shop}`,
      );

      // Invalidate product cache in Redis
      await this.redisService.del(`product:${productId}`);

      // Fetch updated product details from Shopify
      const updatedProduct: Product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!updatedProduct) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found in Shopify.`,
        );
      }

      // Update Contentful product
      await this.contentfulService.updateProduct({
        id: updatedProduct.id,
        title: updatedProduct.title,
        description: updatedProduct.description,
      });

      this.logger.log(
        `Successfully processed product update event for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing product update webhook event', error);
      Sentry.captureException(error);
      throw new WebhookProcessingError('Failed to process product update webhook', error);
    } finally {
      const elapsed = Date.now() - startTime;
      this.logger.log(`Webhook processed in ${elapsed}ms`);
    }
  }

  async processProductDeleteEvent(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      // Validate the incoming webhook payload
      validateWebhookPayload(payload);
      const productId = payload.id;

      this.logger.log(
        `Processing product deletion event for Product ID: ${productId} from shop: ${shop}`,
      );

      // Invalidate product cache in Redis
      await this.redisService.del(`product:${productId}`);

      // Delete the product from Contentful
      await this.contentfulService.deleteProduct(productId);

      this.logger.log(
        `Successfully processed product deletion event for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing product deletion webhook event', error);
      Sentry.captureException(error);
      throw new WebhookProcessingError('Failed to process product deletion webhook', error);
    } finally {
      const elapsed = Date.now() - startTime;
      this.logger.log(`Webhook processed in ${elapsed}ms`);
    }
  }
}
