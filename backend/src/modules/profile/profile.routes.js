import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validateBody } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { updateProfileSchema } from './profile.schemas.js';
import { receiveProfilePhoto } from './profile.upload.js';
import * as controller from './profile.controller.js';

const router = Router();

// Semua operasi profil hanya berlaku untuk akun yang ada pada token JWT.
router.use(authenticate);

router.get('/', asyncHandler(controller.getMyProfile));
router.patch('/', validateBody(updateProfileSchema), asyncHandler(controller.updateMyProfile));
router.post('/photo', receiveProfilePhoto, asyncHandler(controller.uploadMyProfilePhoto));
router.delete('/photo', asyncHandler(controller.deleteMyProfilePhoto));

export default router;
