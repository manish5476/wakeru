import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import crypto from 'crypto';

// Placeholder for a real token generation service (e.g., JWT)
const generateTokens = async (user: IUser) => {
  return {
    accessToken: 'sample-access-token',
    refreshToken: 'sample-refresh-token'
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
    // In a real app, you would send a verification email here
    user.generateVerificationToken(); 
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

    if (!user.isVerified) {
        throw new AppError('Please verify your email before logging in.', 403);
    }

    const tokens = await generateTokens(user);
    return { user, tokens };
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
  
  async refreshToken(refreshToken: string): Promise<any> {
    // In a real app, you'd verify the refresh token and issue a new access token
    return {
        accessToken: 'new-sample-access-token',
        refreshToken: refreshToken, // Or a new refresh token
    };
  },
  
  async logout(userId: string, refreshToken: string): Promise<void> {
      // In a real app, you would invalidate the refresh token in the database
      const user = await User.findById(userId);
      if (user && user.refreshTokens) {
          user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
          await user.save();
      }
  },

  async verifyEmail(token: string): Promise<void> {
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
  },
  
  async forgotPassword(email: string): Promise<void> {
      const user = await User.findOne({ email });
      if (user) {
          // In a real app, you'd generate a proper reset token and email it
          const resetToken = crypto.randomBytes(32).toString('hex');
          user.passwordResetToken = resetToken;
          user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
          await user.save();
          console.log(`Password reset token for ${email}: ${resetToken}`);
      }
  },
  
  async resetPassword(token: string, newPassword: string): Promise<void> {
      const user = await User.findOne({
          passwordResetToken: token,
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
      const user = await User.findById(userId).select('+password');
      
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