
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { validateBody } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createSessionSchema,
  updateSessionSchema
} from './sessions.schemas.js';

const router = Router();

router.use(authenticate);

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Membuat sesi baru.
router.post(
  '/',
  validateBody(createSessionSchema),
  asyncHandler(async (req, res) => {
    const {
      exercise_id = null,
      session_type,
      duration_seconds,
      completed
    } = req.validatedBody;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (exercise_id !== null) {
        const exercise = await client.query(`
          SELECT id
          FROM relaxation_exercises
          WHERE id = $1 AND is_active = TRUE
          FOR SHARE
        `, [exercise_id]);

        if (exercise.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Latihan tidak ditemukan atau tidak aktif.'
          });
        }
      }

      const result = await client.query(`
        INSERT INTO relaxation_sessions (
          user_id,
          exercise_id,
          session_type,
          duration_seconds,
          completed
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, exercise_id, session_type,
                  duration_seconds, completed, created_at
      `, [
        req.user.id,
        exercise_id,
        session_type,
        duration_seconds,
        completed
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Sesi berhasil dicatat.',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  })
);

// Riwayat sesi pribadi dengan pagination.
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
    100
  );

  const offset = Math.max(
    Number.parseInt(req.query.offset, 10) || 0,
    0
  );

  const result = await pool.query(`
    SELECT
      s.id,
      s.exercise_id,
      e.title AS exercise_title,
      s.session_type,
      s.duration_seconds,
      s.completed,
      s.created_at
    FROM relaxation_sessions s
    LEFT JOIN relaxation_exercises e
      ON e.id = s.exercise_id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT $2 OFFSET $3
  `, [req.user.id, limit, offset]);

  res.json({
    success: true,
    data: result.rows,
    pagination: { limit, offset }
  });
}));

// Detail sesi hanya untuk pemilik.
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID sesi tidak valid.'
    });
  }

  const result = await pool.query(`
    SELECT
      s.id,
      s.exercise_id,
      e.title AS exercise_title,
      s.session_type,
      s.duration_seconds,
      s.completed,
      s.created_at
    FROM relaxation_sessions s
    LEFT JOIN relaxation_exercises e
      ON e.id = s.exercise_id
    WHERE s.id = $1 AND s.user_id = $2
  `, [id, req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Sesi tidak ditemukan.'
    });
  }

  res.json({ success: true, data: result.rows[0] });
}));

// Update sesi milik pengguna.
router.patch(
  '/:id',
  validateBody(updateSessionSchema),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID sesi tidak valid.'
      });
    }

    const input = req.validatedBody;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const current = await client.query(`
        SELECT id, duration_seconds, completed
        FROM relaxation_sessions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `, [id, req.user.id]);

      if (current.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Sesi tidak ditemukan.'
        });
      }

      const duration = input.duration_seconds
        ?? current.rows[0].duration_seconds;
      const completed = input.completed
        ?? current.rows[0].completed;

      if (completed && duration <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Sesi yang selesai harus memiliki durasi lebih dari 0 detik.'
        });
      }

      const result = await client.query(`
        UPDATE relaxation_sessions
        SET duration_seconds = $1,
            completed = $2
        WHERE id = $3 AND user_id = $4
        RETURNING id, exercise_id, session_type,
                  duration_seconds, completed, created_at
      `, [duration, completed, id, req.user.id]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Sesi berhasil diperbarui.',
        data: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  })
);

// Hapus sesi hanya jika dimiliki pengguna.
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID sesi tidak valid.'
    });
  }

  const result = await pool.query(`
    DELETE FROM relaxation_sessions
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [id, req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Sesi tidak ditemukan.'
    });
  }

  res.json({
    success: true,
    message: 'Sesi berhasil dihapus.'
  });
}));

export default router;
