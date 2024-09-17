// src/modules/contentful/contentful.module.ts

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ContentfulService } from './contentful.service';
import { createClient, ContentfulClientApi } from 'contentful';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'CONTENTFUL_CLIENT',
      useFactory: (configService: ConfigService): ContentfulClientApi => {
        return createClient({
          space: configService.get<string>('contentful.spaceId'),
          accessToken: configService.get<string>('contentful.accessToken'),
          environment: configService.get<string>('contentful.environment') || 'master',
        });
      },
      inject: [ConfigService],
    },
    ContentfulService,
  ],
  exports: [ContentfulService],
})
export class ContentfulModule {}
