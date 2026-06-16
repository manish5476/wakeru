import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET and JWT_REFRESH_SECRET are not defined.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

const generateTokens = async (user: IUser) => {
  const accessTokenPayload = { userId: user.userId, role: user.role };
  const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION as any });

  const refreshTokenPayload = { userId: user.userId };
  const refreshToken = jwt.sign(refreshTokenPayload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION as any });

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  return {
    accessToken,
    refreshToken
  };
};

export const AuthService = {
  async register(userData: Partial<IUser>): Promise<IUser> {
    if (!userData.email || !userData.password) {
      throw new AppError('Email and password are required', 400);
    }

    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const user = new User({
      ...userData,
      userId: uuidv4()
    });
    await user.save();
    return user;
  },

  async login(email: string, password: string): Promise<{ user: IUser, tokens: any }> {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const tokens = await generateTokens(user);
    return { user, tokens };
  },
  
  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      const user = await User.findOne({ userId: decoded.userId });

      if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Refresh token rotation: remove the old token
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);

      const newTokens = await generateTokens(user);
      return newTokens;

    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  },
  
  async logout(userId: string, refreshToken: string): Promise<void> {
      const user = await User.findOne({ userId });
      if (user && user.refreshTokens) {
          user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
          await user.save({ validateBeforeSave: false });
      }
  },

  async googleAuth(googleToken: string): Promise<{ user: IUser, tokens: any, isNewUser: boolean }> {
    // In a real app, you would verify the googleToken with Google
    const fakeGoogleProfile = { email: 'user@google.com', firstName: 'Google', lastName: 'User', googleId: '12345' };

    let user = await User.findOne({ email: fakeGoogleProfile.email });
    let isNewUser = false;

    if (!user) {
        user = new User({
            userId: uuidv4(),
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
  
  async appleAuth(appleToken: string, extraData: { firstName?: string, lastName?: string }): Promise<{ user: IUser, tokens: any, isNewUser: boolean }> {
    // In a real app, you would verify the appleToken with Apple
    const fakeAppleProfile = { email: 'user@apple.com', appleId: '67890' };

    let user = await User.findOne({ 'authProviders.apple.id': fakeAppleProfile.appleId });
    let isNewUser = false;

    if (!user) {
        user = new User({
            userId: uuidv4(),
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
  
  async forgotPassword(email: string): Promise<void> {
      const user = await User.findOne({ email });
      if (user) {
          const resetToken = crypto.randomBytes(32).toString('hex');
          user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
          user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
          await user.save();
          // In a real app, you would email this token to the user
          console.log(`Password reset token for ${email}: ${resetToken}`);
      }
  },
  
  async resetPassword(token: string, newPassword: string): Promise<void> {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
          passwordResetToken: hashedToken,
          passwordResetExpires: { $gt: Date.now() }
      }).select('+password');
      
      if (!user) {
          throw new AppError('Invalid or expired password reset token', 400);
      }
      
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
  },
  
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
      const user = await User.findOne({ userId }).select('+password');
      
      if (!user) {
          throw new AppError('User not found', 404);
      }
      
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
          throw new AppError('Incorrect current password', 400);
      }
      
      user.password = newPassword;
      await user.save();
  }
};