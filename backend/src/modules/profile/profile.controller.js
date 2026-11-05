import { randomUUID } from 'node:crypto';
import * as repository from './profile.repository.js';
import { supabase, PROFILE_BUCKET } from '../../config/supabase.js';

const SIGNED_URL_EXPIRY = 60 * 60;

const mimeExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function profileNotFound(res) {
  return res.status(404).json({
    success: false,
    message: 'Profil pengguna tidak ditemukan.'
  });
}

function isExpectedImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );
  }

  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  return false;
}

async function createProfileResponse(profile) {
  if (!profile || !profile.profile_photo_url) {
    return profile;
  }

  const path = profile.profile_photo_url;

  // Kompatibilitas dengan URL foto lama.
  if (path.startsWith('/uploads/profiles/')) {
    return profile;
  }

  const { data, error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) throw error;

  return {
    ...profile,
    profile_photo_url: data.signedUrl
  };
}

async function deleteManagedPhoto(path) {
  if (
    typeof path !== 'string' ||
    !path.startsWith('profiles/')
  ) {
    return;
  }

  const { error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .remove([path]);

  if (error) throw error;
}

function handleProfileDatabaseError(error, res, next) {
  if (
    error.code === '23505' &&
    (
      error.constraint === 'uq_users_nis' ||
      String(error.constraint || '').includes('nis')
    )
  ) {
    return res.status(409).json({
      success: false,
      message: 'NIS tersebut sudah digunakan akun lain.'
    });
  }

  return next(error);
}

export async function getMyProfile(req, res, next) {
  try {
    const profile = await repository.findProfileById(req.user.id);

    if (!profile) return profileNotFound(res);

    const data = await createProfileResponse(profile);

    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const profile = await repository.updateProfile(
      req.user.id,
      req.validatedBody
    );

    if (!profile) return profileNotFound(res);

    const data = await createProfileResponse(profile);

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data
    });
  } catch (error) {
    return handleProfileDatabaseError(error, res, next);
  }
}

export async function uploadMyProfilePhoto(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Pilih foto terlebih dahulu.'
    });
  }

  const { buffer, mimetype } = req.file;

  if (!isExpectedImage(buffer, mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Isi file bukan gambar JPG, PNG, atau WebP yang valid.'
    });
  }

  const current = await repository.findProfileById(req.user.id)
    .catch((error) => {
      next(error);
      return null;
    });

  if (res.headersSent) return;
  if (!current) return profileNotFound(res);

  const extension = mimeExtensions[mimetype];
  const filePath = `profiles/${req.user.id}/${randomUUID()}${extension}`;

  let uploaded = false;
  let databaseUpdated = false;

  try {
    const { error } = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    uploaded = true;

    const updated = await repository.updateProfilePhoto(
      req.user.id,
      filePath
    );

    if (!updated) {
      await deleteManagedPhoto(filePath);
      uploaded = false;
      return profileNotFound(res);
    }

    databaseUpdated = true;

    if (
      current.profile_photo_url &&
      current.profile_photo_url !== filePath
    ) {
      await deleteManagedPhoto(current.profile_photo_url)
        .catch(() => {});
    }

    const data = await createProfileResponse(updated);

    return res.json({
      success: true,
      message: 'Foto profil berhasil diperbarui.',
      data
    });
  } catch (error) {
    if (uploaded && !databaseUpdated) {
      await deleteManagedPhoto(filePath).catch(() => {});
    }

    return next(error);
  }
}

export async function deleteMyProfilePhoto(req, res, next) {
  try {
    const current = await repository.findProfileById(req.user.id);

    if (!current) return profileNotFound(res);

    const updated = await repository.updateProfilePhoto(
      req.user.id,
      null
    );

    if (!updated) return profileNotFound(res);

    await deleteManagedPhoto(current.profile_photo_url);

    return res.json({
      success: true,
      message: 'Foto profil berhasil dihapus.',
      data: updated
    });
  } catch (error) {
    return next(error);
  }
}