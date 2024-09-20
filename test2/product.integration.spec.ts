// src/modules/product/product.integration.spec.ts
import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'

import { AppModule } from '../../shared/app.module' // Ensure AppModule imports Product, Shopify, Contentful, etc.

describe('product Integration (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('/products (POST) - should create and sync product across systems', async () => {
    const productData = { title: 'New Product', description: 'Product Description' }

    const response = await request(app.getHttpServer())
      .post('/products')
      .send(productData)
      .expect(201)

    expect(response.body).toEqual(
      expect.objectContaining({
        title: 'New Product',
        description: 'Product Description',
      }),
    )

    // Additional assertions can be added to check that Shopify and Contentful are also updated
  })

  afterAll(async () => {
    await app.close()
  })
})
