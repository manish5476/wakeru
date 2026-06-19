import { Router } from 'express';
import { userController } from './user.controller';
import { AuthMiddleware } from '../auth/auth.middleware';
import { ValidationMiddleware } from '../../middleware/validation.middleware';
import {
  updateProfileSchema,
  updatePreferencesSchema,
  updateBankingDetailsSchema,
  searchUsersSchema,
  upgradeRoleSchema,
} from '../auth/auth.validation';
import multer from 'multer';
import { CONSTANTS } from '../../config/constants';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize },
  fileFilter: (_req, file, cb) => {
    const allowed = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes as readonly string[];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Profile
router.get('/profile', userController.getProfile.bind(userController));
router.put('/profile', ValidationMiddleware.validate(updateProfileSchema), userController.updateProfile.bind(userController));
router.put('/preferences', ValidationMiddleware.validate(updatePreferencesSchema), userController.updatePreferences.bind(userController));
router.put('/banking', ValidationMiddleware.validate(updateBankingDetailsSchema), userController.updateBankingDetails.bind(userController));
router.post('/profile-picture', upload.single('profilePicture'), userController.uploadProfilePicture.bind(userController));

// Account management
router.delete('/account', userController.deleteAccount.bind(userController));
router.post('/deactivate', userController.deactivateAccount.bind(userController));
router.post('/reactivate', userController.reactivateAccount.bind(userController));
router.get('/linked-accounts', userController.getLinkedAccounts.bind(userController));

// Stats
router.get('/stats', userController.getStats.bind(userController));

// Search
router.get('/search', ValidationMiddleware.validate(searchUsersSchema), userController.searchUsers.bind(userController));

// Public profile (must be after /search to avoid conflict)
router.get('/:userId', userController.getPublicProfile.bind(userController));

// Admin
router.put('/:userId/role', AuthMiddleware.authorize('admin'), ValidationMiddleware.validate(upgradeRoleSchema), userController.upgradeRole.bind(userController));

export default router;


