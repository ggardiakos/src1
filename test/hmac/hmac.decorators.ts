import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import type { ShopifyHmacType } from './hmac.enums'

import { SHOPIFY_HMAC_KEY } from './hmac.constants'
import { ShopifyHmacGuard } from './hmac.guard'

export function ShopifyHmac(hmacType: ShopifyHmacType) {
  return applyDecorators(
    SetMetadata(SHOPIFY_HMAC_KEY, hmacType),
    UseGuards(ShopifyHmacGuard),
  )
}
