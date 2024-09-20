import type { TestingModule } from '@nestjs/testing'
import type { Redis } from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { RedisModule } from '@nestjs-modules/ioredis'
import { RedisService } from '@redisservice'
import CircuitBreaker from 'opossum'

jest.mock('opossum') // Mock Opossum circuit breakers

describe('redisService with Circuit Breaker', () => {
  let service: RedisService
  let redisClient: jest.Mocked<Redis>
  let setBreaker: jest.Mocked<any>
  let getBreaker: jest.Mocked<any>
  let delBreaker: jest.Mocked<any>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RedisModule], // Use RedisModule from @nestjs-modules/ioredis
      providers: [
        RedisService,
        ConfigService,
        {
          provide: 'Redis', // Inject Redis from @nestjs-modules/ioredis
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<RedisService>(RedisService)
    redisClient = module.get<Redis>('Redis') // Get the mocked Redis instance

    // Mock Circuit Breakers for Redis operations
    setBreaker = new CircuitBreaker(service.setInternal.bind(service))
    getBreaker = new CircuitBreaker(service.getInternal.bind(service))
    delBreaker = new CircuitBreaker(service.delInternal.bind(service))

    // Mock the breaker methods to return their mocks
    jest.spyOn(service, 'setBreaker').mockReturnValue(setBreaker)
    jest.spyOn(service, 'getBreaker').mockReturnValue(getBreaker)
    jest.spyOn(service, 'delBreaker').mockReturnValue(delBreaker)
  })

  afterAll(async () => {
    await redisClient.quit() // Close the mocked Redis client
  })

  afterEach(() => {
    jest.clearAllMocks() // Reset mocks between tests
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('circuit Breaker for Redis Set', () => {
    it('should set a key with Circuit Breaker', async () => {
      const key = 'test_key'
      const value = 'test_value'
      const ttl = 10

      setBreaker.fire.mockResolvedValue(undefined) // Mock success for Circuit Breaker
      await service.set(key, value, ttl) // Call the service set method

      expect(setBreaker.fire).toHaveBeenCalledWith(key, value, ttl) // Check that circuit breaker was used
      expect(setBreaker.on).toHaveBeenCalledWith('open', expect.any(Function)) // Ensure Circuit Breaker event was triggered
      expect(setBreaker.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should trigger Circuit Breaker open event on failure', async () => {
      const key = 'test_key'
      const value = 'test_value'
      const ttl = 10

      setBreaker.fire.mockRejectedValue(new Error('Redis set failed')) // Simulate failure in Circuit Breaker
      setBreaker.on('open', jest.fn()) // Mock event for breaker opening

      await expect(service.set(key, value, ttl)).rejects.toThrow('Redis set failed') // Expect service to throw error

      expect(setBreaker.fire).toHaveBeenCalledWith(key, value, ttl) // Ensure Circuit Breaker was used
      expect(setBreaker.on).toHaveBeenCalledWith('open', expect.any(Function)) // Ensure breaker open event was triggered
    })
  })

  describe('circuit Breaker for Redis Get', () => {
    it('should get a key with Circuit Breaker', async () => {
      const key = 'test_key'
      const value = 'test_value'

      getBreaker.fire.mockResolvedValue(value) // Mock success for Circuit Breaker get operation
      const result = await service.get(key) // Call service get method

      expect(result).toBe(value) // Ensure the result is correct
      expect(getBreaker.fire).toHaveBeenCalledWith(key) // Check that circuit breaker was used
    })

    it('should trigger Circuit Breaker open event on failure', async () => {
      const key = 'test_key'

      getBreaker.fire.mockRejectedValue(new Error('Redis get failed')) // Simulate failure in Circuit Breaker
      getBreaker.on('open', jest.fn()) // Mock breaker open event

      await expect(service.get(key)).rejects.toThrow('Redis get failed') // Expect service to throw error
      expect(getBreaker.fire).toHaveBeenCalledWith(key) // Ensure Circuit Breaker was used
      expect(getBreaker.on).toHaveBeenCalledWith('open', expect.any(Function)) // Ensure breaker open event was triggered
    })
  })

  describe('circuit Breaker for Redis Del', () => {
    it('should delete a key with Circuit Breaker', async () => {
      const key = 'test_key'

      delBreaker.fire.mockResolvedValue(1) // Mock success for Circuit Breaker del operation
      const result = await service.del(key) // Call service del method

      expect(result).toBe(1) // Ensure the result is correct
      expect(delBreaker.fire).toHaveBeenCalledWith(key) // Check that circuit breaker was used
    })

    it('should trigger Circuit Breaker open event on failure', async () => {
      const key = 'test_key'

      delBreaker.fire.mockRejectedValue(new Error('Redis del failed')) // Simulate failure in Circuit Breaker
      delBreaker.on('open', jest.fn()) // Mock breaker open event

      await expect(service.del(key)).rejects.toThrow('Redis del failed') // Expect service to throw error
      expect(delBreaker.fire).toHaveBeenCalledWith(key) // Ensure Circuit Breaker was used
      expect(delBreaker.on).toHaveBeenCalledWith('open', expect.any(Function)) // Ensure breaker open event was triggered
    })
  })
})
