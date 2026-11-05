import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { PROFILE_UPLOAD_DIR } from '../../config/profileStorage.js';

const mimeExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, PROFILE_UPLOAD_DIR);
  },
  filename(req, file, callback) {
    const extension = mimeExtensions[file.mimetype];
    if (!extension) {
      const error = new Error('Foto harus berformat JPG, PNG, atau WebP.');
      error.status = 400;
      return callback(error);
    }
    callback(null, `${req.user.id}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1
    // fieldNameSize: 50,
    // fieldNestingDepth: 1,
    // fieldArrayIndexLimit: 10
  },
  fileFilter(_req, file, callback) {
    if (!Object.hasOwn(mimeExtensions, file.mimetype)) {
      const error = new Error('Foto harus berformat JPG, PNG, atau WebP.');
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
      console.error('Profile upload error:', {
        code: error.code,
        field: error.field,
        contentType: req.headers['content-type'],
        bodyFields: Object.keys(req.body || {}),
      });
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        success: false,
        message: error.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran foto maksimal 3 MB.'
          : 'Unggahan foto tidak valid.'
      });
    }
    return res.status(Number.isInteger(error.status) ? error.status : 400).json({
      success: false,
      message: error.message || 'Foto tidak dapat diproses.'
    });
  });
}
