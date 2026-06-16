"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const uuid_1 = require("uuid");
const auth_model_1 = require("./auth.model");
const AppError_1 = require("../../shared/errors/AppError");
const crypto_1 = __importDefault(require("crypto"));
// Placeholder for a real token generation service (e.g., JWT)
const generateTokens = async (user) => {
    return {
        accessToken: 'sample-access-token',
        refreshToken: 'sample-refresh-token'
    };
};
exports.AuthService = {
    async register(userData) {
        if (!userData.email || !userData.password) {
            throw new AppError_1.AppError('Email and password are required', 400);
        }
        const existingUser = await auth_model_1.User.findOne({ email: userData.email });
        if (existingUser) {
            throw new AppError_1.AppError('User with this email already exists', 409);
        }
        const user = new auth_model_1.User({
            ...userData,
            userId: (0, uuid_1.v4)()
        });
        // In a real app, you would send a verification email here
        // user.generateVerificationToken(); 
        await user.save();
        return user;
    },
    async login(email, password) {
        const user = await auth_model_1.User.findOne({ email }).select('+password');
        if (!user) {
            throw new AppError_1.AppError('Invalid credentials', 401);
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new AppError_1.AppError('Invalid credentials', 401);
        }
        /* if (!user.isVerified) {
            throw new AppError('Please verify your email before logging in.', 403);
        } */
        const tokens = await generateTokens(user);
        return { user, tokens };
    },
    async googleAuth(googleToken) {
        // In a real app, you would verify the googleToken with Google
        const fakeGoogleProfile = { email: 'user@google.com', firstName: 'Google', lastName: 'User', googleId: '12345' };
        let user = await auth_model_1.User.findOne({ email: fakeGoogleProfile.email });
        let isNewUser = false;
        if (!user) {
            user = new auth_model_1.User({
                userId: (0, uuid_1.v4)(),
                email: fakeGoogleProfile.email,
                firstName: fakeGoogleProfile.firstName,
                lastName: fakeGoogleProfile.lastName,
                isVerified: true,
                authProviders: { google: { id: fakeGoogleProfile.googleId } }
            });
            await user.save();
            isNewUser = true;
        }
        const tokens = await generateTokens(user);
        return { user, tokens, isNewUser };
    },
    async appleAuth(appleToken, extraData) {
        // In a real app, you would verify the appleToken with Apple
        const fakeAppleProfile = { email: 'user@apple.com', appleId: '67890' };
        let user = await auth_model_1.User.findOne({ 'authProviders.apple.id': fakeAppleProfile.appleId });
        let isNewUser = false;
        if (!user) {
            user = new auth_model_1.User({
                userId: (0, uuid_1.v4)(),
                email: fakeAppleProfile.email, // This might not be available from Apple initially
                firstName: extraData.firstName || 'Apple',
                lastName: extraData.lastName || 'User',
                isVerified: true,
                authProviders: { apple: { id: fakeAppleProfile.appleId } }
            });
            await user.save();
            isNewUser = true;
        }
        const tokens = await generateTokens(user);
        return { user, tokens, isNewUser };
    },
    async refreshToken(refreshToken) {
        // In a real app, you'd verify the refresh token and issue a new access token
        return {
            accessToken: 'new-sample-access-token',
            refreshToken: refreshToken, // Or a new refresh token
        };
    },
    async logout(userId, refreshToken) {
        // In a real app, you would invalidate the refresh token in the database
        const user = await auth_model_1.User.findById(userId);
        if (user && user.refreshTokens) {
            user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
            await user.save();
        }
    },
    /* async verifyEmail(token: string): Promise<void> {
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() },
      });
  
      if (!user) {
        throw new AppError('Invalid or expired verification token', 400);
      }
  
      user.isVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
    }, */
    async forgotPassword(email) {
        const user = await auth_model_1.User.findOne({ email });
        if (user) {
            // In a real app, you'd generate a proper reset token and email it
            const resetToken = crypto_1.default.randomBytes(32).toString('hex');
            user.passwordResetToken = resetToken;
            user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            await user.save();
            console.log(`Password reset token for ${email}: ${resetToken}`);
        }
    },
    async resetPassword(token, newPassword) {
        const user = await auth_model_1.User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        }).select('+password');
        if (!user) {
            throw new AppError_1.AppError('Invalid or expired password reset token', 400);
        }
        user.password = newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
    },
    async changePassword(userId, currentPassword, newPassword) {
        const user = await auth_model_1.User.findById(userId).select('+password');
        if (!user) {
            throw new AppError_1.AppError('User not found', 404);
        }
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            throw new AppError_1.AppError('Incorrect current password', 400);
        }
        user.password = newPassword;
        await user.save();
    }
};
//# sourceMappingURL=auth.service.js.map