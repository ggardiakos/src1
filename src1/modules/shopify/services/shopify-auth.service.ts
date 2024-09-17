// src/modules/shopify/services/shopify-auth.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ShopifyAuthService as BaseShopifyAuthService } from '@nestjs-shopify/auth';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { ShopifyService } from './shopify.service'; // Import your custom Shopify service
import * as Sentry from '@sentry/node';
import { HttpService } from '@nestjs/axios'; // If you need to make external API calls

@Injectable()
export class ShopifyAuthService extends BaseShopifyAuthService {
  private readonly logger = new Logger(ShopifyAuthService.name);

  constructor(
    configService: ConfigService,
    private readonly shopifyService: ShopifyService, // Your custom Shopify service
    private readonly httpService: HttpService, // If you need to make HTTP calls
  ) {
    super(configService);
  }

  /**
   * Handles the authentication callback from Shopify.
   * After a shop authenticates, this method stores the access token and redirects the user to the dashboard.
   * @param req - Fastify request object
   * @param res - Fastify response object
   */
  async handleAuthCallback(req: FastifyRequest, res: FastifyReply) {
    try {
      const session = await this.authenticate(req, res); // Authenticate the session using the base service
      if (session) {
        // Store the shop access token for further API calls
        await this.shopifyService.setShopAccessToken(
          session.shop,
          session.accessToken,
        );
        this.logger.log(
          `Authenticated and stored access token for shop: ${session.shop}`,
        );

        // Redirect to dashboard or another route after successful authentication
        res.redirect('/dashboard'); 
      }
    } catch (error) {
      this.logger.error('Error during Shopify auth callback', error);
      Sentry.captureException(error);
      res.status(500).send('Authentication failed');
    }
  }

  /**
   * Initiates the Shopify login process.
   * @param req - Fastify request object
   * @param res - Fastify response object
   */
  async login(req: FastifyRequest, res: FastifyReply) {
    try {
      // Start Shopify OAuth flow
      await this.beginAuth(req, res);
    } catch (error) {
      this.logger.error('Error during Shopify login', error);
      Sentry.captureException(error);
      res.status(500).send('Login failed');
    }
  }

  /**
   * Logs out the user by invalidating the session and redirecting them to the homepage.
   * @param req - Fastify request object
   * @param res - Fastify response object
   */
  async logout(req: FastifyRequest, res: FastifyReply) {
    try {
      await this.invalidateSession(req, res); // Invalidate the Shopify session
      this.logger.log('User logged out successfully');
      res.redirect('/');
    } catch (error) {
      this.logger.error('Error during logout', error);
      Sentry.captureException(error);
      res.status(500).send('Logout failed');
    }
  }

  /**
   * Makes an authenticated API call to the Shopify API using the stored access token.
   * @param shop - The shop domain
   * @param endpoint - The Shopify API endpoint (e.g., /admin/products.json)
   */
  async makeAuthenticatedApiCall(shop: string, endpoint: string) {
    try {
      const accessToken = await this.shopifyService.getShopAccessToken(shop); // Fetch stored access token
      const response = await this.httpService.axiosRef.get(
        `https://${shop}${endpoint}`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to make API call to Shopify for shop ${shop}: ${error.message}`,
      );
      Sentry.captureException(error);
      throw error;
    }
  }
}
