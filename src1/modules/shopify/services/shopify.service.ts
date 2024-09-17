import { Injectable, Logger } from '@nestjs/common';
import { CustomShopifyGraphQLService } from '../graphql/custom-shopify-graphql.service';
import { RedisService } from '../../redis/redis.service';
import { ProductNotFoundError } from '../../common/errors/product-not-found.error';
import { ShopifyAPIError } from '../../common/errors/shopify-api.error';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(
    private readonly customShopifyGraphQLService: CustomShopifyGraphQLService,
    private readonly redisService: RedisService,
  ) {}

  private async cacheProduct(product: any): Promise<void> {
    const cacheKey = `product:${product.id}`;
    await this.redisService.set(cacheKey, JSON.stringify(product), 3600);
  }

  async getProductById(productId: string): Promise<any> {
    const cacheKey = `product:${productId}`;
    
    // Check cache first
    const cachedProduct = await this.redisService.get(cacheKey);
    if (cachedProduct) {
      this.logger.debug(`Cache hit for product ${productId}`);
      return JSON.parse(cachedProduct);
    }

    // Fetch product from Shopify if not in cache
    try {
      const product = await this.customShopifyGraphQLService.getProductById(productId);
      if (!product) {
        throw new ProductNotFoundError(productId);
      }

      // Cache product
      await this.cacheProduct(product);

      return product;
    } catch (error) {
      this.logger.error(`Error fetching product ${productId} from Shopify: ${error.message}`);
      throw new ShopifyAPIError(`Failed to fetch product ${productId} from Shopify`);
    }
  }

  async createProduct(input: any): Promise<any> {
    try {
      const createdProduct = await this.customShopifyGraphQLService.createProduct(input);

      // Cache the newly created product
      await this.cacheProduct(createdProduct);

      this.logger.log(`Product created successfully: ${createdProduct.id}`);
      return createdProduct;
    } catch (error) {
      this.logger.error(`Error creating product in Shopify: ${error.message}`);
      throw new ShopifyAPIError('Failed to create product in Shopify');
    }
  }

  async updateProduct(productId: string, input: any): Promise<any> {
    try {
      const updatedProduct = await this.customShopifyGraphQLService.updateProduct(productId, input);

      // Cache the updated product
      await this.cacheProduct(updatedProduct);

      this.logger.log(`Product updated successfully: ${updatedProduct.id}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error(`Error updating product ${productId} in Shopify: ${error.message}`);
      throw new ShopifyAPIError(`Failed to update product ${productId} in Shopify`);
    }
  }

  async deleteProduct(productId: string): Promise<boolean> {
    try {
      await this.customShopifyGraphQLService.deleteProduct(productId);

      // Remove product from cache
      const cacheKey = `product:${productId}`;
      await this.redisService.del(cacheKey);

      this.logger.log(`Product deleted successfully: ${productId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting product ${productId} from Shopify: ${error.message}`);
      throw new ShopifyAPIError(`Failed to delete product ${productId} from Shopify`);
    }
  }

  async invalidateProductCache(productId: string): Promise<void> {
    try {
      const cacheKey = `product:${productId}`;
      await this.redisService.del(cacheKey);
      this.logger.debug(`Product cache invalidated for product ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for product ${productId}: ${error.message}`);
    }
  }
}
