
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { validateBody } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createEmotionSchema,
  updateEmotionSchema
} from './emotions.schemas.js';

const router = Router();

router.use(authenticate);

// Daftar kategori perasaan yang aktif.
router.get('/categories', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, name, icon, color
    FROM emotion_categories
    WHERE is_active = TRUE
    ORDER BY name
  `);

  res.json({ success: true, data: result.rows });
}));

// Daftar pemicu perasaan yang aktif.
router.get('/triggers', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, name
    FROM emotion_triggers
    WHERE is_active = TRUE
    ORDER BY name
  `);

  res.json({ success: true, data: result.rows });
}));

// Membuat catatan perasaan.
router.post(
  '/',
  validateBody(createEmotionSchema),
  asyncHandler(async (req, res) => {
    const {
      category_id,
      trigger_id = null,
      intensity = null,
      note = null
    } = req.validatedBody;

    const category = await pool.query(`
      SELECT id
      FROM emotion_categories
      WHERE id = $1 AND is_active = TRUE
    `, [category_id]);

    if (category.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Kategori perasaan tidak valid atau tidak aktif.'
      });
    }

    if (trigger_id != null) {
      const trigger = await pool.query(`
        SELECT id
        FROM emotion_triggers
        WHERE id = $1 AND is_active = TRUE
      `, [trigger_id]);

      if (trigger.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Pemicu perasaan tidak valid atau tidak aktif.'
        });
      }
    }

    const result = await pool.query(`
      INSERT INTO emotion_logs
        (user_id, category_id, trigger_id, intensity, note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, category_id, trigger_id,
                intensity, note, created_at
    `, [
      req.user.id,
      category_id,
      trigger_id,
      intensity,
      note
    ]);

    res.status(201).json({
      success: true,
      message: 'Catatan perasaan berhasil dibuat.',
      data: result.rows[0]
    });
  })
);

// Riwayat perasaan pengguna yang sedang login.
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
      e.id,
      e.category_id,
      c.name AS category_name,
      c.icon AS category_icon,
      e.trigger_id,
      t.name AS trigger_name,
      e.intensity,
      e.note,
      e.created_at
    FROM emotion_logs e
    JOIN emotion_categories c ON c.id = e.category_id
    LEFT JOIN emotion_triggers t ON t.id = e.trigger_id
    WHERE e.user_id = $1
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT $2 OFFSET $3
  `, [req.user.id, limit, offset]);

  res.json({
    success: true,
    data: result.rows,
    pagination: { limit, offset }
  });
}));

// Detail catatan hanya dapat dibaca pemiliknya.
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID perasaan tidak valid.'
    });
  }

  const result = await pool.query(`
    SELECT
      e.id,
      e.category_id,
      c.name AS category_name,
      e.trigger_id,
      t.name AS trigger_name,
      e.intensity,
      e.note,
      e.created_at
    FROM emotion_logs e
    JOIN emotion_categories c ON c.id = e.category_id
    LEFT JOIN emotion_triggers t ON t.id = e.trigger_id
    WHERE e.id = $1 AND e.user_id = $2
  `, [id, req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Catatan perasaan tidak ditemukan.'
    });
  }

  res.json({ success: true, data: result.rows[0] });
}));

// Mengubah catatan hanya jika ID dimiliki pengguna.
router.patch(
  '/:id',
  validateBody(updateEmotionSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID perasaan tidak valid.'
      });
    }

    const input = req.validatedBody;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const owned = await client.query(`
        SELECT id
        FROM emotion_logs
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `, [id, req.user.id]);

      if (owned.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Catatan perasaan tidak ditemukan.'
        });
      }

      if (input.category_id !== undefined) {
        const category = await client.query(`
          SELECT id
          FROM emotion_categories
          WHERE id = $1 AND is_active = TRUE
        `, [input.category_id]);

        if (category.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Kategori perasaan tidak valid atau tidak aktif.'
          });
        }
      }

      if (input.trigger_id != null) {
        const trigger = await client.query(`
          SELECT id
          FROM emotion_triggers
          WHERE id = $1 AND is_active = TRUE
        `, [input.trigger_id]);

        if (trigger.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Pemicu perasaan tidak valid atau tidak aktif.'
          });
        }
      }

      const fields = [];
      const values = [];
      let index = 1;

      for (const key of [
        'category_id',
        'trigger_id',
        'intensity',
        'note'
      ]) {
        if (input[key] !== undefined) {
          fields.push(`${key} = $${index++}`);
          values.push(input[key]);
        }
      }

      values.push(id, req.user.id);

      const result = await client.query(`
        UPDATE emotion_logs
        SET ${fields.join(', ')}
        WHERE id = $${index} AND user_id = $${index + 1}
        RETURNING id, category_id, trigger_id,
                  intensity, note, created_at
      `, values);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Catatan perasaan berhasil diperbarui.',
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

// Menghapus catatan hanya jika ID dimiliki pengguna.
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID perasaan tidak valid.'
    });
  }

  const result = await pool.query(`
    DELETE FROM emotion_logs
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [id, req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Catatan perasaan tidak ditemukan.'
    });
  }

  res.json({
    success: true,
    message: 'Catatan perasaan berhasil dihapus.'
  });
}));

export default router;
