import type { TestingModuleBuilder } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { ShopifyAuthModule } from '@nestjs-shopify/auth'

import { ShopifyGraphqlProxyModule } from '../../src/graphql-proxy/graphql-proxy.module'
import { MockShopifyCoreModule } from './mock-shopify-core-module'

export function createTestingModule() {
  return Test.createTestingModule({
    imports: [
      MockShopifyCoreModule,
      ShopifyAuthModule.forRootOnline({}),
      ShopifyGraphqlProxyModule,
    ],
  })
}

export async function createTestApp(appModule?: TestingModuleBuilder) {
  const module = appModule ?? createTestingModule()
  const testingModule = await module.compile()

  return testingModule.createNestApplication({ rawBody: true })
}
