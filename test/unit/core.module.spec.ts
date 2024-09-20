import type { TestingModule } from '@nestjs/testing'
import type { Shopify } from '@shopify/shopify-api'

import type { SessionStorage } from '../../src/core.interfaces'
import { Test } from '@nestjs/testing'

import {
  SHOPIFY_API_CONTEXT,
  SHOPIFY_API_SESSION_STORAGE,
} from '../../src/core.constants'
import { ShopifyCoreModule } from '../../src/core.module'
import {
  mockedShopifyCoreOptions,
  MockShopifyCoreModule,
} from '../helpers/mock-shopify-core-module'
import '@shopify/shopify-api/adapters/node'

describe('shopifyCoreModule', () => {
  let moduleRef: TestingModule

  describe('#forRoot', () => {
    beforeEach(async () => {
      moduleRef = await Test.createTestingModule({
        imports: [MockShopifyCoreModule],
      }).compile()
    })

    it('should provide Shopify context', () => {
      const shopify = moduleRef.get<Shopify>(SHOPIFY_API_CONTEXT)

      expect(shopify).toBeDefined()
    })

    it('should provide session storage', () => {
      const sessionStorage = moduleRef.get<SessionStorage>(
        SHOPIFY_API_SESSION_STORAGE,
      )

      expect(sessionStorage).toBeDefined()
    })
  })

  describe('#forRootAsync', () => {
    beforeEach(async () => {
      moduleRef = await Test.createTestingModule({
        imports: [
          ShopifyCoreModule.forRootAsync({
            useFactory: () => mockedShopifyCoreOptions,
          }),
        ],
      }).compile()
    })

    it('should provide Shopify context', () => {
      const shopify = moduleRef.get<Shopify>(SHOPIFY_API_CONTEXT)

      expect(shopify).toBeDefined()
    })

    it('should provide session storage', () => {
      const sessionStorage = moduleRef.get<SessionStorage>(
        SHOPIFY_API_SESSION_STORAGE,
      )

      expect(sessionStorage).toBeDefined()
    })
  })
})
