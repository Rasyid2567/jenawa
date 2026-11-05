
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { validateBody } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createJournalSchema,
  updateJournalSchema
} from './journals.schemas.js';

const router = Router();

router.use(authenticate);

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function ownsEmotionLog(client, emotionLogId, userId) {
  if (emotionLogId == null) return true;

  const result = await client.query(`
    SELECT id
    FROM emotion_logs
    WHERE id = $1 AND user_id = $2
  `, [emotionLogId, userId]);

  return result.rowCount > 0;
}

// Membuat jurnal. User ID selalu berasal dari token, bukan body.
router.post(
  '/',
  validateBody(createJournalSchema),
  asyncHandler(async (req, res) => {
    const {
      emotion_log_id = null,
      title = null,
      content,
      reflection = null
    } = req.validatedBody;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (!await ownsEmotionLog(
        client,
        emotion_log_id,
        req.user.id
      )) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Catatan perasaan tidak ditemukan atau bukan milik Anda.'
        });
      }

      const result = await client.query(`
        INSERT INTO journals
          (user_id, emotion_log_id, title, content, reflection)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, emotion_log_id, title, content,
                  reflection, created_at, updated_at
      `, [
        req.user.id,
        emotion_log_id,
        title,
        content,
        reflection
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Jurnal refleksi berhasil dibuat.',
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

// Daftar dan pencarian jurnal hanya dalam ruang data pemilik.
router.get('/', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string'
    ? req.query.q.trim().slice(0, 200)
    : '';

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
      j.id,
      j.emotion_log_id,
      j.title,
      j.content,
      j.reflection,
      j.created_at,
      j.updated_at,
      c.name AS emotion_name
    FROM journals j
    LEFT JOIN emotion_logs e
      ON e.id = j.emotion_log_id
     AND e.user_id = j.user_id
    LEFT JOIN emotion_categories c
      ON c.id = e.category_id
    WHERE j.user_id = $1
      AND (
        $2 = ''
        OR COALESCE(j.title, '') ILIKE '%' || $2 || '%'
        OR j.content ILIKE '%' || $2 || '%'
        OR COALESCE(j.reflection, '') ILIKE '%' || $2 || '%'
      )
    ORDER BY j.updated_at DESC, j.id DESC
    LIMIT $3 OFFSET $4
  `, [req.user.id, q, limit, offset]);

  res.json({
    success: true,
    data: result.rows,
    pagination: { q, limit, offset }
  });
}));

// Detail jurnal dibatasi berdasarkan ID dan user ID.
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID jurnal tidak valid.'
    });
  }

  const result = await pool.query(`
    SELECT
      j.id,
      j.emotion_log_id,
      j.title,
      j.content,
      j.reflection,
      j.created_at,
      j.updated_at,
      c.name AS emotion_name
    FROM journals j
    LEFT JOIN emotion_logs e
      ON e.id = j.emotion_log_id
     AND e.user_id = j.user_id
    LEFT JOIN emotion_categories c
      ON c.id = e.category_id
    WHERE j.id = $1 AND j.user_id = $2
  `, [id, req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Jurnal tidak ditemukan.'
    });
  }

  res.json({ success: true, data: result.rows[0] });
}));

// Update atomik dan hanya untuk jurnal milik pengguna.
router.patch(
  '/:id',
  validateBody(updateJournalSchema),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID jurnal tidak valid.'
      });
    }

    const input = req.validatedBody;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const owned = await client.query(`
        SELECT id
        FROM journals
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `, [id, req.user.id]);

      if (owned.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Jurnal tidak ditemukan.'
        });
      }

      if (
        input.emotion_log_id !== undefined &&
        !await ownsEmotionLog(
          client,
          input.emotion_log_id,
          req.user.id
        )
      ) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Catatan perasaan tidak ditemukan atau bukan milik Anda.'
        });
      }

      // Nama kolom berasal dari whitelist, bukan input bebas.
      const allowedFields = [
        'emotion_log_id',
        'title',
        'content',
        'reflection'
      ];

      const assignments = [];
      const values = [];
      let parameterIndex = 1;

      for (const field of allowedFields) {
        if (input[field] !== undefined) {
          assignments.push(`${field} = $${parameterIndex++}`);
          values.push(input[field]);
        }
      }

      assignments.push('updated_at = NOW()');
      values.push(id, req.user.id);

      const result = await client.query(`
        UPDATE journals
        SET ${assignments.join(', ')}
        WHERE id = $${parameterIndex}
          AND user_id = $${parameterIndex + 1}
        RETURNING id, emotion_log_id, title, content,
                  reflection, created_at, updated_at
      `, values);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Jurnal berhasil diperbarui.',
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

// Menghapus jurnal hanya jika jurnal dimiliki pengguna.
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID jurnal tidak valid.'
    });
  }

  const result = await pool.query(`
    DELETE FROM journals
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [id, req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Jurnal tidak ditemukan.'
    });
  }

  res.json({
    success: true,
    message: 'Jurnal berhasil dihapus.'
  });
}));

export default router;
