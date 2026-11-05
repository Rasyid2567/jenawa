import { readFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import * as repository from './profile.repository.js';
import { PROFILE_UPLOAD_DIR } from '../../config/profileStorage.js';

function profileNotFound(res) {
  return res.status(404).json({ success: false, message: 'Profil pengguna tidak ditemukan.' });
}

function isExpectedImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

async function deleteManagedPhoto(photoUrl) {
  if (typeof photoUrl !== 'string' || !photoUrl.startsWith('/uploads/profiles/')) return;
  const filename = basename(photoUrl);
  if (!filename || filename === '.' || filename === '..') return;
  try {
    await unlink(join(PROFILE_UPLOAD_DIR, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Gagal membersihkan file foto profil lama.');
  }
}

function handleProfileDatabaseError(error, res, next) {
  if (error.code === '23505' && (error.constraint === 'uq_users_nis' || String(error.constraint || '').includes('nis'))) {
    return res.status(409).json({ success: false, message: 'NIS tersebut sudah digunakan akun lain.' });
  }
  return next(error);
}

export async function getMyProfile(req, res, next) {
  try {
    const profile = await repository.findProfileById(req.user.id);
    if (!profile) return profileNotFound(res);
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const profile = await repository.updateProfile(req.user.id, req.validatedBody);
    if (!profile) return profileNotFound(res);
    return res.json({ success: true, message: 'Profil berhasil diperbarui.', data: profile });
  } catch (error) {
    return handleProfileDatabaseError(error, res, next);
  }
}

export async function uploadMyProfilePhoto(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Pilih foto terlebih dahulu.' });
  }

  const newPhotoUrl = `/uploads/profiles/${req.file.filename}`;
  try {
    const bytes = await readFile(req.file.path);
    if (!isExpectedImage(bytes, req.file.mimetype)) {
      await unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'Isi file bukan gambar JPG, PNG, atau WebP yang valid.' });
    }

    const current = await repository.findProfileById(req.user.id);
    if (!current) {
      await unlink(req.file.path).catch(() => {});
      return profileNotFound(res);
    }

    const updated = await repository.updateProfilePhoto(req.user.id, newPhotoUrl);
    if (!updated) {
      await unlink(req.file.path).catch(() => {});
      return profileNotFound(res);
    }

    if (current.profile_photo_url && current.profile_photo_url !== newPhotoUrl) {
      await deleteManagedPhoto(current.profile_photo_url);
    }

    return res.status(200).json({
      success: true,
      message: 'Foto profil berhasil diperbarui.',
      data: updated
    });
  } catch (error) {
    await unlink(req.file.path).catch(() => {});
    return next(error);
  }
}

export async function deleteMyProfilePhoto(req, res, next) {
  try {
    const current = await repository.findProfileById(req.user.id);
    if (!current) return profileNotFound(res);
    const updated = await repository.updateProfilePhoto(req.user.id, null);
    await deleteManagedPhoto(current.profile_photo_url);
    return res.json({ success: true, message: 'Foto profil berhasil dihapus.', data: updated });
  } catch (error) {
    return next(error);
  }
}
