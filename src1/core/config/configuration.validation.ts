// src/core/config/configuration.validation.ts

import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  validateSync,
  IsOptional,
} from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  @IsOptional()
  PORT: number;

  @IsString()
  @IsOptional()
  NODE_ENV: string;

  // Database variables
  @IsString()
  DB_HOST: string;

  @IsNumber()
  @IsOptional()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsBoolean()
  @IsOptional()
  DB_SYNCHRONIZE: boolean;

  @IsBoolean()
  @IsOptional()
  DB_LOGGING: boolean;

  @IsBoolean()
  @IsOptional()
  DB_SSL: boolean;

  // Redis variables
  @IsString()
  @IsOptional()
  REDIS_HOST: string;

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD: string;

  // Add other variables as needed
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
