
import { z } from 'zod';

export const exerciseIdSchema = z.object({
  id: z.coerce.number().int().positive()
});
