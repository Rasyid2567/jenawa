
import { z } from 'zod';

const emailSchema = z.string()
  .trim()
  .email('Format email tidak valid.')
  .max(254)
  .transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: z.string()
    .min(12, 'Kata sandi minimal 12 karakter.')
    .max(72, 'Kata sandi maksimal 72 byte.')
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72)
});
