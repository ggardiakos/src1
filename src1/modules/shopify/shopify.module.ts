import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { ShopifyAuthModule } from '@nestjs-shopify/auth';
import { ShopifyWebhooksModule } from '@nestjs-shopify/webhooks';
import { ShopifyFastifyModule } from '@nestjs-shopify/fastify';

import { ShopifyAuthController } from './controllers/shopify-auth.controller';
import { ShopifyService } from './services/shopify.service';
import { ShopifyAuthService } from './services/shopify-auth.service';
import { ShopifyWebhookHandler } from './webhooks/shopify.webhook.handler';
import { CustomShopifyGraphQLService } from './graphql/custom-shopify-graphql.service'; // Import your custom Shopify GraphQL service
import { ShopifyWebhooksService } from './services/shopify-webhooks.service';
import { ShopifyProductService } from './services/shopify-product.service';

import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { ContentfulModule } from '../contentful/contentful.module';

@Module({
  imports: [
    HttpModule,
    ShopifyFastifyModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        apiKey: configService.get<string>('shopify.apiKey'),
        apiSecret: configService.get<string>('shopify.apiSecret'),
        scopes: configService.get<string[]>('shopify.scopes'),
        hostName: configService.get<string>('shopify.hostName'),
        apiVersion: configService.get<string>('shopify.apiVersion'),
        isEmbedded: configService.get<boolean>('shopify.isEmbedded'),
        authPath: '/auth/shopify/login',
        afterAuthPath: '/auth/shopify/callback',
        webhookPath: configService.get<string>('shopify.webhookPath'),
      }),
      inject: [ConfigService],
    }),
    ShopifyAuthModule,
    ShopifyWebhooksModule,
    RedisModule,
    QueueModule,
    ContentfulModule,
  ],
  controllers: [ShopifyAuthController],
  providers: [
    ShopifyService,
    ShopifyAuthService,
    ShopifyWebhookHandler,
    CustomShopifyGraphQLService, // Add custom Shopify GraphQL service
    ShopifyWebhooksService,
    ShopifyProductService,
  ],
  exports: [
    ShopifyService,
    ShopifyProductService, // Export Shopify product service for use in other modules
  ],
})
export class ShopifyModule {}
