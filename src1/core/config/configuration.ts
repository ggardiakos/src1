// src/core/config/configuration.ts

export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    type: process.env.DB_TYPE || 'postgresql', // or 'mysql'
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 300,
    max: parseInt(process.env.CACHE_MAX, 10) || 100,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES?.split(',') || [],
    hostName: process.env.SHOPIFY_HOST_NAME,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2023-10',
    isEmbeddedApp: process.env.SHOPIFY_IS_EMBEDDED_APP === 'true',
    webhookPath: process.env.SHOPIFY_WEBHOOK_PATH || '/webhooks',
  },

  contentful: {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
    environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    cacheTtl: parseInt(process.env.CONTENTFUL_CACHE_TTL, 10) || 900,
    cacheMaxItems: parseInt(process.env.CONTENTFUL_CACHE_MAX_ITEMS, 10) || 100,
  },

  bull: {
    queueName: process.env.QUEUE_NAME || 'my-queue',
    retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS, 10) || 3,
    retryDelay: parseInt(process.env.QUEUE_RETRY_BACKOFF_DELAY, 10) || 1000,
  },

  sentryDsn: process.env.SENTRY_DSN || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
});
