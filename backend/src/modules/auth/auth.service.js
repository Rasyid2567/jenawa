
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import * as repository from './auth.repository.js';

const DUMMY_HASH = await bcrypt.hash(
  randomUUID(),
  env.BCRYPT_ROUNDS
);

export async function register({ name, email, password }) {
  const existing = await repository.findUserByEmail(email);

  if (existing) {
    const error = new Error('Email sudah terdaftar.');
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(
    password,
    env.BCRYPT_ROUNDS
  );

  try {
    return await repository.createUser({
      name,
      email,
      passwordHash
    });
  } catch (error) {
    // Menangani race condition pada constraint UNIQUE email.
    if (error.code === '23505') {
      const conflict = new Error('Email sudah terdaftar.');
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }
}

export async function login({ email, password }) {
  const user = await repository.findUserByEmail(email);

  // Gunakan respons yang sama agar tidak mengungkap
  // apakah suatu email telah terdaftar.
  const passwordHash = user?.password_hash ?? DUMMY_HASH;
  
  const passwordMatches = await bcrypt.compare(
    password,
    passwordHash
  );

  if (!user || !passwordMatches) {
    const error = new Error('Email atau kata sandi salah.');
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    {},
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: String(user.id),
      jwtid: randomUUID(),
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_EXPIRES_IN
    }
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: env.JWT_EXPIRES_IN
  };
}

export async function getCurrentUser(id) {
  return repository.findPublicUserById(id);
}

export async function logout(authUser) {
  if (!authUser.exp) {
    const error = new Error('Token tidak valid.');
    error.status = 401;
    throw error;
  }

  await repository.revokeToken({
    jti: authUser.jti,
    expiresAt: new Date(authUser.exp * 1000)
  });
}
