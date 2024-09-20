import type { ConfigService } from '@nestjs/config'
import type { SecretManagerService } from '@secretmanager'

import { JwtStrategy } from '@jwtstrategies'
import { UnauthorizedException } from '@nestjs/common'
import type { SecurityService } from '../security.service'

describe('jwtStrategy', () => {
  let jwtStrategy: JwtStrategy
  let securityService: SecurityService
  let configService: ConfigService
  let secretManagerService: SecretManagerService

  beforeEach(async () => {
    securityService = {
      isTokenBlacklisted: jest.fn(),
    } as unknown as SecurityService

    configService = {
      get: jest.fn().mockReturnValue('default_jwt_secret'),
    } as unknown as ConfigService

    secretManagerService = {
      getSecret: jest.fn().mockResolvedValue(null),
    } as unknown as SecretManagerService

    jwtStrategy = new JwtStrategy(securityService, configService, secretManagerService)
  })

  describe('secretOrKeyProvider', () => {
    it('should retrieve the secret from the SecretManagerService', async () => {
      // Mock the secret manager to return a valid secret
      (secretManagerService.getSecret as jest.Mock).mockResolvedValueOnce('secret_from_manager')

      const done = jest.fn()
      await jwtStrategy.secretOrKeyProvider(null, null, done)

      expect(secretManagerService.getSecret).toHaveBeenCalledWith('JWT_SECRET')
      expect(done).toHaveBeenCalledWith(null, 'secret_from_manager')
    })

    it('should fall back to the configService if secret is not found in SecretManagerService', async () => {
      (secretManagerService.getSecret as jest.Mock).mockResolvedValueOnce(null)

      const done = jest.fn()
      await jwtStrategy.secretOrKeyProvider(null, null, done)

      expect(configService.get).toHaveBeenCalledWith('jwt.secret')
      expect(done).toHaveBeenCalledWith(null, 'default_jwt_secret')
    })
  })

  describe('validate', () => {
    it('should return user data if token is valid and not blacklisted', async () => {
      const payload = { jti: 'token_id', sub: 'user_id', username: 'testuser', roles: ['user'] };
      (securityService.isTokenBlacklisted as jest.Mock).mockResolvedValueOnce(false)

      const result = await jwtStrategy.validate(payload)

      expect(result).toEqual({ userId: payload.sub, username: payload.username, roles: payload.roles })
      expect(securityService.isTokenBlacklisted).toHaveBeenCalledWith(payload.jti)
    })

    it('should throw UnauthorizedException if token is blacklisted', async () => {
      const payload = { jti: 'token_id', sub: 'user_id' };
      (securityService.isTokenBlacklisted as jest.Mock).mockResolvedValueOnce(true)

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(UnauthorizedException)
      expect(securityService.isTokenBlacklisted).toHaveBeenCalledWith(payload.jti)
    })
  })
})
