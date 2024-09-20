import type { Cache } from '@nestjs/cache-manager'
import type { TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Test } from '@nestjs/testing'

import { ProductNotFoundError } from '../../shared/errors/product-not-found.error'
import { ShopifyService } from '../shopify/services/shopify.service'
import { ShopifyProductService } from './product.service'

describe('shopifyProductService', () => {
  let service: ShopifyProductService
  let shopifyService: ShopifyService
  let cacheManager: Cache

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyProductService,
        {
          provide: ShopifyService,
          useValue: {
            getProductsByIds: jest.fn(),
            getProduct: jest.fn(),
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
            deleteProduct: jest.fn(),
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
    cacheManager = module.get<Cache>(CACHE_MANAGER)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getProductsByIds', () => {
    it('should return products from cache if available', async () => {
      const productIds = ['1', '2']
      const cachedProducts = [{ id: '1' }, { id: '2' }]
      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedProducts)

      const result = await service.getProductsByIds(productIds)

      expect(result).toEqual(cachedProducts)
      expect(cacheManager.get).toHaveBeenCalledWith('products:1,2')
      expect(shopifyService.getProductsByIds).not.toHaveBeenCalled()
    })

    it('should fetch products from Shopify if not in cache', async () => {
      const productIds = ['1', '2']
      const shopifyProducts = [{ id: '1' }, { id: '2' }]
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null)
      jest.spyOn(shopifyService, 'getProductsByIds').mockResolvedValue(shopifyProducts)

      const result = await service.getProductsByIds(productIds)

      expect(result).toEqual(shopifyProducts)
      expect(cacheManager.get).toHaveBeenCalledWith('products:1,2')
      expect(shopifyService.getProductsByIds).toHaveBeenCalledWith(productIds)
      expect(cacheManager.set).toHaveBeenCalledWith('products:1,2', shopifyProducts, 3600)
    })
  })

  describe('getProduct', () => {
    it('should return product from cache if available', async () => {
      const productId = '1'
      const cachedProduct = { id: '1' }
      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedProduct)

      const result = await service.getProduct(productId)

      expect(result).toEqual(cachedProduct)
      expect(cacheManager.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(shopifyService.getProduct).not.toHaveBeenCalled()
    })

    it('should fetch product from Shopify if not in cache', async () => {
      const productId = '1'
      const shopifyProduct = { id: '1' }
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null)
      jest.spyOn(shopifyService, 'getProduct').mockResolvedValue(shopifyProduct)

      const result = await service.getProduct(productId)

      expect(result).toEqual(shopifyProduct)
      expect(cacheManager.get).toHaveBeenCalledWith(`product:${productId}`)
      expect(shopifyService.getProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.set).toHaveBeenCalledWith(`product:${productId}`, shopifyProduct, 3600)
    })

    it('should throw ProductNotFoundError if product is not found', async () => {
      const productId = '1'
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null)
      jest.spyOn(shopifyService, 'getProduct').mockResolvedValue(null)

      await expect(service.getProduct(productId)).rejects.toThrow(ProductNotFoundError)
    })
  })

  describe('createProduct', () => {
    it('should create a product and update cache', async () => {
      const productData = { title: 'New Product' }
      const createdProduct = { id: '1', ...productData }
      jest.spyOn(shopifyService, 'createProduct').mockResolvedValue(createdProduct)

      const result = await service.createProduct(productData)

      expect(result).toEqual(createdProduct)
      expect(shopifyService.createProduct).toHaveBeenCalledWith(productData)
      expect(cacheManager.set).toHaveBeenCalledWith(`product:${createdProduct.id}`, createdProduct, 3600)
    })
  })

  describe('updateProduct', () => {
    it('should update a product and update cache', async () => {
      const productId = '1'
      const updateData = { title: 'Updated Product' }
      const updatedProduct = { id: productId, ...updateData }
      jest.spyOn(shopifyService, 'updateProduct').mockResolvedValue(updatedProduct)

      const result = await service.updateProduct(productId, updateData)

      expect(result).toEqual(updatedProduct)
      expect(shopifyService.updateProduct).toHaveBeenCalledWith(productId, updateData)
      expect(cacheManager.set).toHaveBeenCalledWith(`product:${productId}`, updatedProduct, 3600)
    })
  })

  describe('deleteProduct', () => {
    it('should delete a product and remove from cache', async () => {
      const productId = '1'
      jest.spyOn(shopifyService, 'deleteProduct').mockResolvedValue(undefined)

      await service.deleteProduct(productId)

      expect(shopifyService.deleteProduct).toHaveBeenCalledWith(productId)
      expect(cacheManager.del).toHaveBeenCalledWith(`product:${productId}`)
    })
  })
})
