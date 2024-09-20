// src/modules/shopify/services/shopify-product.service.spec.ts

import type { TestingModule } from '@nestjs/testing'
import type { Cache } from 'cache-manager'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { ProductNotFoundError } from '@shared/errors/product-not-found.error'
import { ShopifyAPIError } from '@shared/errors/shopify-api.error'
import { CACHE_MANAGER } from 'cache-manager'
import DataLoader from 'dataloader'
import CircuitBreaker from 'opossum'

import { ShopifyService } from './shopify.service'
import { ShopifyProductService } from './shopify-product.service'

jest.mock('dataloader')
jest.mock('opossum')

describe('shopifyProductService', () => {
  let service: ShopifyProductService
  let shopifyService: ShopifyService
  let configService: ConfigService
  let cacheManager: Cache

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyProductService,
        {
          provide: ShopifyService,
          useValue: {
            getProduct: jest.fn(),
            getProductsByIds: jest.fn(),
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
            deleteProduct: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                PRODUCT_CACHE_TTL: 3600,
              }
              return config[key] || defaultValue
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<ShopifyProductService>(ShopifyProductService)
    shopifyService = module.get<ShopifyService>(ShopifyService)
    configService = module.get<ConfigService>(ConfigService)
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    // Mock DataLoader
    (DataLoader as jest.Mock).mockImplementation(() => ({
      loadMany: jest.fn(),
    }));

    // Mock CircuitBreaker
    (CircuitBreaker as jest.Mock).mockImplementation(() => ({
      fire: jest.fn(),
      on: jest.fn(),
    }))
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getProductById', () => {
    const productId = 'prod123'
    const mockProduct = { id: productId, name: 'Test Product' }

    it('should return cached product if available', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValueOnce(mockProduct)
      const result = await service.getProductById(productId)
      expect(cacheManager.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(shopifyService.getProduct).not.toHaveBeenCalled()
      expect(result).toEqual(mockProduct)
    })

    it('should fetch product from Shopify and cache it if not in cache', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValueOnce(null);
      (shopifyService.getProduct as jest.Mock).mockResolvedValueOnce(mockProduct);
      (cacheManager.set as jest.Mock).mockResolvedValueOnce(undefined)

      // Mock CircuitBreaker.fire to call the internal method
      const breakerMock = (service.productBreaker.fire as jest.Mock).mockImplementation(async (id: string) => {
        return service.getProductByIdInternal(id)
      })

      const result = await service.getProductById(productId)

      expect(cacheManager.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(shopifyService.getProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.set).toHaveBeenCalledWith(`product:${productId}`, mockProduct, { ttl: 3600 })
      expect(result).toEqual(mockProduct)
    })

    it('should throw ProductNotFoundError if product does not exist', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValueOnce(null);
      (shopifyService.getProduct as jest.Mock).mockResolvedValueOnce(null)

      // Mock CircuitBreaker.fire to call the internal method
      const breakerMock = (service.productBreaker.fire as jest.Mock).mockImplementation(async (id: string) => {
        return service.getProductByIdInternal(id)
      })

      await expect(service.getProductById(productId)).rejects.toThrow(ProductNotFoundError)
      expect(cacheManager.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(shopifyService.getProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.set).not.toHaveBeenCalled()
    })

    it('should throw ShopifyAPIError on Shopify service failure', async () => {
      const errorMessage = 'Shopify API error';
      (cacheManager.get as jest.Mock).mockResolvedValueOnce(null);
      (shopifyService.getProduct as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

      // Mock CircuitBreaker.fire to call the internal method
      const breakerMock = (service.productBreaker.fire as jest.Mock).mockImplementation(async (id: string) => {
        return service.getProductByIdInternal(id)
      })

      await expect(service.getProductById(productId)).rejects.toThrow(ShopifyAPIError)
      expect(cacheManager.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(shopifyService.getProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.set).not.toHaveBeenCalled()
    })
  })

  describe('createProduct', () => {
    const createInput: CreateProductInput = { name: 'New Product' }
    const createdProduct: Product = { id: 'prod456', name: 'New Product' }

    it('should create a new product and cache it', async () => {
      (shopifyService.createProduct as jest.Mock).mockResolvedValueOnce(createdProduct);
      (cacheManager.set as jest.Mock).mockResolvedValueOnce(undefined)

      const result = await service.createProduct(createInput)

      expect(shopifyService.createProduct).toHaveBeenCalledWith(createInput)
      expect(cacheManager.set).toHaveBeenCalledWith(`product:${createdProduct.id}`, createdProduct, { ttl: 3600 })
      expect(result).toEqual(createdProduct)
    })

    it('should throw ShopifyAPIError on creation failure', async () => {
      const errorMessage = 'Failed to create product';
      (shopifyService.createProduct as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

      await expect(service.createProduct(createInput)).rejects.toThrow(ShopifyAPIError)
      expect(shopifyService.createProduct).toHaveBeenCalledWith(createInput)
      expect(cacheManager.set).not.toHaveBeenCalled()
    })
  })

  describe('updateProduct', () => {
    const updateInput: UpdateProductInput = { id: 'prod123', name: 'Updated Product' }
    const updatedProduct: Product = { id: 'prod123', name: 'Updated Product' }

    it('should update a product and cache it', async () => {
      (shopifyService.updateProduct as jest.Mock).mockResolvedValueOnce(updatedProduct);
      (cacheManager.set as jest.Mock).mockResolvedValueOnce(undefined)

      const result = await service.updateProduct(updateInput)

      expect(shopifyService.updateProduct).toHaveBeenCalledWith(updateInput)
      expect(cacheManager.set).toHaveBeenCalledWith(`product:${updatedProduct.id}`, updatedProduct, { ttl: 3600 })
      expect(result).toEqual(updatedProduct)
    })

    it('should throw ShopifyAPIError on update failure', async () => {
      const errorMessage = 'Failed to update product';
      (shopifyService.updateProduct as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

      await expect(service.updateProduct(updateInput)).rejects.toThrow(ShopifyAPIError)
      expect(shopifyService.updateProduct).toHaveBeenCalledWith(updateInput)
      expect(cacheManager.set).not.toHaveBeenCalled()
    })
  })

  describe('deleteProduct', () => {
    const productId = 'prod123'

    it('should delete a product and invalidate cache', async () => {
      (shopifyService.deleteProduct as jest.Mock).mockResolvedValueOnce(undefined);
      (cacheManager.del as jest.Mock).mockResolvedValueOnce(undefined)

      await service.deleteProduct(productId)

      expect(shopifyService.deleteProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.del).toHaveBeenCalledWith(`product:${productId}`)
    })

    it('should throw ShopifyAPIError on deletion failure', async () => {
      const errorMessage = 'Failed to delete product';
      (shopifyService.deleteProduct as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

      await expect(service.deleteProduct(productId)).rejects.toThrow(ShopifyAPIError)
      expect(shopifyService.deleteProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.del).not.toHaveBeenCalled()
    })
  })

  describe('compareProducts', () => {
    const productIds = ['prod1', 'prod2', 'prod3']
    const products: Product[] = [
      { id: 'prod1', name: 'Product 1' },
      { id: 'prod2', name: 'Product 2' },
      { id: 'prod3', name: 'Product 3' },
    ]

    it('should return all valid products', async () => {
      (service.productLoader.loadMany as jest.Mock).mockResolvedValueOnce(products)

      const result = await service.compareProducts(productIds)

      expect(service.productLoader.loadMany).toHaveBeenCalledWith(productIds)
      expect(result).toEqual(products)
    })

    it('should filter out null products and log a warning', async () => {
      const partialProducts = [
        { id: 'prod1', name: 'Product 1' },
        null,
        { id: 'prod3', name: 'Product 3' },
      ];
      (service.productLoader.loadMany as jest.Mock).mockResolvedValueOnce(partialProducts)

      const result = await service.compareProducts(productIds)

      expect(service.productLoader.loadMany).toHaveBeenCalledWith(productIds)
      expect(result).toEqual([
        { id: 'prod1', name: 'Product 1' },
        { id: 'prod3', name: 'Product 3' },
      ])
      // Optionally, verify that a warning was logged
    })

    it('should throw ShopifyAPIError on comparison failure', async () => {
      const errorMessage = 'Failed to compare products';
      (service.productLoader.loadMany as jest.Mock).mockRejectedValueOnce(new Error(errorMessage))

      await expect(service.compareProducts(productIds)).rejects.toThrow(ShopifyAPIError)
      expect(service.productLoader.loadMany).toHaveBeenCalledWith(productIds)
    })
  })
})
