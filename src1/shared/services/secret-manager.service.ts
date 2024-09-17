import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class SecretManagerService {
  private readonly logger = new Logger(SecretManagerService.name);
  private readonly secretManager: AWS.SecretsManager;

  constructor(private readonly configService: ConfigService) {
    this.secretManager = new AWS.SecretsManager({
      region: this.configService.get<string>('aws.region'),
    });
  }

  async getSecret(secretName: string): Promise<string> {
    try {
      const data = await this.secretManager
        .getSecretValue({ SecretId: secretName })
        .promise();

      if ('SecretString' in data) {
        this.logger.log(`Successfully retrieved secret: ${secretName}`);
        return data.SecretString;
      }

      throw new Error('SecretString not found in secret value');
    } catch (error) {
      this.logger.error(`Failed to retrieve secret: ${secretName}`, error.stack);
      throw new Error(`Error retrieving secret ${secretName}: ${error.message}`);
    }
  }
}
