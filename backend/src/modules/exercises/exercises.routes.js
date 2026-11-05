
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

// Hanya latihan aktif yang ditampilkan ke pengguna.
router.get('/', asyncHandler(async (req, res) => {
  const category = typeof req.query.category === 'string'
    ? req.query.category.trim().slice(0, 50)
    : '';

  const result = await pool.query(`
    SELECT
      id,
      title,
      description,
      category,
      duration_minutes,
      instructions
    FROM relaxation_exercises
    WHERE is_active = TRUE
      AND ($1 = '' OR category = $1)
    ORDER BY category, title
  `, [category]);

  res.json({
    success: true,
    data: result.rows
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID latihan tidak valid.'
    });
  }

  const result = await pool.query(`
    SELECT
      id,
      title,
      description,
      category,
      duration_minutes,
      instructions
    FROM relaxation_exercises
    WHERE id = $1 AND is_active = TRUE
  `, [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Latihan tidak ditemukan.'
    });
  }

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

export default router;
