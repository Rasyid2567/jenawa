
import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [
    userResult,
    emotionStats,
    journalStats,
    sessionStats,
    latestEmotion,
    weeklyEmotions,
    exercises
  ] = await Promise.all([
    pool.query(`
      SELECT name
      FROM users
      WHERE id = $1
    `, [userId]),

    pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE created_at >= CURRENT_DATE
            AND created_at < CURRENT_DATE + INTERVAL '1 day'
        )::int AS today_count,
        COUNT(*)::int AS total_count
      FROM emotion_logs
      WHERE user_id = $1
    `, [userId]),

    pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE created_at >= CURRENT_DATE
            AND created_at < CURRENT_DATE + INTERVAL '1 day'
        )::int AS today_count,
        COUNT(*)::int AS total_count
      FROM journals
      WHERE user_id = $1
    `, [userId]),

    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE completed = TRUE)::int
          AS completed_count,
        COALESCE(
          SUM(duration_seconds) FILTER (WHERE completed = TRUE),
          0
        )::bigint AS completed_duration_seconds,
        COUNT(*) FILTER (
          WHERE completed = TRUE
            AND created_at >= CURRENT_DATE
            AND created_at < CURRENT_DATE + INTERVAL '1 day'
        )::int AS completed_today
      FROM relaxation_sessions
      WHERE user_id = $1
    `, [userId]),

    pool.query(`
      SELECT
        e.id,
        c.name AS emotion_name,
        c.icon AS emotion_icon,
        e.intensity,
        e.note,
        e.created_at
      FROM emotion_logs e
      JOIN emotion_categories c ON c.id = e.category_id
      WHERE e.user_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 1
    `, [userId]),

    pool.query(`
      SELECT
        (created_at::date) AS date,
        COUNT(*)::int AS count
      FROM emotion_logs
      WHERE user_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '6 days'
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY created_at::date
      ORDER BY date
    `, [userId]),

    pool.query(`
      SELECT id, title, description, category,
             duration_minutes, instructions
      FROM relaxation_exercises
      WHERE is_active = TRUE
      ORDER BY title
      LIMIT 3
    `)
  ]);

  res.json({
    success: true,
    data: {
      user: userResult.rows[0] ?? null,

      emotions: {
        today: emotionStats.rows[0].today_count,
        total: emotionStats.rows[0].total_count,
        latest: latestEmotion.rows[0] ?? null,
        lastSevenDays: weeklyEmotions.rows
      },

      journals: {
        today: journalStats.rows[0].today_count,
        total: journalStats.rows[0].total_count
      },

      relaxation: {
        completedToday: sessionStats.rows[0].completed_today,
        completedTotal: sessionStats.rows[0].completed_count,
        completedDurationSeconds: Number(
          sessionStats.rows[0].completed_duration_seconds
        )
      },

      recommendedExercises: exercises.rows
    }
  });
}));

export default router;
