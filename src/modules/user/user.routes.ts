import { Router } from 'express';
import { userController } from './user.controller';
import { protect, authorize } from '../auth/auth.middleware'; // FIX: single unified middleware
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

// ── Multer (profile picture uploads) ───────────────────────────────────────────
// FIX: fileFilter now passes a proper multer error (not a generic Error) so
// the global errorHandler can identify and return a clean 400 response.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize,
    files: 1, // FIX: explicitly cap at 1 file per request
  },
  fileFilter: (_req, file, cb) => {
    const allowed = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE
      .allowedTypes as readonly string[];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Pass a MulterError so the errorHandler returns a clean 400
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      (err as any).message = `Invalid file type. Allowed: ${allowed.join(', ')}`;
      cb(err as unknown as null, false);
    }
  },
});

// ── Global auth guard for all routes in this router ────────────────────────────
router.use(protect);

// ── Profile ─────────────────────────────────────────────────────────────────────
router.get(
  '/profile',
  userController.getProfile.bind(userController)
);

router.put(
  '/profile',
  ValidationMiddleware.validate(updateProfileSchema),
  userController.updateProfile.bind(userController)
);

router.put(
  '/preferences',
  ValidationMiddleware.validate(updatePreferencesSchema),
  userController.updatePreferences.bind(userController)
);

router.put(
  '/banking',
  ValidationMiddleware.validate(updateBankingDetailsSchema),
  userController.updateBankingDetails.bind(userController)
);

router.post(
  '/profile-picture',
  upload.single('profilePicture'),
  userController.uploadProfilePicture.bind(userController)
);

// ── Account management ──────────────────────────────────────────────────────────
router.delete(
  '/account',
  userController.deleteAccount.bind(userController)
);

router.post(
  '/deactivate',
  userController.deactivateAccount.bind(userController)
);

router.post(
  '/reactivate',
  userController.reactivateAccount.bind(userController)
);

router.get(
  '/linked-accounts',
  userController.getLinkedAccounts.bind(userController)
);

// ── Stats ────────────────────────────────────────────────────────────────────────
router.get(
  '/stats',
  userController.getStats.bind(userController)
);

// ── Search ───────────────────────────────────────────────────────────────────────
// FIX: Must be defined BEFORE /:userId to avoid "search" being treated as a userId
router.get(
  '/search',
  ValidationMiddleware.validateQuery(searchUsersSchema),
  userController.searchUsers.bind(userController)
);

// ── Public profile ───────────────────────────────────────────────────────────────
// Keep AFTER /search, /stats, /linked-accounts to avoid param conflicts
router.get(
  '/:userId',
  userController.getPublicProfile.bind(userController)
);

// ── Admin ────────────────────────────────────────────────────────────────────────
router.put(
  '/:userId/role',
  authorize('admin'),
  ValidationMiddleware.validate(upgradeRoleSchema),
  userController.upgradeRole.bind(userController)
);

export default router;
// import { Router } from 'express';
// import { userController } from './user.controller';
// import { AuthMiddleware } from '../auth/auth.middleware';
// import { ValidationMiddleware } from '../../middleware/validation.middleware';
// import {
//   updateProfileSchema,
//   updatePreferencesSchema,
//   updateBankingDetailsSchema,
//   searchUsersSchema,
//   upgradeRoleSchema,
// } from '../auth/auth.validation';
// import multer from 'multer';
// import { CONSTANTS } from '../../config/constants';

// const router = Router();
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize },
//   fileFilter: (_req, file, cb) => {
//     const allowed = CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes as readonly string[];
//     if (allowed.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type'));
//     }
//   },
// });

// // All routes require authentication
// router.use(AuthMiddleware.authenticate);

// // Profile
// router.get('/profile', userController.getProfile.bind(userController));
// router.put('/profile', ValidationMiddleware.validate(updateProfileSchema), userController.updateProfile.bind(userController));
// router.put('/preferences', ValidationMiddleware.validate(updatePreferencesSchema), userController.updatePreferences.bind(userController));
// router.put('/banking', ValidationMiddleware.validate(updateBankingDetailsSchema), userController.updateBankingDetails.bind(userController));
// router.post('/profile-picture', upload.single('profilePicture'), userController.uploadProfilePicture.bind(userController));

// // Account management
// router.delete('/account', userController.deleteAccount.bind(userController));
// router.post('/deactivate', userController.deactivateAccount.bind(userController));
// router.post('/reactivate', userController.reactivateAccount.bind(userController));
// router.get('/linked-accounts', userController.getLinkedAccounts.bind(userController));

// // Stats
// router.get('/stats', userController.getStats.bind(userController));

// // Search
// router.get('/search', ValidationMiddleware.validateQuery(searchUsersSchema), userController.searchUsers.bind(userController));

// // Public profile (must be after /search to avoid conflict)
// router.get('/:userId', userController.getPublicProfile.bind(userController));

// // Admin
// router.put('/:userId/role', AuthMiddleware.authorize('admin'), ValidationMiddleware.validate(upgradeRoleSchema), userController.upgradeRole.bind(userController));

// export default router;


