import { pool } from '../../db/pool.js';

const PROFILE_COLUMNS = `
  id, name, email, nis, class_name, major, phone,
  profile_photo_url, created_at, updated_at
`;

export async function findProfileById(userId) {
  const result = await pool.query(
    `SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function updateProfile(userId, profile) {
  const allowedFields = ['name', 'nis', 'class_name', 'major', 'phone'];
  const assignments = [];
  const values = [];
  let index = 1;

  for (const field of allowedFields) {
    if (profile[field] !== undefined) {
      assignments.push(`${field} = $${index++}`);
      values.push(profile[field]);
    }
  }

  if (assignments.length === 0) {
    return findProfileById(userId);
  }

  assignments.push('updated_at = NOW()');
  values.push(userId);

  const result = await pool.query(
    `UPDATE users
     SET ${assignments.join(', ')}
     WHERE id = $${index}
     RETURNING ${PROFILE_COLUMNS}`,
    values
  );

  return result.rows[0] ?? null;
}

export async function updateProfilePhoto(userId, photoUrl) {
  const result = await pool.query(
    `UPDATE users
     SET profile_photo_url = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING ${PROFILE_COLUMNS}`,
    [photoUrl, userId]
  );
  return result.rows[0] ?? null;
}
