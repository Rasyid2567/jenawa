
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';

const claimsSchema = z.object({
  sub: z.string().regex(/^\d+$/),
  jti: z.string().uuid(),
  exp: z.number().int().positive()
});

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Autentikasi diperlukan.'
      });
    }

    const decoded = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE
    });

    const claims = claimsSchema.safeParse(decoded);

    if (!claims.success) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid.'
      });
    }

    const revoked = await pool.query(
      `SELECT 1
       FROM revoked_tokens
       WHERE jti = $1 AND expires_at > NOW()`,
      [claims.data.jti]
    );

    if (revoked.rowCount > 0) {
      return res.status(401).json({
        success: false,
        message: 'Sesi telah berakhir. Silakan login kembali.'
      });
    }

    req.user = {
      id: claims.data.sub,
      jti: claims.data.jti,
      token: match[1],
      exp: decoded.exp
    };
    // console.log('User terautentikasi:', req.user.id);

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau telah kedaluwarsa.'
    });
  }
}
