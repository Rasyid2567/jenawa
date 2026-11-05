
import { z } from 'zod';

export const createEmotionSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  trigger_id: z.coerce.number().int().positive().nullable().optional(),
  intensity: z.coerce.number().int().min(1).max(5).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional()
});

export const updateEmotionSchema = z.object({
  category_id: z.coerce.number().int().positive().optional(),
  trigger_id: z.union([
    z.coerce.number().int().positive(),
    z.null()
  ]).optional(),
  intensity: z.union([
    z.coerce.number().int().min(1).max(5),
    z.null()
  ]).optional(),
  note: z.union([
    z.string().trim().max(2000),
    z.null()
  ]).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu kolom harus diubah.' }
);
