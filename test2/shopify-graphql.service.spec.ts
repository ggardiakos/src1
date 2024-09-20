import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ShopifyGraphQLService } from './shopify-graphql.service';
import { GraphQLClient } from 'graphql-request';
import { ShopifyTokenService } from './shopify-token.service'; // Mock this service
import { ShopifyGraphQLError } from @shopify-graphql.error';

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

describe('ShopifyGraphQLService', () => {
  let service: ShopifyGraphQLService;
  let graphqlClient: GraphQLClient;
  let tokenService: ShopifyTokenService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyGraphQLService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'shopify.graphqlUrl') return 'https://myshop.myshopify.com';
              if (key === 'shopify.accessToken') return 'mock_access_token';
            }),
          },
        },
        {
          provide: ShopifyTokenService,
          useValue: {
            getTokenForStore: jest.fn().mockReturnValue('mock_token'),
          },
        },
      ],
    }).compile();

    service = module.get<ShopifyGraphQLService>(ShopifyGraphQLService);
    configService = module.get<ConfigService>(ConfigService);
    tokenService = module.get<ShopifyTokenService>(ShopifyTokenService);
    graphqlClient = (service as any).client; // Access the mocked GraphQLClient
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize GraphQL client with correct URL and token', () => {
    const spy = jest.spyOn(GraphQLClient.prototype, 'request');

    service.query('test_query', {});

    expect(spy).toHaveBeenCalledWith('test_query', {});
    expect(GraphQLClient).toHaveBeenCalledWith(
      'https://myshop.myshopify.com/admin/api/2023-07/graphql.json',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'mock_access_token',
        },
      })
    );
  });

  it('should throw error if Shopify URL or token is not configured', () => {
    jest.spyOn(configService, 'get').mockReturnValueOnce(null);

    expect(() => {
      service.query('test_query', {});
    }).toThrowError('Shopify GraphQL URL or access token is not configured');
  });

  it('should execute GraphQL query with retries', async () => {
    const spy = jest.spyOn(graphqlClient, 'request');
    spy.mockResolvedValue({ product: { id: '1', title: 'Test Product' } });

    const result = await service.query('test_query', { id: '1' });

    expect(result).toBeDefined();
    expect(result.product.title).toBe('Test Product');
    expect(spy).toHaveBeenCalledTimes(1); // Should only call once since no retry needed
  });

  it('should retry on rate limit error', async () => {
    const spy = jest.spyOn(graphqlClient, 'request');
    const mockError = new Error('Rate limit exceeded');
    (mockError as any).code = 'RATE_LIMIT';
    spy.mockRejectedValueOnce(mockError).mockResolvedValueOnce({
      product: { id: '1', title: 'Test Product' },
    });

    const result = await service.query('test_query', { id: '1' });

    expect(result).toBeDefined();
    expect(result.product.title).toBe('Test Product');
    expect(spy).toHaveBeenCalledTimes(2); // Should retry once
  });

  it('should throw a ShopifyGraphQLError on failure', async () => {
    const spy = jest.spyOn(graphqlClient, 'request');
    const mockError = new Error('Internal server error');
    spy.mockRejectedValue(mockError);

    await expect(service.query('test_query', { id: '1' })).rejects.toThrow(ShopifyGraphQLError);

    expect(spy).toHaveBeenCalledTimes(1); // Only called once, no retry
  });

  it('should create a product with valid input', async () => {
    const spy = jest.spyOn(graphqlClient, 'request');
    spy.mockResolvedValue({
      productCreate: { product: { id: '1', title: 'New Product' } },
    });

    const result = await service.createProduct({ title: 'New Product' });

    expect(result).toBeDefined();
    expect(result.title).toBe('New Product');
  });
});
