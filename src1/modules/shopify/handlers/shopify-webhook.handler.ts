import { Injectable } from '@nestjs/common';
import { ShopifyWebhooks } from '@nestjs-shopify/webhooks';

@Injectable()
export class ShopifyWebhookHandler {
  constructor(private readonly shopifyWebhooks: ShopifyWebhooks) {}

  // Implement methods using shopifyWebhooks
  // ...
}