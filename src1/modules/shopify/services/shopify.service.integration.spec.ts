// src/modules/shopify/services/shopify.service.integration.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ShopifyService } from './shopify.service';
import { CustomShopifyGraphQLService } from '../graphql/custom-shopify-graphql.service'; // Custom GraphQL service
import { RedisService } from '../../redis/redis.service';
import { ContentfulService } from '../../contentful/contentful.service';
import { QueueService } from '../../queue/queue.service';
import { ConfigService } from '@nestjs/config';
import { ProductNotFoundError } from '../../common/errors/product-not-found.error';
import { ShopifyAPIError } from '../../common/errors/shopify-api.error';

describe('ShopifyService Integration', () => {
  let service: ShopifyService;
  let customShopifyGraphQLService: CustomShopifyGraphQLService;
  let redisService: RedisService;
  let contentfulService: ContentfulService;
  let queueService: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: CustomShopifyGraphQLService, // Provide the custom GraphQL service
          useValue: {
            getProductById: jest.fn(),
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
            deleteProduct: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addTask: jest.fn(),
          },
        },
        ConfigService,
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
    customShopifyGraphQLService = module.get<CustomShopifyGraphQLService>(
      CustomShopifyGraphQLService,
    );
    redisService = module.get<RedisService>(RedisService);
    contentfulService = module.get<ContentfulService>(ContentfulService);
    queueService = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProductById', () => {
    const productId = 'prod_123';
    const cacheKey = `product:${productId}`;
    const mockProduct = { id: productId, title: 'Test Product' };

    it('should return cached product if available', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(mockProduct));

      const result = await service.getProductById(productId);
      expect(result).toEqual(mockProduct);
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(customShopifyGraphQLService.getProductById).not.toHaveBeenCalled();
    });

    it('should fetch product from Shopify if not in cache and cache it', async () => {
      redisService.get.mockResolvedValue(null);
      customShopifyGraphQLService.getProductById.mockResolvedValue(mockProduct);

      const result = await service.getProductById(productId);

      expect(result).toEqual(mockProduct);
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(customShopifyGraphQLService.getProductById).toHaveBeenCalledWith(
        productId,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(mockProduct),
        3600,
      );
    });

    it('should throw ProductNotFoundError if product not found in Shopify', async () => {
      redisService.get.mockResolvedValue(null);
      customShopifyGraphQLService.getProductById.mockResolvedValue(null);

      await expect(service.getProductById(productId)).rejects.toThrow(
        ProductNotFoundError,
      );
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      redisService.get.mockResolvedValue(null);
      customShopifyGraphQLService.getProductById.mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(service.getProductById(productId)).rejects.toThrow(
        ShopifyAPIError,
      );
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('createProduct', () => {
    const newProduct = { title: 'New Product' };

    it('should create a product and sync with Contentful', async () => {
      const mockCreatedProduct = { id: 'new_123', title: newProduct.title };
      customShopifyGraphQLService.createProduct.mockResolvedValue(
        mockCreatedProduct,
      );
      contentfulService.createProduct.mockResolvedValue(null);

      const result = await service.createProduct(newProduct);

      expect(result).toEqual(mockCreatedProduct);
      expect(customShopifyGraphQLService.createProduct).toHaveBeenCalledWith(
        newProduct,
      );
      expect(contentfulService.createProduct).toHaveBeenCalledWith({
        title: newProduct.title,
        description: undefined,
      });
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      customShopifyGraphQLService.createProduct.mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(service.createProduct(newProduct)).rejects.toThrow(
        ShopifyAPIError,
      );
    });
  });

  describe('updateProduct', () => {
    const productId = 'prod_456';
    const updatedProduct = { title: 'Updated Product' };

    it('should update product in Shopify and sync with Contentful', async () => {
      const mockUpdatedProduct = {
        id: productId,
        title: updatedProduct.title,
      };
      customShopifyGraphQLService.updateProduct.mockResolvedValue(
        mockUpdatedProduct,
      );
      contentfulService.updateProduct.mockResolvedValue(null);

      const result = await service.updateProduct(productId, updatedProduct);

      expect(result).toEqual(mockUpdatedProduct);
      expect(customShopifyGraphQLService.updateProduct).toHaveBeenCalledWith(
        productId,
        updatedProduct,
      );
      expect(contentfulService.updateProduct).toHaveBeenCalledWith({
        title: updatedProduct.title,
        description: undefined,
      });
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      customShopifyGraphQLService.updateProduct.mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(
        service.updateProduct(productId, updatedProduct),
      ).rejects.toThrow(ShopifyAPIError);
    });
  });

  describe('deleteProduct', () => {
    const productId = 'prod_789';

    it('should delete product in Shopify and remove from Contentful', async () => {
      customShopifyGraphQLService.deleteProduct.mockResolvedValue(true);
      contentfulService.deleteProduct.mockResolvedValue(null);

      const result = await service.deleteProduct(productId);

      expect(result).toBe(true);
      expect(customShopifyGraphQLService.deleteProduct).toHaveBeenCalledWith(
        productId,
      );
      expect(contentfulService.deleteProduct).toHaveBeenCalledWith(productId);
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      customShopifyGraphQLService.deleteProduct.mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(service.deleteProduct(productId)).rejects.toThrow(
        ShopifyAPIError,
      );
    });
  });
});
