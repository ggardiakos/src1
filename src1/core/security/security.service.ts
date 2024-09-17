// src/core/security/security.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// Import your User service and DTOs as needed

@Injectable()
export class SecurityService {
  constructor(
    private readonly jwtService: JwtService,
    // Inject other services like UserService if needed
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    // Implement your user validation logic here
    // For example, fetch the user and compare passwords
    const user = /* fetch user by username */;
    if (user && user.password === password) {
      // Exclude sensitive fields
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, roles: user.roles };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
