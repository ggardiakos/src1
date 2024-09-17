// src/modules/shopify/controllers/shopify-auth.controller.ts

import { Controller, Get, Req, Res } from '@nestjs/common';
import { ShopifyAuth } from '@nestjs-shopify/auth';
import { FastifyRequest, FastifyReply } from 'fastify';

@Controller('auth/shopify')
export class ShopifyAuthController {
  constructor(private readonly shopifyAuth: ShopifyAuth) {}

  /**
   * Initiates the Shopify login process using OAuth.
   * Redirects the user to the Shopify authorization page.
   */
  @Get('login')
  async login(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await this.shopifyAuth.beginAuth(req, res, false);
  }

  /**
   * Handles the Shopify OAuth callback after authorization.
   * Validates the request and establishes a session.
   */
  @Get('callback')
  async callback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await this.shopifyAuth.validateAuth(req, res);
  }

  /**
   * Logs the user out of Shopify by clearing the session.
   */
  @Get('logout')
  async logout(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await this.shopifyAuth.logout(req, res);
  }
}
