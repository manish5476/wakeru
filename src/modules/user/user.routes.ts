import { Router } from 'express';
import { userController } from './user.controller';
import { AuthMiddleware } from '../auth/auth.middleware';
import multer from 'multer';
import { CONSTANTS } from '../../config/constants';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize
  },
  fileFilter: (req, file, cb) => {
    if ((CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Profile routes
router.get('/profile', userController.getProfile.bind(userController));
router.put('/profile', userController.updateProfile.bind(userController));
router.put('/preferences', userController.updatePreferences.bind(userController));
router.put('/banking-details', userController.updateBankingDetails.bind(userController));
router.post('/profile-picture', upload.single('profilePicture'), userController.uploadProfilePicture.bind(userController));

// Account management
router.delete('/account', userController.deleteAccount.bind(userController));
router.post('/deactivate', userController.deactivateAccount.bind(userController));
router.post('/reactivate', userController.reactivateAccount.bind(userController));
router.get('/linked-accounts', userController.getLinkedAccounts.bind(userController));

// Stats
router.get('/stats', userController.getStats.bind(userController));

// Search
router.get('/search', userController.searchUsers.bind(userController));

// Public profile
router.get('/:userId', userController.getUserById.bind(userController));

// Admin routes
router.put('/:userId/role', AuthMiddleware.authorize('admin'), userController.upgradeRole.bind(userController));

export default router;