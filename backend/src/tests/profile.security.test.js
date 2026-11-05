import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

import app from '../app.js';
import { pool } from '../db/pool.js';
import { PROFILE_UPLOAD_DIR } from '../config/profileStorage.js';

const api = request(app);
const nonce = randomUUID();
const emailA = `jenawa-profile-a-${nonce}@example.com`;
const emailB = `jenawa-profile-b-${nonce}@example.com`;
const password = 'ContohPasswordAman123!';

let tokenA;
let tokenB;
let userA;
let userB;
let photoUrl;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function registerAndLogin(name, email) {
  const registered = await api.post('/api/auth/register').send({ name, email, password });
  expect(registered.status).toBe(201);

  const loggedIn = await api.post('/api/auth/login').send({ email, password });
  expect(loggedIn.status).toBe(200);
  expect(loggedIn.body.data.accessToken).toBeTruthy();
  return loggedIn.body.data.accessToken;
}

describe('Profil pengguna - API dan keamanan kepemilikan', () => {
  beforeAll(async () => {
    tokenA = await registerAndLogin('Pengguna Profil A', emailA);
    tokenB = await registerAndLogin('Pengguna Profil B', emailB);

    const result = await pool.query(
      'SELECT id, email FROM users WHERE email = ANY($1::varchar[])',
      [[emailA, emailB]],
    );
    userA = result.rows.find((row) => row.email === emailA);
    userB = result.rows.find((row) => row.email === emailB);
    expect(userA).toBeTruthy();
    expect(userB).toBeTruthy();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1::varchar[])', [[emailA, emailB]]);
    if (photoUrl && photoUrl.startsWith('/uploads/profiles/')) {
      await unlink(join(PROFILE_UPLOAD_DIR, basename(photoUrl))).catch(() => {});
    }
  });

  it('menolak akses profil tanpa token', async () => {
    const response = await api.get('/api/profile');
    expect(response.status).toBe(401);
  });

  it('mengembalikan profil akun aktif tanpa password_hash', async () => {
    const response = await api.get('/api/profile').set(auth(tokenA));
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(emailA);
    expect(response.body.data.name).toBe('Pengguna Profil A');
    expect(response.body.data).toHaveProperty('nis');
    expect(response.body.data).toHaveProperty('class_name');
    expect(response.body.data).toHaveProperty('major');
    expect(response.body.data).toHaveProperty('phone');
    expect(response.body.data).toHaveProperty('profile_photo_url');
    expect(response.body.data).not.toHaveProperty('password_hash');
  });

  it('memperbarui data profil milik pengguna yang sedang login', async () => {
    const response = await api.patch('/api/profile').set(auth(tokenA)).send({
      name: 'Pengguna A Diperbarui',
      nis: `NIS-${nonce.slice(0, 8)}`,
      class_name: 'XI RPL C',
      major: 'Rekayasa Perangkat Lunak',
      phone: '081234567890',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Pengguna A Diperbarui');
    expect(response.body.data.nis).toBe(`NIS-${nonce.slice(0, 8)}`);
    expect(response.body.data.class_name).toBe('XI RPL C');
    expect(response.body.data.major).toBe('Rekayasa Perangkat Lunak');
    expect(response.body.data.phone).toBe('081234567890');
  });

  it('tidak membolehkan klien menentukan user_id dalam perubahan profil', async () => {
    const response = await api.patch('/api/profile').set(auth(tokenA)).send({
      name: 'Percobaan lintas akun',
      user_id: userB.id,
    });
    expect(response.status).toBe(400);

    const otherProfile = await api.get('/api/profile').set(auth(tokenB));
    expect(otherProfile.status).toBe(200);
    expect(otherProfile.body.data.name).toBe('Pengguna Profil B');
  });

  it('menolak NIS yang sudah dipakai profil lain', async () => {
    const profileA = await api.get('/api/profile').set(auth(tokenA));
    const response = await api.patch('/api/profile').set(auth(tokenB)).send({
      nis: profileA.body.data.nis,
    });
    expect(response.status).toBe(409);
  });

  it('mengunggah foto profil PNG dengan autentikasi', async () => {
    // PNG transparan 1x1 untuk kebutuhan test, bukan foto pengguna sungguhan.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zt8AAAAASUVORK5CYII=',
      'base64',
    );
    const response = await api.post('/api/profile/photo')
      .set(auth(tokenA))
      .attach('photo', png, { filename: 'test-profile.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.data.profile_photo_url).toMatch(/^\/uploads\/profiles\//);
    photoUrl = response.body.data.profile_photo_url;

    const savedProfile = await api.get('/api/profile').set(auth(tokenA));
    expect(savedProfile.status).toBe(200);
    expect(savedProfile.body.data.profile_photo_url).toBe(photoUrl);
  });

  it('menolak unggah foto tanpa token', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zt8AAAAASUVORK5CYII=',
      'base64',
    );
    const response = await api.post('/api/profile/photo')
      .attach('photo', png, { filename: 'test-profile.png', contentType: 'image/png' });
    expect(response.status).toBe(401);
  });

  it('menghapus foto profil pengguna sendiri', async () => {
    if (!photoUrl) return;
    const response = await api.delete('/api/profile/photo').set(auth(tokenA));
    expect(response.status).toBe(200);
    expect(response.body.data.profile_photo_url).toBeNull();
    photoUrl = null;
  });
});
