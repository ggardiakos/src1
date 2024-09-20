import { validate } from '@configurationvalidation'

describe('configuration Validation', () => {
  it('should pass with valid config', () => {
    const validConfig = {
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'testuser',
      DB_PASSWORD: 'testpassword',
      DB_NAME: 'testdb',
      JWT_SECRET: 'supersecret',
      SHOPIFY_API_KEY: 'shopify-key',
      SHOPIFY_API_SECRET_KEY: 'shopify-secret',
    }

    expect(() => validate(validConfig)).not.toThrow()
  })

  it('should throw an error for missing required config', () => {
    const invalidConfig = {}

    expect(() => validate(invalidConfig)).toThrow(
      'Configuration validation failed: DB_HOST has wrong value',
    )
  })

  it('should throw an error for invalid type in config', () => {
    const invalidConfig = {
      DB_PORT: 'invalid_number',
    }

    expect(() => validate(invalidConfig)).toThrow(
      'Configuration validation failed: DB_PORT has wrong value',
    )
  })

  it('should pass validation with optional fields missing', () => {
    const validConfigWithOptionalsMissing = {
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'testuser',
      DB_PASSWORD: 'testpassword',
      DB_NAME: 'testdb',
      JWT_SECRET: 'supersecret',
    }

    expect(() => validate(validConfigWithOptionalsMissing)).not.toThrow()
  })

  it('should throw an error if a required variable has an invalid type', () => {
    const invalidTypeConfig = {
      DB_HOST: 'localhost',
      DB_PORT: 'not_a_number', // Invalid type
      DB_USERNAME: 'user',
      DB_PASSWORD: 'password',
      DB_NAME: 'testdb',
    }

    expect(() => validate(invalidTypeConfig)).toThrow(
      'Configuration validation failed: DB_PORT has wrong value',
    )
  })

  it('should throw an error when JWT secret is missing', () => {
    const missingJwtConfig = {
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'testuser',
      DB_PASSWORD: 'testpassword',
      DB_NAME: 'testdb',
    }

    expect(() => validate(missingJwtConfig)).toThrow(
      'Configuration validation failed: JWT_SECRET has wrong value',
    )
  })
})
