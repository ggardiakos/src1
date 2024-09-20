import type { TestingModule } from '@nestjs/testing'

import type { Product } from '../graphql/schemas'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { ContentfulService } from '../../contentful/contentful.service'
import { QueueService } from '../../queue/queue.service'
import { RedisService } from '../../redis/redis.service'
import { WebhookProcessingError } from '../errors/webhook-processing.error'
import { ShopifyService } from './shopify.service'
import { ShopifyWebhooksService } from './shopify-webhooks.service'

jest.mock('@sentry/node')

describe('shopifyWebhooksService', () => {
  let service: ShopifyWebhooksService
  let shopifyService: ShopifyService
  let redisService: RedisService
  let queueService: QueueService
  let contentfulService: ContentfulService

  const mockProduct: Product = {
    id: '123',
    title: 'Test Product',
    description: 'Test Description',
    // Add other necessary fields
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyWebhooksService,
        {
          provide: ShopifyService,
          useValue: {
            getProductById: jest.fn().mockResolvedValue(mockProduct),
          },
        },
        {
          provide: RedisService,
          useValue: {
            del: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addTask: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ContentfulService,
          useValue: {
            createProduct: jest.fn().mockResolvedValue(true),
            updateProduct: jest.fn().mockResolvedValue(true),
            deleteProduct: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('admin@example.com'),
          },
        },
      ],
    }).compile()

    service = module.get<ShopifyWebhooksService>(ShopifyWebhooksService)
    shopifyService = module.get<ShopifyService>(ShopifyService)
    redisService = module.get<RedisService>(RedisService)
    queueService = module.get<QueueService>(QueueService)
    contentfulService = module.get<ContentfulService>(ContentfulService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('handleProductCreate', () => {
    it('should handle product creation successfully', async () => {
      const payload = { id: '123', title: 'Test Product' }
      await service.handleProductCreate(payload, 'test-shop')

      expect(redisService.del).toHaveBeenCalledWith('shopify_product:123')
      expect(shopifyService.getProductById).toHaveBeenCalledWith('123')
      expect(contentfulService.createProduct).toHaveBeenCalledWith(expect.any(Object))
      expect(queueService.addTask).toHaveBeenCalledWith({
        type: 'send-email',
        payload: {
          to: 'admin@example.com',
          subject: 'New Product Created',
          body: expect.any(String),
        },
      })
    })

    it('should throw error if validation fails', async () => {
      jest.spyOn(service, 'invalidateProductCache').mockImplementation(() => {
        throw new WebhookProcessingError('Invalid webhook payload')
      })

      await expect(service.handleProductCreate({}, 'test-shop')).rejects.toThrow(WebhookProcessingError)
    })
  })

  describe('handleProductUpdate', () => {
    it('should handle product update successfully', async () => {
      const payload = { id: '123', title: 'Updated Product' }
      await service.handleProductUpdate(payload, 'test-shop')

      expect(redisService.del).toHaveBeenCalledWith('shopify_product:123')
      expect(shopifyService.getProductById).toHaveBeenCalledWith('123')
      expect(contentfulService.updateProduct).toHaveBeenCalledWith(expect.any(Object))
    })
  })

  describe('handleProductDelete', () => {
    it('should handle product deletion successfully', async () => {
      const payload = { id: '123' }
      await service.handleProductDelete(payload, 'test-shop')

      expect(redisService.del).toHaveBeenCalledWith('shopify_product:123')
      expect(contentfulService.deleteProduct).toHaveBeenCalledWith('123')
    })
  })

  describe('error handling', () => {
    it('should log and throw WebhookProcessingError on failure', async () => {
      const mockError = new Error('Some error')
      jest.spyOn(service, 'fetchProductWithRetry').mockRejectedValue(mockError)

      await expect(service.handleProductCreate({ id: '123' }, 'test-shop')).rejects.toThrow(WebhookProcessingError)
    })
  })
})
