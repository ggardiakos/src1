import type { TestingModule } from '@nestjs/testing'

import type { ShopifyGraphQLService } from '../graphql/shopify-graphql.service'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { ProductNotFoundError } from '../../common/errors/product-not-found.error'
import { ShopifyAPIError } from '../../common/errors/shopify-api.error'
import { ContentfulService } from '../../contentful/contentful.service'
import { QueueService } from '../../queue/queue.service'
import { RedisService } from '../../redis/redis.service'
import { ShopifyService } from './shopify.service'

describe('shopifyService Integration', () => {
  let service: ShopifyService
  let ShopifyGraphQLService: ShopifyGraphQLService
  let redisService: RedisService
  let contentfulService: ContentfulService
  let queueService: QueueService
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: ShopifyGraphQLService,
          useValue: {
            getProductById: jest.fn(),
            createProduct: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: ContentfulService,
          useValue: {
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addTask: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
        ConfigService,
      ],
    }).compile()

    service = module.get<ShopifyService>(ShopifyService)
    ShopifyGraphQLService = module.get<ShopifyGraphQLService>(ShopifyGraphQLService)
    redisService = module.get<RedisService>(RedisService)
    contentfulService = module.get<ContentfulService>(ContentfulService)
    queueService = module.get<QueueService>(QueueService)
    logger = module.get<Logger>(Logger)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getProductById', () => {
    it('should return product from cache if available', async () => {
      const productId = 'prod_123'
      const cachedProduct = { id: productId, title: 'Cached Product' };
      (redisService.get as jest.Mock).mockResolvedValue(
        JSON.stringify(cachedProduct),
      )

      const result = await service.getProductById(productId)
      expect(redisService.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(result).toEqual(cachedProduct)
      expect(ShopifyGraphQLService.getProductById).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(`Cache hit for product ${productId}`)
    })

    it('should fetch product from Shopify if not in cache and cache it', async () => {
      const productId = 'prod_456'
      const fetchedProduct = { id: productId, title: 'Fetched Product' };
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (ShopifyGraphQLService.getProductById as jest.Mock).mockResolvedValue(fetchedProduct);
      (redisService.set as jest.Mock).mockResolvedValue(undefined)

      const result = await service.getProductById(productId)
      expect(redisService.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(ShopifyGraphQLService.getProductById).toHaveBeenCalledWith(productId)
      expect(redisService.set).toHaveBeenCalledWith(`product:${productId}`, JSON.stringify(fetchedProduct), 3600)
      expect(result).toEqual(fetchedProduct)
      expect(logger.debug).toHaveBeenCalledWith(`Fetched and cached product ${productId}`)
    })

    it('should throw ProductNotFoundError if product not found in Shopify', async () => {
      const productId = 'prod_nonexistent';
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (ShopifyGraphQLService.getProductById as jest.Mock).mockResolvedValue(null)

      await expect(service.getProductById(productId)).rejects.toThrow(ProductNotFoundError)
      expect(redisService.set).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalledWith(`Error fetching product ${productId}: Product not found`)
    })

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      const productId = 'prod_error';
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (ShopifyGraphQLService.getProductById as jest.Mock).mockRejectedValue(new Error('Shopify API failure'))

      await expect(service.getProductById(productId)).rejects.toThrow(ShopifyAPIError)
      expect(redisService.set).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalledWith(`Error fetching product ${productId}: Shopify API failure`)
    })
  })

  describe('invalidateProductCache', () => {
    it('should invalidate the product cache', async () => {
      const productId = 'prod_123'
      await service.invalidateProductCache(productId)
      expect(redisService.del).toHaveBeenCalledWith(`product:${productId}`)
      expect(logger.debug).toHaveBeenCalledWith(`Cache invalidated for product ${productId}`)
    })

    it('should log an error if cache invalidation fails', async () => {
      const productId = 'prod_123'
      const error = new Error('Redis error');
      (redisService.del as jest.Mock).mockRejectedValue(error)

      await service.invalidateProductCache(productId)
      expect(logger.error).toHaveBeenCalledWith(`Failed to invalidate cache for product ${productId}: Redis error`)
    })
  })

  describe('createProduct', () => {
    it('should create product and send to Contentful', async () => {
      const mockInput = { title: 'New Product' }
      const mockProduct = { id: 'prod_456', title: 'New Product' };
      (ShopifyGraphQLService.createProduct as jest.Mock).mockResolvedValue(mockProduct)

      const result = await service.createProduct(mockInput)
      expect(result).toEqual(mockProduct)
      expect(ShopifyGraphQLService.createProduct).toHaveBeenCalledWith(mockInput)
      expect(contentfulService.createProduct).toHaveBeenCalledWith(mockProduct)
      expect(logger.debug).toHaveBeenCalledWith(`Created product with ID ${mockProduct.id}`)
    })

    it('should throw ShopifyAPIError on product creation failure', async () => {
      const mockInput = { title: 'New Product' };
      (ShopifyGraphQLService.createProduct as jest.Mock).mockRejectedValue(new Error('API Error'))

      await expect(service.createProduct(mockInput)).rejects.toThrow(ShopifyAPIError)
      expect(logger.error).toHaveBeenCalledWith('Error creating product: API Error')
    })
  })
})
