import multer from 'multer';
import { randomUUID } from 'node:crypto';
// import { PROFILE_UPLOAD_DIR } from '../../config/profileStorage.js';

const mimeExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024,
    files: 1,
    fields: 0,
    parts: 1
  },
  fileFilter(_req, file, callback) {
    if (!Object.hasOwn(mimeExtensions, file.mimetype)) {
      const error = new Error(
        'Foto harus berformat JPG, PNG, atau WebP.'
      );
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  }
});

export function receiveProfilePhoto(req, res, next) {
  upload.single('photo')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

      return res.status(status).json({
        success: false,
        message: error.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran foto maksimal 500 KB.'
          : 'Unggahan foto tidak valid.'
      });
    }

    return res.status(
      Number.isInteger(error.status) ? error.status : 400
    ).json({
      success: false,
      message: error.message || 'Foto tidak dapat diproses.'
    });
  });
}