"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const validation_middleware_1 = require("../../middleware/validation.middleware");
const auth_validation_1 = require("../auth/auth.validation");
const multer_1 = __importDefault(require("multer"));
const constants_1 = require("../../config/constants");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: constants_1.CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.maxSize },
    fileFilter: (_req, file, cb) => {
        const allowed = constants_1.CONSTANTS.UPLOAD_LIMITS.PROFILE_IMAGE.allowedTypes;
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    },
});
// All routes require authentication
router.use(auth_middleware_1.AuthMiddleware.authenticate);
// Profile
router.get('/profile', user_controller_1.userController.getProfile.bind(user_controller_1.userController));
router.put('/profile', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.updateProfileSchema), user_controller_1.userController.updateProfile.bind(user_controller_1.userController));
router.put('/preferences', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.updatePreferencesSchema), user_controller_1.userController.updatePreferences.bind(user_controller_1.userController));
router.put('/banking', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.updateBankingDetailsSchema), user_controller_1.userController.updateBankingDetails.bind(user_controller_1.userController));
router.post('/profile-picture', upload.single('profilePicture'), user_controller_1.userController.uploadProfilePicture.bind(user_controller_1.userController));
// Account management
router.delete('/account', user_controller_1.userController.deleteAccount.bind(user_controller_1.userController));
router.post('/deactivate', user_controller_1.userController.deactivateAccount.bind(user_controller_1.userController));
router.post('/reactivate', user_controller_1.userController.reactivateAccount.bind(user_controller_1.userController));
router.get('/linked-accounts', user_controller_1.userController.getLinkedAccounts.bind(user_controller_1.userController));
// Stats
router.get('/stats', user_controller_1.userController.getStats.bind(user_controller_1.userController));
// Search
router.get('/search', validation_middleware_1.ValidationMiddleware.validateQuery(auth_validation_1.searchUsersSchema), user_controller_1.userController.searchUsers.bind(user_controller_1.userController));
// Public profile (must be after /search to avoid conflict)
router.get('/:userId', user_controller_1.userController.getPublicProfile.bind(user_controller_1.userController));
// Admin
router.put('/:userId/role', auth_middleware_1.AuthMiddleware.authorize('admin'), validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.upgradeRoleSchema), user_controller_1.userController.upgradeRole.bind(user_controller_1.userController));
exports.default = router;
//# sourceMappingURL=user.routes.js.map