
import { pool } from '../../db/pool.js';

export async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] ?? null;
}

export async function findPublicUserById(id) {
  const result = await pool.query(
    `SELECT id, name, email, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function createUser({ name, email, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at, updated_at`,
    [name, email, passwordHash]
  );

  return result.rows[0];
}

export async function revokeToken({ jti, expiresAt }) {
  await pool.query(
    `INSERT INTO revoked_tokens (jti, expires_at)
     VALUES ($1, $2)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, expiresAt]
  );
}
