import type { TestingModule } from '@nestjs/testing'
import type { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { getQueueToken } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'

import { BlacklistedTokenError, InvalidRefreshTokenError, SecurityService } from './security.service'

describe('securityService', () => {
  let service: SecurityService
  let jwtService: JwtService
  let redis: Redis
  let securityQueue: Queue
  let configService: ConfigService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed_token'),
            verify: jest.fn().mockReturnValue(true),
            decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(604800),
          },
        },
        {
          provide: 'Redis',
          useValue: {
            set: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1),
            keys: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getQueueToken('security'),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile()

    service = module.get<SecurityService>(SecurityService)
    jwtService = module.get<JwtService>(JwtService)
    redis = module.get<Redis>('Redis')
    securityQueue = module.get<Queue>(getQueueToken('security'))
    configService = module.get<ConfigService>(ConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateTokens', () => {
    it('should enqueue a generate-tokens job and return tokens', async () => {
      const userId = 'user123'
      const tokens = { accessToken: 'signed_token', refreshToken: 'random_refresh_token' };
      (securityQueue.add as jest.Mock).mockResolvedValueOnce({
        id: 'jobId',
        returnvalue: tokens,
      })

      const result = await service.generateTokens(userId)

      expect(securityQueue.add).toHaveBeenCalledWith('generate-tokens', { userId })
      expect(result).toEqual(tokens)
    })

    it('should handle errors when enqueueing generate-tokens job', async () => {
      const userId = 'user123'
      const error = new Error('Job enqueue failed');
      (securityQueue.add as jest.Mock).mockRejectedValueOnce(error)

      await expect(service.generateTokens(userId)).rejects.toThrow(error)
      expect(securityQueue.add).toHaveBeenCalledWith('generate-tokens', { userId })
    })
  })

  describe('refreshAccessToken', () => {
    it('should enqueue a refresh-access-token job and return new access token', async () => {
      const userId = 'user123'
      const refreshToken = 'refresh_token'
      const newAccessToken = 'new_signed_token';
      (securityQueue.add as jest.Mock).mockResolvedValueOnce({
        id: 'jobId',
        returnvalue: newAccessToken,
      })

      const token = await service.refreshAccessToken(userId, refreshToken)

      expect(securityQueue.add).toHaveBeenCalledWith('refresh-access-token', { userId, refreshToken })
      expect(token).toBe(newAccessToken)
    })

    it('should throw InvalidRefreshTokenError for invalid refresh token', async () => {
      const userId = 'user123'
      const refreshToken = 'invalid_refresh_token'
      const error = new InvalidRefreshTokenError('Invalid refresh token.');
      (securityQueue.add as jest.Mock).mockRejectedValueOnce(error)

      await expect(service.refreshAccessToken(userId, refreshToken)).rejects.toThrow(InvalidRefreshTokenError)
      expect(securityQueue.add).toHaveBeenCalledWith('refresh-access-token', { userId, refreshToken })
    })

    it('should refresh access token with valid refresh token', async () => {
      jest.spyOn(redis, 'get').mockResolvedValueOnce('valid_refresh_token')
      const result = await service.refreshAccessToken('user123', 'valid_refresh_token')
      expect(result).toBe('signed_token')
    })
  })

  describe('validateToken', () => {
    it('should enqueue a validate-token job and return true for valid token', async () => {
      const token = 'valid_token';
      (securityQueue.add as jest.Mock).mockResolvedValueOnce({
        id: 'jobId',
        returnvalue: true,
      })

      const isValid = await service.validateToken(token)

      expect(securityQueue.add).toHaveBeenCalledWith('validate-token', { token })
      expect(isValid).toBe(true)
    })

    it('should enqueue a validate-token job and return false for invalid token', async () => {
      const token = 'invalid_token';
      (securityQueue.add as jest.Mock).mockResolvedValueOnce({
        id: 'jobId',
        returnvalue: false,
      })

      const isValid = await service.validateToken(token)

      expect(securityQueue.add).toHaveBeenCalledWith('validate-token', { token })
      expect(isValid).toBe(false)
    })

    it('should throw BlacklistedTokenError if token is blacklisted', async () => {
      const token = 'blacklisted_token'
      const error = new BlacklistedTokenError('Token is blacklisted.');
      (securityQueue.add as jest.Mock).mockRejectedValueOnce(error)

      await expect(service.validateToken(token)).rejects.toThrow(BlacklistedTokenError)
      expect(securityQueue.add).toHaveBeenCalledWith('validate-token', { token })
    })

    it('should return true for a valid token', async () => {
      const result = await service.validateToken('valid_token')
      expect(result).toBe(true)
    })

    it('should throw BlacklistedTokenError for a blacklisted token', async () => {
      jest.spyOn(redis, 'get').mockResolvedValueOnce('blacklisted')
      await expect(service.validateToken('blacklisted_token')).rejects.toThrow(BlacklistedTokenError)
    })
  })

  describe('blacklistToken', () => {
    it('should blacklist a valid token', async () => {
      const token = 'valid_token'
      const decoded = { exp: Math.floor(Date.now() / 1000) + 3600 };
      (jwtService.decode as jest.Mock).mockReturnValueOnce(decoded);
      (redis.set as jest.Mock).mockResolvedValueOnce('OK')

      await service.blacklistToken(token)

      expect(jwtService.decode).toHaveBeenCalledWith(token)
      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        'blacklisted',
        'EX',
        decoded.exp - Math.floor(Date.now() / 1000),
      )
    })

    it('should throw error for token with invalid or missing exp claim', async () => {
      const token = 'invalid_token';
      (jwtService.decode as jest.Mock).mockReturnValueOnce(null)

      await expect(service.blacklistToken(token)).rejects.toThrow(
        'Cannot blacklist token with invalid or missing \'exp\' claim.',
      )

      expect(jwtService.decode).toHaveBeenCalledWith(token)
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('should throw error for already expired token', async () => {
      const token = 'expired_token'
      const decoded = { exp: Math.floor(Date.now() / 1000) - 10 };
      (jwtService.decode as jest.Mock).mockReturnValueOnce(decoded)

      await expect(service.blacklistToken(token)).rejects.toThrow(
        'Token already expired and cannot be blacklisted.',
      )

      expect(jwtService.decode).toHaveBeenCalledWith(token)
      expect(redis.set).not.toHaveBeenCalled()
    })
  })

  describe('isTokenBlacklisted', () => {
    it('should return true if token is blacklisted', async () => {
      const token = 'blacklisted_token';
      (redis.get as jest.Mock).mockResolvedValueOnce('blacklisted')

      const isBlacklisted = await service.isTokenBlacklisted(token)

      expect(redis.get).toHaveBeenCalledWith(`blacklist:${token}`)
      expect(isBlacklisted).toBe(true)
    })

    it('should return false if token is not blacklisted', async () => {
      const token = 'valid_token';
      (redis.get as jest.Mock).mockResolvedValueOnce(null)

      const isBlacklisted = await service.isTokenBlacklisted(token)

      expect(redis.get).toHaveBeenCalledWith(`blacklist:${token}`)
      expect(isBlacklisted).toBe(false)
    })
  })

  describe('revokeAllTokens', () => {
    it('should revoke all tokens for a user', async () => {
      jest.spyOn(redis, 'keys').mockResolvedValueOnce(['refreshToken:user123:token1', 'refreshToken:user123:token2'])

      await service.revokeAllTokens('user123')

      expect(redis.del).toHaveBeenCalledWith('refreshToken:user123:token1', 'refreshToken:user123:token2')
    })
  })
})
