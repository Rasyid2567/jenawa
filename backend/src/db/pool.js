
import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: true }
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
