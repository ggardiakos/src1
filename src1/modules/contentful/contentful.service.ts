// src/modules/contentful/contentful.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ContentfulClientApi } from 'contentful';
Import { RedisService } from '../redis/redis.service';

@Injectable()
export class ContentfulService {
  private readonly logger = new Logger(ContentfulService.name);
  private client: ContentfulClientApi;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    const spaceId = this.configService.get<string>('contentful.spaceId');
    const accessToken = this.configService.get<string>('contentful.accessToken');
    const environment = this.configService.get<string>('contentful.environment') || 'master';

    if (!spaceId || !accessToken) {
      this.logger.error('Contentful space ID or access token is missing.');
      throw new Error('Contentful configuration is invalid.');
    }

    this.client = createClient({
      space: spaceId,
      accessToken,
      environment,
    });

    this.logger.log('Contentful client initialized.');
  }

  async getEntries(query?: any): Promise<any> {
    try {
      const entries = await this.client.getEntries(query);
      return entries.items;
    } catch (error) {
      this.logger.error('Error fetching entries from Contentful', error);
      throw error;
    }
  }

  async getEntryById(entryId: string): Promise<any> {
    try {
      const entry = await this.client.getEntry(entryId);
      return entry;
    } catch (error) {
      this.logger.error(`Error fetching entry ${entryId} from Contentful`, error);
      throw error;
    }
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.initialize();
  }

  async getEntries(query?: any): Promise<any> {
    const cacheKey = `contentful:entries:${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      this.logger.log('Cache hit for Contentful entries.');
      return JSON.parse(cachedData);
    }

    try {
      const entries = await this.client.getEntries(query);
      await this.redisService.set(
        cacheKey,
        JSON.stringify(entries.items),
        this.configService.get<number>('contentful.cacheTtl'),
      );
      return entries.items;
    } catch (error) {
      this.logger.error('Error fetching entries from Contentful', error);
      throw error;
    }
  }

  // Similar caching can be applied to other methods
}

