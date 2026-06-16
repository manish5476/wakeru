"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const uuid_1 = require("uuid");
const auth_model_1 = require("./auth.model");
const AppError_1 = require("../../shared/errors/AppError");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("firebase-admin/auth");
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET and JWT_REFRESH_SECRET are not defined.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';
const generateTokens = async (user) => {
    const accessTokenPayload = { userId: user.userId, role: user.role, type: 'access' };
    const accessToken = jsonwebtoken_1.default.sign(accessTokenPayload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION });
    const refreshTokenPayload = { userId: user.userId, type: 'refresh' };
    const refreshToken = jsonwebtoken_1.default.sign(refreshTokenPayload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION });
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save({ validateBeforeSave: false });
    return {
        accessToken,
        refreshToken
    };
};
exports.AuthService = {
    async register(idToken, metadata) {
        try {
            const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(idToken);
            const firebaseUid = decodedToken.uid;
            const email = decodedToken.email;
            if (!email) {
                throw new AppError_1.AppError(400, 'Firebase token does not contain an email');
            }
            let user = await auth_model_1.User.findOne({ email });
            if (user) {
                throw new AppError_1.AppError(409, 'User already exists. Please login.');
            }
            // Create new user
            user = new auth_model_1.User({
                userId: (0, uuid_1.v4)(),
                firebaseUid,
                email,
                displayName: metadata?.displayName || decodedToken.name || 'User',
                profilePictureUrl: decodedToken.picture || '',
                phoneNumber: metadata?.phoneNumber || '',
            });
            await user.save();
            const tokens = await generateTokens(user);
            return { user, tokens };
        }
        catch (error) {
            if (error instanceof AppError_1.AppError)
                throw error;
            throw new AppError_1.AppError(401, 'Invalid Firebase ID token or registration failed');
        }
    },
    async login(idToken) {
        try {
            const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(idToken);
            const firebaseUid = decodedToken.uid;
            // We look up by firebaseUid. If they signed up with a different provider, 
            // they need to link it. For simplicity, we just find by firebaseUid or email.
            let user = await auth_model_1.User.findOne({ firebaseUid });
            if (!user && decodedToken.email) {
                user = await auth_model_1.User.findOne({ email: decodedToken.email });
                if (user) {
                    // Auto-link if email matches exactly
                    user.firebaseUid = firebaseUid;
                    await user.save();
                }
            }
            if (!user) {
                throw new AppError_1.AppError(404, 'User not found. Please register first.');
            }
            const tokens = await generateTokens(user);
            return { user, tokens };
        }
        catch (error) {
            if (error instanceof AppError_1.AppError)
                throw error;
            throw new AppError_1.AppError(401, 'Invalid Firebase ID token');
        }
    },
    async refreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET);
            const user = await auth_model_1.User.findOne({ userId: decoded.userId });
            if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
                throw new AppError_1.AppError(401, 'Invalid refresh token');
            }
            // Refresh token rotation: remove the old token
            user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
            const newTokens = await generateTokens(user);
            return newTokens;
        }
        catch (error) {
            throw new AppError_1.AppError(401, 'Invalid or expired refresh token');
        }
    },
    async logout(userId, refreshToken) {
        const user = await auth_model_1.User.findOne({ userId });
        if (user && user.refreshTokens) {
            user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
            await user.save({ validateBeforeSave: false });
        }
    }
};
//# sourceMappingURL=auth.service.js.map