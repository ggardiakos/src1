import type { TestingModule } from '@nestjs/testing'
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SecretManagerService } from './secret-manager.service'

jest.mock('@aws-sdk/client-secrets-manager') // Mock AWS SDK Secrets Manager Client

describe('secretManagerService', () => {
  let service: SecretManagerService
  let configService: ConfigService
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'AWS_REGION':
                  return 'us-east-1'
                case 'AWS_ACCESS_KEY_ID':
                  return 'fakeAccessKeyId'
                case 'AWS_SECRET_ACCESS_KEY':
                  return 'fakeSecretAccessKey'
                default:
                  return null
              }
            }),
          },
        },
      ],
    }).compile()

    service = module.get<SecretManagerService>(SecretManagerService)
    configService = module.get<ConfigService>(ConfigService)
    logger = new Logger(SecretManagerService.name)
    jest.spyOn(logger, 'error').mockImplementation(jest.fn()) // Mock logger's error method
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should initialize SecretsManagerClient with correct region and credentials', () => {
    const client = (service as any).client // Access the SecretsManagerClient instance
    expect(client.config.region).toBe('us-east-1')
    expect(client.config.credentials.accessKeyId).toBe('fakeAccessKeyId')
    expect(client.config.credentials.secretAccessKey).toBe('fakeSecretAccessKey')
  })

  it('should fetch a secret successfully when SecretString is returned', async () => {
    const secretName = 'my-secret'
    const mockSecretValue = { SecretString: 'mockSecretString' };

    (SecretsManagerClient.prototype.send as jest.Mock).mockResolvedValueOnce(mockSecretValue)

    const secret = await service.getSecret(secretName)

    expect(secret).toBe('mockSecretString')
    expect(SecretsManagerClient.prototype.send).toHaveBeenCalledWith(
      new GetSecretValueCommand({ SecretId: secretName }),
    )
  })

  it('should convert and return binary secrets', async () => {
    const secretName = 'my-binary-secret'
    const mockSecretValue = {
      SecretBinary: Buffer.from('mockSecretBinary', 'ascii'),
    };

    (SecretsManagerClient.prototype.send as jest.Mock).mockResolvedValueOnce(mockSecretValue)

    const secret = await service.getSecret(secretName)

    expect(secret).toBe('mockSecretBinary')
    expect(SecretsManagerClient.prototype.send).toHaveBeenCalledWith(
      new GetSecretValueCommand({ SecretId: secretName }),
    )
  })

  it('should log an error and throw if secret retrieval fails', async () => {
    const secretName = 'non-existent-secret'
    const mockError = new Error('Secret not found');

    (SecretsManagerClient.prototype.send as jest.Mock).mockRejectedValueOnce(mockError)

    await expect(service.getSecret(secretName)).rejects.toThrow('Secret not found')
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to retrieve secret ${secretName}: Secret not found`,
    )
  })
})
