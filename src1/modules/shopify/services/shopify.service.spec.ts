import { Test, TestingModule } from '@nestjs/testing';
import { ShopifyService } from './shopify.service';
import { CustomShopifyGraphQLService } from '../graphql/custom-shopify-graphql.service';  // Use the custom GraphQL service
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { ProductNotFoundError } from '../../common/errors/product-not-found.error';
import { ShopifyAPIError } from '../../common/errors/shopify-api.error';

describe('ShopifyService', () => {
  let service: ShopifyService;
  let customShopifyGraphQLService: jest.Mocked<CustomShopifyGraphQLService>;  // Updated to use the mocked custom service
  let configService: jest.Mocked<ConfigService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: CustomShopifyGraphQLService,  // Use custom GraphQL service in the test setup
          useFactory: () => ({
            getProductById: jest.fn(),
            mutate: jest.fn(),
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
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
    customShopifyGraphQLService = module.get(CustomShopifyGraphQLService);  // Get custom GraphQL service
    configService = module.get(ConfigService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProductById', () => {
    const productId = '123';
    const cacheKey = `product:${productId}`;
    const mockProduct = { id: productId, title: 'Test Product' };

    it('should return cached product if available', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(mockProduct));

      const result = await service.getProductById(productId);
      expect(result).toEqual(mockProduct);
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(customShopifyGraphQLService.getProductById).not.toHaveBeenCalled();
    });

    it('should fetch and cache product if not in cache', async () => {
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

    it('should create a product in Shopify', async () => {
      const mockCreatedProduct = { id: 'new_123', title: newProduct.title };
      customShopifyGraphQLService.mutate.mockResolvedValue({
        productCreate: { product: mockCreatedProduct },
      });

      const result = await service.createProduct(newProduct);

      expect(result).toEqual(mockCreatedProduct);
      expect(customShopifyGraphQLService.mutate).toHaveBeenCalledWith(
        expect.any(String),
        { input: newProduct },
      );
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      customShopifyGraphQLService.mutate.mockRejectedValue(
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

    it('should update product in Shopify', async () => {
      const mockUpdatedProduct = {
        id: productId,
        title: updatedProduct.title,
      };
      customShopifyGraphQLService.mutate.mockResolvedValue({
        productUpdate: { product: mockUpdatedProduct },
      });

      const result = await service.updateProduct(productId, updatedProduct);

      expect(result).toEqual(mockUpdatedProduct);
      expect(customShopifyGraphQLService.mutate).toHaveBeenCalledWith(
        expect.any(String),
        { id: productId, input: updatedProduct },
      );
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      customShopifyGraphQLService.mutate.mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(
        service.updateProduct(productId, updatedProduct),
      ).rejects.toThrow(ShopifyAPIError);
    });
  });

  describe('deleteProduct', () => {
    const productId = 'prod_789';

    it('should delete product in Shopify', async () => {
      customShopifyGraphQLService.mutate.mockResolvedValue({
        productDelete: { deletedProductId: productId },
      });

      const result = await service.deleteProduct(productId);

      expect(result).toBe(true);
      expect(customShopifyGraphQLService.mutate).toHaveBeenCalledWith(
        expect.any(String),
        { id: productId },
      );
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      customShopifyGraphQLService.mutate.mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(service.deleteProduct(productId)).rejects.toThrow(
        ShopifyAPIError,
      );
    });
  });
});
