// src/modules/shopify/graphql/shopify-graphql.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';
import { tracer } from 'dd-trace'; // Ensure dd-trace is initialized
import { retry } from 'ts-retry-promise';
import * as Sentry from '@sentry/node';

@Injectable()
export class ShopifyGraphQLService {
  private readonly logger = new Logger(ShopifyGraphQLService.name);
  private client: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  /**
   * Initializes the Shopify GraphQL client with the configured API URL and access token.
   */
  private initializeClient() {
    const shopifyUrl =
      this.configService.get<string>('shopify.graphqlUrl') ||
      'https://your-shopify-store.myshopify.com/admin/api/2023-10/graphql.json';
    const accessToken = this.configService.get<string>('shopify.accessToken');

    this.client = new GraphQLClient(shopifyUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    });
  }

  /**
   * Updates the Shopify access token dynamically.
   * @param accessToken - The new access token
   */
  setAccessToken(accessToken: string) {
    this.client.setHeader('X-Shopify-Access-Token', accessToken);
    this.logger.debug('Shopify access token updated');
  }

  /**
   * Sends a GraphQL query to the Shopify API with retry logic and error handling.
   * @param query - The GraphQL query string
   * @param variables - The variables for the query
   * @returns The result of the query
   */
  async query<T>(query: string, variables: any = {}): Promise<T> {
    const span = tracer.startSpan('shopify.graphql.query');
    try {
      return await retry(() => this.client.request<T>(query, variables), {
        maxAttempts: 3,
        delay: 1000,
        factor: 2,
        onError: (error, attempt) => {
          this.logger.warn(
            `GraphQL query attempt ${attempt} failed: ${error.message}`,
          );
          Sentry.captureException(error);
        },
      });
    } catch (error) {
      this.logger.error(`GraphQL query failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      span.finish();
    }
  }

  /**
   * Sends a GraphQL mutation to the Shopify API with retry logic and error handling.
   * @param mutation - The GraphQL mutation string
   * @param variables - The variables for the mutation
   * @returns The result of the mutation
   */
  async mutate<T>(mutation: string, variables: any = {}): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  /**
   * Fetches a product by its ID using Shopify's GraphQL API.
   * @param id - The ID of the product
   * @returns The product data
   */
  async getProductById(id: string): Promise<any> {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          description
          images(first: 1) {
            edges {
              node {
                originalSrc
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
    `;
    const variables = { id };
    const data = await this.query<{ product: any }>(query, variables);
    return data.product;
  }

  /**
   * Fetches a list of products based on a query string using Shopify's GraphQL API.
   * @param queryString - The query string to search products
   * @returns A list of products matching the query
   */
  async getProducts(queryString: string): Promise<any[]> {
    const query = `
      query getProducts($query: String!) {
        products(first: 10, query: $query) {
          edges {
            node {
              id
              title
              handle
              description
              images(first: 1) {
                edges {
                  node {
                    originalSrc
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;
    const variables = { query: queryString };
    const data = await this.query<{ products: { edges: { node: any }[] } }>(
      query,
      variables,
    );
    return data.products.edges.map((edge) => edge.node);
  }

  /**
   * Creates a new product in Shopify using GraphQL.
   * @param product - The product input data
   * @returns The created product
   */
  async createProduct(product: any): Promise<any> {
    const mutation = `
      mutation createProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            description
            images(first: 1) {
              edges {
                node {
                  originalSrc
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }
      }
    `;
    const variables = { input: product };
    const data = await this.mutate<{ productCreate: { product: any } }>(
      mutation,
      variables,
    );
    return data.productCreate.product;
  }

  /**
   * Updates an existing product in Shopify using GraphQL.
   * @param id - The ID of the product to update
   * @param product - The product input data for the update
   * @returns The updated product
   */
  async updateProduct(id: string, product: any): Promise<any> {
    const mutation = `
      mutation updateProduct($id: ID!, $input: ProductInput!) {
        productUpdate(id: $id, input: $input) {
          product {
            id
            title
            handle
            description
            images(first: 1) {
              edges {
                node {
                  originalSrc
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }
      }
    `;
    const variables = { id, input: product };
    const data = await this.mutate<{ productUpdate: { product: any } }>(
      mutation,
      variables,
    );
    return data.productUpdate.product;
  }

  /**
   * Deletes a product by its ID using Shopify's GraphQL API.
   * @param id - The ID of the product to delete
   * @returns A boolean indicating whether the product was successfully deleted
   */
  async deleteProduct(id: string): Promise<boolean> {
    const mutation = `
      mutation deleteProduct($id: ID!) {
        productDelete(input: { id: $id }) {
          deletedProductId
        }
      }
    `;
    const variables = { id };
    const data = await this.mutate<{ productDelete: { deletedProductId: string } }>(
      mutation,
      variables,
    );
    return !!data.productDelete.deletedProductId;
  }

  /**
   * Fetches a collection by its ID using Shopify's GraphQL API.
   * @param id - The ID of the collection
   * @returns The collection data
   */
  async getCollectionById(id: string): Promise<any> {
    const query = `
      query($id: ID!) {
        collection(id: $id) {
          id
          title
          description
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      }
    `;
    const variables = { id };
    const data = await this.query<{ collection: any }>(query, variables);
    return data.collection;
  }

  /**
   * Creates a new collection in Shopify using GraphQL.
   * @param collection - The collection input data
   * @returns The created collection
   */
  async createCollection(collection: any): Promise<any> {
    const mutation = `
      mutation createCollection($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            title
            description
          }
        }
      }
    `;
    const variables = { input: collection };
    const data = await this.mutate<{ collectionCreate: { collection: any } }>(
      mutation,
      variables,
    );
    return data.collectionCreate.collection;
  }
}
