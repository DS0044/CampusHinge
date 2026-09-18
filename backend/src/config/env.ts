import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://campusapp:campusapp_dev@localhost:5432/campusapp'),
  VALKEY_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().default('dev_jwt_access_secret_campushinge_2026'),
  JWT_REFRESH_SECRET: z.string().default('dev_jwt_refresh_secret_campushinge_2026'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
