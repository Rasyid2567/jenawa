import pg from 'pg';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

const { Pool } = pg;

const supabaseCA = readFileSync(
  new URL('../../certs/prod-ca-2021.crt', import.meta.url),
  'utf8'
);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL === 'true'
    ? {
        ca: supabaseCA,
        rejectUnauthorized: true
      }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', () => {
  console.error('Terjadi kesalahan pada koneksi database idle.');
});

export async function checkDatabase() {
  const result = await pool.query(
    'SELECT current_database() AS database_name'
  );

  return result.rows[0];
}
