
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('jenawa-api'),
  JWT_AUDIENCE: z.string().default('jenawa-client'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12)
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Konfigurasi environment tidak valid.');
  process.exit(1);
}

export const env = {
  ...result.data,
  corsOrigins: result.data.CORS_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};
