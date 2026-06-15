import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from './auth.model';
import { config } from '../../config';
import { 
  AppError, 
  UnauthorizedError, 
  NotFoundError, 
  ConflictError,
  BadRequestError 
} from '../../shared/errors/AppError';
import { CreateUserDTO, UserLoginDTO, AuthTokens } from '../../shared/types/user.types';
import { logger } from '../../config/logger';
import { OAuth2Client } from 'google-auth-library';

export class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  }

  /**
   * Register new user with email and password
   */
  async register(userData: CreateUserDTO): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create new user
    const user = new User({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phoneNumber: userData.phoneNumber,
      preferences: {
        defaultCurrency: userData.defaultCurrency || 'INR',
      },
      authProviders: {
        email: {
          verified: false,
        }
      }
    });

    // Generate verification token
    const verificationToken = user.generateVerificationToken();

    await user.save();

    // Generate auth tokens
    const tokens = await this.generateTokens(user);

    // Send verification email (async)
    this.sendVerificationEmail(user.email, verificationToken).catch(err => {
      logger.error('Failed to send verification email:', err);
    });

    logger.info(`New user registered: ${user.email}`);

    return { user: user.toObject(), tokens };
  }

  /**
   * Login with email and password
   */
  async login(loginData: UserLoginDTO): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Find user and include password field
    const user = await User.findOne({ email: loginData.email }).select('+password');
    
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    if (user.isDeleted) {
      throw new UnauthorizedError('Account has been deleted');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(loginData.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.stats.lastActiveAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    logger.info(`User logged in: ${user.email}`);

    return { user: user.toObject(), tokens };
  }

  /**
   * Google OAuth authentication
   */
  async googleAuth(googleToken: string): Promise<{ user: IUser; tokens: AuthTokens; isNewUser: boolean }> {
    try {
      // Verify Google token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleToken,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedError('Invalid Google token');
      }

      // Check if user exists with Google ID
      let user = await User.findOne({ 'authProviders.google.id': payload.sub });
      
      let isNewUser = false;

      if (!user) {
        // Check if user exists with same email
        user = await User.findOne({ email: payload.email });

        if (user) {
          // Link Google account to existing user
          user.authProviders.google = {
            id: payload.sub,
            email: payload.email,
          };
          user.isVerified = true;
          await user.save();
        } else {
          // Create new user
          isNewUser = true;
          user = new User({
            email: payload.email,
            firstName: payload.given_name || '',
            lastName: payload.family_name || '',
            displayName: payload.name || '',
            profilePicture: payload.picture || '',
            isVerified: true,
            authProviders: {
              google: {
                id: payload.sub,
                email: payload.email,
              },
              email: {
                verified: true,
              }
            }
          });
          await user.save();
        }
      }

      // Update last login
      user.lastLoginAt = new Date();
      user.stats.lastActiveAt = new Date();
      await user.save();

      // Generate tokens
      const tokens = await this.generateTokens(user);

      logger.info(`Google auth login: ${user.email}`);

      return { user: user.toObject(), tokens, isNewUser };
    } catch (error) {
      logger.error('Google auth error:', error);
      throw new UnauthorizedError('Google authentication failed');
    }
  }

  /**
   * Apple OAuth authentication
   */
  async appleAuth(appleToken: string, fullName?: { firstName?: string; lastName?: string }): Promise<{ user: IUser; tokens: AuthTokens; isNewUser: boolean }> {
    try {
      // Verify Apple token (simplified - use apple-signin-auth package)
      const decoded = jwt.decode(appleToken) as any;
      
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedError('Invalid Apple token');
      }

      let user = await User.findOne({ 'authProviders.apple.id': decoded.sub });
      let isNewUser = false;

      if (!user) {
        if (decoded.email) {
          user = await User.findOne({ email: decoded.email });
        }

        if (user) {
          user.authProviders.apple = {
            id: decoded.sub,
            email: decoded.email || user.email,
          };
          user.isVerified = true;
          await user.save();
        } else {
          isNewUser = true;
          user = new User({
            email: decoded.email || `apple_${decoded.sub}@privaterelay.appleid.com`,
            firstName: fullName?.firstName || 'Apple',
            lastName: fullName?.lastName || 'User',
            displayName: fullName ? `${fullName.firstName} ${fullName.lastName}` : 'Apple User',
            isVerified: true,
            authProviders: {
              apple: {
                id: decoded.sub,
                email: decoded.email,
              },
              email: {
                verified: true,
              }
            }
          });
          await user.save();
        }
      }

      user.lastLoginAt = new Date();
      user.stats.lastActiveAt = new Date();
      await user.save();

      const tokens = await this.generateTokens(user);

      return { user: user.toObject(), tokens, isNewUser };
    } catch (error) {
      logger.error('Apple auth error:', error);
      throw new UnauthorizedError('Apple authentication failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as any;
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Check if refresh token exists in user's tokens
      const tokenExists = user.refreshTokens.some(
        (t: { token: string }) => t.token === refreshToken
      );

      if (!tokenExists) {
        // Possible token reuse - invalidate all tokens
        user.refreshTokens = [];
        await user.save();
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Remove old refresh token
      user.refreshTokens = user.refreshTokens.filter(
        (t: { token: string }) => t.token !== refreshToken
      );

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (refreshToken) {
      // Remove specific refresh token
      user.refreshTokens = user.refreshTokens.filter(
        (t: { token: string }) => t.token !== refreshToken
      );
    } else {
      // Remove all refresh tokens
      user.refreshTokens = [];
    }

    await user.save();
    logger.info(`User logged out: ${userId}`);
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      'authProviders.email.verificationToken': hashedToken,
      'authProviders.email.verificationExpires': { $gt: new Date() }
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    user.authProviders.email = {
      verified: true,
    };
    user.isVerified = true;
    await user.save();

    logger.info(`Email verified for user: ${user.email}`);
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found (security)
      return;
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    this.sendPasswordResetEmail(user.email, resetToken).catch(err => {
      logger.error('Failed to send password reset email:', err);
    });
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    logger.info(`Password reset for user: ${user.email}`);
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    user.password = newPassword;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    logger.info(`Password changed for user: ${userId}`);
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: IUser): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token to user
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(user: IUser): string {
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: 'wakeru-api',
      subject: user._id.toString(),
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(user: IUser): string {
    const payload = {
      userId: user._id,
      type: 'refresh',
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
      issuer: 'wakeru-api',
      subject: user._id.toString(),
    });
  }

  /**
   * Send verification email (placeholder)
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    // TODO: Implement email sending with nodemailer/SES/SendGrid
    logger.info(`Verification email sent to ${email} with token: ${token}`);
  }

  /**
   * Send password reset email (placeholder)
   */
  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // TODO: Implement email sending
    logger.info(`Password reset email sent to ${email} with token: ${token}`);
  }
}

export const authService = new AuthService();