import { z } from 'zod';

function optionalNullableText(max, label) {
  return z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.union([
      z.string().trim().max(max, `${label} maksimal ${max} karakter.`),
      z.null()
    ]).optional()
  );
}

const phoneSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.union([
    z.string()
      .trim()
      .min(8, 'Nomor HP minimal 8 karakter.')
      .max(20, 'Nomor HP maksimal 20 karakter.')
      .regex(/^[+0-9()\s-]+$/, 'Format nomor HP tidak valid.'),
    z.null()
  ]).optional()
);

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Nama lengkap wajib diisi.').max(100).optional(),
  nis: optionalNullableText(30, 'NIS'),
  class_name: optionalNullableText(50, 'Kelas'),
  major: optionalNullableText(100, 'Jurusan'),
  phone: phoneSchema
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu kolom profil harus diubah.' }
);
