
import { z } from 'zod';

const nullablePositiveId = z.union([
  z.coerce.number().int().positive(),
  z.null()
]);

export const createJournalSchema = z.object({
  emotion_log_id: nullablePositiveId.optional(),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string()
    .trim()
    .min(1, 'Isi jurnal wajib diisi.')
    .max(20000, 'Isi jurnal maksimal 20.000 karakter.'),
  reflection: z.string().trim().max(10000).nullable().optional()
});

export const updateJournalSchema = z.object({
  emotion_log_id: nullablePositiveId.optional(),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string()
    .trim()
    .min(1)
    .max(20000)
    .optional(),
  reflection: z.string().trim().max(10000).nullable().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu kolom harus diubah.' }
);
