import type { TestingModule } from '@nestjs/testing'

import type { ShopifyGraphQLService } from '../graphql/shopify-graphql.service'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import CircuitBreaker from 'opossum'
import { ProductNotFoundError } from '../../common/errors/product-not-found.error'
import { ShopifyAPIError } from '../../common/errors/shopify-api.error'
import { RedisService } from '../../redis/redis.service'
import { ShopifyService } from './shopify.service'

jest.mock('opossum')

describe('shopifyService', () => {
  let service: ShopifyService
  let ShopifyGraphQLService: jest.Mocked<ShopifyGraphQLService>
  let redisService: jest.Mocked<RedisService>
  let logger: jest.Mocked<Logger>
  let mockBreaker: jest.MockedInstance<any>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: ShopifyGraphQLService,
          useFactory: () => ({
            getProductById: jest.fn(),
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
            getCollectionById: jest.fn(),
            createCollection: jest.fn(),
          }),
        },
        {
          provide: ConfigService,
          useFactory: () => ({}),
        },
        {
          provide: RedisService,
          useFactory: () => ({
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          }),
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
      ],
    }).compile()

    service = module.get<ShopifyService>(ShopifyService)
    ShopifyGraphQLService = module.get<ShopifyGraphQLService>(ShopifyGraphQLService)
    redisService = module.get<RedisService>(RedisService)
    logger = module.get<Logger>(Logger)

    // Mock Circuit Breaker behavior
    mockBreaker = CircuitBreaker.mock.instances[0]
    mockBreaker.fire = jest.fn()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('invalidateProductCache', () => {
    it('should invalidate cache for a product', async () => {
      const productId = '123'
      await service.invalidateProductCache(productId)
      expect(redisService.del).toHaveBeenCalledWith(`product:${productId}`)
      expect(logger.debug).toHaveBeenCalledWith(`Cache invalidated for product ${productId}`)
    })

    it('should log error if cache invalidation fails', async () => {
      const productId = '123'
      const error = new Error('Redis error')
      redisService.del.mockRejectedValue(error)

      await service.invalidateProductCache(productId)

      expect(logger.error).toHaveBeenCalledWith(
        `Failed to invalidate cache for product ${productId}: ${error.message}`,
      )
    })
  })

  describe('getProductById', () => {
    const productId = '123'
    const cacheKey = `product:${productId}`
    const mockProduct = { id: productId, title: 'Test Product' }

    it('should return cached product if available', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(mockProduct))
      const result = await service.getProductById(productId)

      expect(result).toEqual(mockProduct)
      expect(redisService.get).toHaveBeenCalledWith(cacheKey)
      expect(ShopifyGraphQLService.getProductById).not.toHaveBeenCalled()
    })

    it('should fetch and cache product if not in cache', async () => {
      redisService.get.mockResolvedValue(null)
      mockBreaker.fire.mockResolvedValue(mockProduct)

      const result = await service.getProductById(productId)

      expect(result).toEqual(mockProduct)
      expect(redisService.get).toHaveBeenCalledWith(cacheKey)
      expect(mockBreaker.fire).toHaveBeenCalledWith(productId)
      expect(redisService.set).toHaveBeenCalledWith(cacheKey, JSON.stringify(mockProduct), 3600)
    })

    it('should throw ProductNotFoundError if product not found', async () => {
      redisService.get.mockResolvedValue(null)
      mockBreaker.fire.mockResolvedValue(null)

      await expect(service.getProductById(productId)).rejects.toThrow(ProductNotFoundError)
      expect(logger.error).toHaveBeenCalledWith(`Error fetching product ${productId}: Product not found`)
    })

    it('should throw ShopifyAPIError on API failure', async () => {
      redisService.get.mockResolvedValue(null)
      mockBreaker.fire.mockRejectedValue(new Error('API Error'))

      await expect(service.getProductById(productId)).rejects.toThrow(ShopifyAPIError)
      expect(logger.error).toHaveBeenCalledWith(`Error fetching product ${productId}: API Error`)
    })

    it('should open Circuit Breaker after repeated failures', async () => {
      redisService.get.mockResolvedValue(null)
      mockBreaker.fire.mockRejectedValue(new Error('API Error'))

      await expect(service.getProductById(productId)).rejects.toThrow(ShopifyAPIError)
      expect(logger.error).toHaveBeenCalledWith(`Error fetching product ${productId}: API Error`)

      mockBreaker.open = true
      await expect(service.getProductById(productId)).rejects.toThrow(ShopifyAPIError)

      expect(mockBreaker.fire).toHaveBeenCalledWith(productId)
      expect(logger.warn).toHaveBeenCalledWith('GraphQL circuit breaker opened!')
    })

    it('should retry after Circuit Breaker resets', async () => {
      redisService.get.mockResolvedValue(null)
      mockBreaker.fire.mockRejectedValueOnce(new Error('API Error'))

      mockBreaker.open = false
      mockBreaker.fire.mockResolvedValueOnce(mockProduct)

      const result = await service.getProductById(productId)

      expect(result).toEqual(mockProduct)
      expect(mockBreaker.fire).toHaveBeenCalledWith(productId)
      expect(logger.log).toHaveBeenCalledWith('GraphQL circuit breaker closed.')
    })
  })

  // ... (other test cases for createProduct, updateProduct, getCollectionById remain the same)
})
