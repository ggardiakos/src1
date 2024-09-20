import type { Logger } from '@nestjs/common'
import type {
  Session,
  Shopify,
} from '@shopify/shopify-api'
import { Test } from '@nestjs/testing'
import { SHOPIFY_API_CONTEXT } from '@nestjs-shopify/core'
import {
  DeliveryMethod,
  WebhookOperation,
} from '@shopify/shopify-api'

import { ShopifyWebhooksModule } from '../../src/webhooks.module'
import { ShopifyWebhooksService } from '../../src/webhooks.service'
import { MockShopifyCoreModule } from '../helpers/mock-shopify-core-module'
import '@shopify/shopify-api/adapters/node'

describe('shopifyWebhooksService', () => {
  let service: ShopifyWebhooksService
  let shopifyApi: Shopify
  let shopifyWebhooksRegisterSpy: jest.SpyInstance

  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        MockShopifyCoreModule,
        ShopifyWebhooksModule.forRoot({ path: 'testing' }),
      ],
    }).compile()

    service = module.get(ShopifyWebhooksService)
    shopifyApi = module.get(SHOPIFY_API_CONTEXT);

    (service as unknown as { logger: Logger }).logger = mockLogger

    shopifyWebhooksRegisterSpy = jest
      .spyOn(shopifyApi.webhooks, 'register')
      .mockResolvedValue({
        'products/create': [
          {
            deliveryMethod: DeliveryMethod.Http,
            result: 'Forced error in tests',
            success: false,
            operation: WebhookOperation.Create,
          },
        ],
        'products/update': [
          {
            deliveryMethod: DeliveryMethod.EventBridge,
            result: { data: { webhookSubscriptionCreate: {} } },
            success: true,
            operation: WebhookOperation.Update,
          },
        ],
      })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('.registerWebhooks', () => {
    const session = {
      accessToken: 'fake-access-token',
      shop: 'nestjs-shopify.myshopify.com',
    } as Session

    it('should call `shopifyApi.webhooks.register` with provided session', async () => {
      await service.registerWebhooks(session)

      expect(shopifyWebhooksRegisterSpy).toHaveBeenCalledWith({ session })
    })

    it('should log failures', async () => {
      await service.registerWebhooks(session)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to register webhook products/create: "Forced error in tests"',
      )
    })

    it('should log successes', async () => {
      await service.registerWebhooks(session)

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Registered webhook products/update successfully.',
      )
    })
  })
})
