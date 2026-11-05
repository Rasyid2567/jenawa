import { z } from 'zod';

export const createSessionSchema = z.object({
  exercise_id: z.number().int().positive().nullable().optional(),
  session_type: z.enum([
    'breathing',
    'focus',
    'relaxation',
    'custom'
  ]),
  duration_seconds: z.number().int().min(0).max(86400),
  completed: z.boolean().default(false)
}).refine(
  (data) => !data.completed || data.duration_seconds > 0,
  {
    message: 'Sesi yang selesai harus memiliki durasi lebih dari 0 detik.',
    path: ['duration_seconds']
  }
);

export const updateSessionSchema = z.object({
  duration_seconds: z.number().int().min(0).max(86400).optional(),
  completed: z.boolean().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu kolom harus diubah.' }
).refine(
  (data) => !(data.completed === true && data.duration_seconds === 0),
  {
    message: 'Sesi yang selesai harus memiliki durasi lebih dari 0 detik.',
    path: ['duration_seconds']
  }
);
