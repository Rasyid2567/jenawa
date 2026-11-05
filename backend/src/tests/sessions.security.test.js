import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

import app from '../app.js';
import { pool } from '../db/pool.js';

describe('Keamanan sesi relaksasi dan dashboard', () => {
  let tokenA;
  let tokenB;
  let userA;
  let userB;
  let exerciseId;
  let sessionA;
  let sessionB;

  const emailA = `jenawa-session-a-${randomUUID()}@example.com`;
  const emailB = `jenawa-session-b-${randomUUID()}@example.com`;
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

  async function createSession(token, duration = 120) {
    const response = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exercise_id: exerciseId,
        session_type: 'breathing',
        duration_seconds: duration,
        completed: true,
      });
    // Tampilkan detail jika API menolak pembuatan sesi.
    if (response.status !== 201) {
        console.error(
            'Gagal membuat sesi:',
            JSON.stringify({
                status: response.status,
                body: response.body,
                exerciseId,
                }, null, 2
            ));
    }
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBeTruthy();

    return response.body.data.id;
  }

  beforeAll(async () => {
    tokenA = await registerAndLogin('Pengguna Sesi A', emailA);
    tokenB = await registerAndLogin('Pengguna Sesi B', emailB);

    const users = await pool.query(
      `SELECT id, email
       FROM users
       WHERE email = ANY($1::varchar[])`,
      [[emailA, emailB]],
    );

    userA = users.rows.find((row) => row.email === emailA);
    userB = users.rows.find((row) => row.email === emailB);

    expect(userA).toBeTruthy();
    expect(userB).toBeTruthy();

    // Mengambil latihan aktif dari PostgreSQL.
    const exercises = await pool.query(
      `SELECT id
       FROM relaxation_exercises
       WHERE is_active = TRUE
       ORDER BY id
       LIMIT 1`,
    );

    expect(
      exercises.rowCount,
      'Database pengujian harus memiliki setidaknya satu latihan aktif',
    ).toBeGreaterThan(0);

    exerciseId = Number(exercises.rows[0].id);
    
    sessionA = await createSession(tokenA, 120);
    sessionB = await createSession(tokenB, 240);
  });

  afterAll(async () => {
    // Hapus hanya akun pengujian. Data sesi milik akun
    // akan ikut terhapus melalui ON DELETE CASCADE.
    await pool.query(
      `DELETE FROM users
       WHERE email = ANY($1::varchar[])`,
      [[emailA, emailB]],
    );

    // Tidak memanggil pool.end() agar koneksi tidak
    // tertutup sebelum test suite lain selesai.
  });

  it('pengguna A dapat melihat sesi miliknya', async () => {
    const response = await request(app)
      .get(`/api/sessions/${sessionA}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('pengguna A tidak dapat melihat sesi pengguna B', async () => {
    const response = await request(app)
      .get(`/api/sessions/${sessionB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(404);
  });

  it('pengguna A tidak dapat mengubah sesi pengguna B', async () => {
    const response = await request(app)
      .patch(`/api/sessions/${sessionB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        duration_seconds: 999,
        completed: true,
      });

    expect(response.status).toBe(404);

    const check = await pool.query(
      `SELECT duration_seconds, completed
       FROM relaxation_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionB, userB.id],
    );

    expect(check.rowCount).toBe(1);
    expect(check.rows[0].duration_seconds).toBe(240);
    expect(check.rows[0].completed).toBe(true);
  });

  it('pengguna A tidak dapat menghapus sesi pengguna B', async () => {
    const response = await request(app)
      .delete(`/api/sessions/${sessionB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(404);

    const check = await pool.query(
      `SELECT id
       FROM relaxation_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionB, userB.id],
    );

    expect(check.rowCount).toBe(1);
  });

  it('riwayat pengguna A hanya memuat sesi miliknya', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const ids = response.body.data.map((session) => String(session.id));

    expect(ids).toContain(String(sessionA));
    expect(ids).not.toContain(String(sessionB));
  });

  it('pengguna A dapat memperbarui sesi miliknya', async () => {
    const response = await request(app)
      .patch(`/api/sessions/${sessionA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        duration_seconds: 180,
        completed: true,
      });

    expect(response.status).toBe(200);

    const check = await pool.query(
      `SELECT duration_seconds, completed
       FROM relaxation_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionA, userA.id],
    );

    expect(check.rowCount).toBe(1);
    expect(check.rows[0].duration_seconds).toBe(180);
    expect(check.rows[0].completed).toBe(true);
  });

  it('menolak sesi dengan durasi negatif', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exercise_id: exerciseId,
        session_type: 'breathing',
        duration_seconds: -1,
        completed: false,
      });

    expect(response.status).toBe(400);
  });

  it('menolak tipe sesi yang tidak valid', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exercise_id: exerciseId,
        session_type: 'tidur',
        duration_seconds: 60,
        completed: false,
      });

    expect(response.status).toBe(400);
  });

  it('menolak sesi selesai dengan durasi nol', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        exercise_id: exerciseId,
        session_type: 'breathing',
        duration_seconds: 0,
        completed: true,
      });

    expect(response.status).toBe(400);
  });

  it('menolak akses sesi tanpa token', async () => {
    const response = await request(app).get('/api/sessions');

    expect(response.status).toBe(401);
  });

  it('menolak akses daftar latihan tanpa token', async () => {
    const response = await request(app).get('/api/exercises');

    expect(response.status).toBe(401);
  });

  it('dashboard mengembalikan statistik untuk pengguna yang login', async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTruthy();
  });

  it('menolak akses dashboard tanpa token', async () => {
    const response = await request(app).get('/api/dashboard');

    expect(response.status).toBe(401);
  });
});
