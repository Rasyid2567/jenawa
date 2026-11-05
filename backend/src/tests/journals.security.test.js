
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

import app from '../app.js';
import { pool } from '../db/pool.js';

describe('Keamanan kepemilikan jurnal', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let journalA;
  let journalB;

  const emailA = `jenawa-a-${randomUUID()}@example.com`;
  const emailB = `jenawa-b-${randomUUID()}@example.com`;
  const password = 'ContohPasswordAman123!';

  async function registerAndLogin(name, email) {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password });

    expect(register.status).toBe(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toBeTruthy();

    return login.body.data.accessToken;
  }

  async function createJournal(token, title) {
    const response = await request(app)
      .post('/api/journals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title,
        content: `Isi refleksi untuk ${title}`,
        reflection: 'Saya akan mencoba memperbaiki diri.'
      });

    expect(response.status).toBe(201);
    return response.body.data.id;
  }

  beforeAll(async () => {
    tokenA = await registerAndLogin('Pengguna A', emailA);
    tokenB = await registerAndLogin('Pengguna B', emailB);

    const result = await pool.query(`
      SELECT id, email
      FROM users
      WHERE email = ANY($1::varchar[])
    `, [[emailA, emailB]]);

    userA = result.rows.find((row) => row.email === emailA);
    userB = result.rows.find((row) => row.email === emailB);

    expect(userA).toBeTruthy();
    expect(userB).toBeTruthy();

    journalA = await createJournal(tokenA, 'Jurnal A');
    journalB = await createJournal(tokenB, 'Jurnal B');
  });

  afterAll(async () => {
    // Menghapus akun pengujian akan menghapus jurnalnya
    // melalui foreign key ON DELETE CASCADE.
    await pool.query(`
      DELETE FROM users
      WHERE email = ANY($1::varchar[])
    `, [[emailA, emailB]]);

    await pool.end();
  });

  it('pengguna A dapat membaca jurnal miliknya', async () => {
    const response = await request(app)
      .get(`/api/journals/${journalA}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe('Jurnal A');
  });

  it('pengguna A tidak dapat membaca jurnal pengguna B', async () => {
    const response = await request(app)
      .get(`/api/journals/${journalB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(404);
  });

  it('pengguna A tidak dapat mengubah jurnal pengguna B', async () => {
    const response = await request(app)
      .patch(`/api/journals/${journalB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Judul yang diubah oleh A' });

    expect(response.status).toBe(404);

    const ownerCheck = await pool.query(`
      SELECT title
      FROM journals
      WHERE id = $1 AND user_id = $2
    `, [journalB, userB.id]);

    expect(ownerCheck.rows[0].title).toBe('Jurnal B');
  });

  it('pengguna A tidak dapat menghapus jurnal pengguna B', async () => {
    const response = await request(app)
      .delete(`/api/journals/${journalB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(404);

    const ownerCheck = await pool.query(`
      SELECT id
      FROM journals
      WHERE id = $1 AND user_id = $2
    `, [journalB, userB.id]);

    expect(ownerCheck.rowCount).toBe(1);
  });

  it('pencarian jurnal A tidak mengembalikan jurnal B', async () => {
    const response = await request(app)
      .get('/api/journals?q=Jurnal')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);

    const ids = response.body.data.map((journal) => journal.id);

    expect(ids).toContain(journalA);
    expect(ids).not.toContain(journalB);
  });

  it('permintaan tanpa token ditolak', async () => {
    const response = await request(app).get('/api/journals');

    expect(response.status).toBe(401);
  });
});
