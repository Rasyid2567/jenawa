import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..', '..');

export const PROFILE_UPLOAD_DIR = join(backendRoot, 'uploads', 'profiles');

mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });
