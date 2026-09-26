import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { User } from './auth.model';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import { config } from '../../config';

// Import email services
import { sendVerificationEmail, sendPasswordResetEmail } from '../email/email.service';
import { getAuth } from 'firebase-admin/auth';

export class AuthController {
  
  // ============================================================
  // Public Endpoints
  // ============================================================

  /**
   * POST /api/v1/auth/register
   * Register new user with Firebase ID token.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken, metadata } = req.body;
      const { user, tokens, isNewUser } = await AuthService.register(idToken, metadata);

      const response: ApiResponse = {
        success: true,
        message: 'Account created successfully',
        data: {
          user: {
            userId: user._id,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: user.role,
          },
          tokens,
          isNewUser,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Login with Firebase ID token.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body;
      const { user, tokens, isNewUser } = await AuthService.login(idToken);

      const response: ApiResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            userId: user._id,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: user.role,
          },
          tokens,
          isNewUser,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/send-verification-email
   * Triggers the sending of a custom email verification email.
   */
  async sendVerificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const user = await getAuth().getUserByEmail(email);

      if (!user) {
        // To prevent user enumeration, we don't reveal that the user doesn't exist.
        // We just log it and send a generic success response.
        logger.warn(`Verification email requested for non-existent user: ${email}`);
      } else if (user.emailVerified) {
        // If the email is already verified, we don't need to send another one.
        // We can inform the user about this.
        res.status(200).json({
          success: true,
          message: 'Email is already verified.',
        });
        return;
      } else {
        await sendVerificationEmail(user);
      }

      res.status(200).json({
        success: true,
        message: 'A verification email has been sent if the user exists and is not already verified.',
      });
    } catch (error) {
      if ((error as any).code === 'auth/user-not-found') {
        // Sanitize the error to prevent user enumeration.
        logger.warn(`Verification email requested for non-existent user: ${req.body.email}`);
        res.status(200).json({
          success: true,
          message: 'A verification email has been sent if the user exists and is not already verified.',
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * POST /api/v1/auth/send-password-reset
   * Triggers the sending of a custom password reset email.
   */
  async sendPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      try {
        const user = await getAuth().getUserByEmail(email);
        await sendPasswordResetEmail(user);
      } catch (error) {
        if ((error as any).code === 'auth/user-not-found') {
          // Do not reveal that the user does not exist. Log it for monitoring.
          logger.warn(`Password reset requested for non-existent user: ${email}`);
        } else {
          // Re-throw other errors to be caught by the outer catch block.
          throw error;
        }
      }

      res.status(200).json({
        success: true,
        message: 'If an account exists for this email, a password reset email has been sent.',
      });
    } catch (error) {
      // This will catch errors from the email sending service or other unexpected issues.
      logger.error('Failed to process password reset request:', error);
      // Still send a generic response to the client.
      res.status(200).json({
        success: true,
        message: 'If an account exists for this email, a password reset email has been sent.',
      });
    }
  }


  /**
   * POST /api/v1/auth/refresh-token
   * Refresh access token using valid refresh token.
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refreshToken(refreshToken);

      const response: ApiResponse = {
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // Authenticated Endpoints
  // ============================================================

  /**
   * POST /api/v1/auth/logout
   * Logout current device (remove specific refresh token).
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(req.user!.userId, refreshToken);

      const response: ApiResponse = {
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout-all
   * Logout from ALL devices.
   */
  async logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.logoutAll(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Logged out from all devices successfully',
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/sessions
   * Get all active sessions for current user.
   */
  async getSessions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.userId).select('refreshTokens');
      const sessions = user?.refreshTokens?.map((token: string) => ({ token })) || [];

      const response: ApiResponse = {
        success: true,
        message: 'Sessions fetched successfully',
        data: { sessions },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current user's full profile.
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findOne({ 
        _id: req.user!.userId,
        isActive: true,
        isDeleted: false,
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const userData = user.toObject();
      const normalizedEmail = (user.email || '').toLowerCase().trim();
      if (config.ADMIN_EMAILS.includes(normalizedEmail)) {
        userData.role = 'admin';
        if (user.role !== 'admin') {
          await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
        }
      }

      const response: ApiResponse = {
        success: true,
        message: 'Profile fetched successfully',
        data: { user: userData },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/auth/me
   * Update current user's profile.
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.updateProfile(req.user!.userId, req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: { user },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/auth/me/upi
   * Set/Update UPI ID.
   */
  async setUpiId(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { upiId } = req.body;
      const user = await AuthService.setUpiId(req.user!.userId, upiId);

      const response: ApiResponse = {
        success: true,
        message: 'UPI ID updated successfully',
        data: { user },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/me/upi/verify
   * Verify UPI ID.
   */
  async verifyUpi(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const verified = await AuthService.verifyUpi(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: verified ? 'UPI ID verified successfully' : 'UPI verification failed',
        data: { upiVerified: verified },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/auth/me/fcm-token
   * Update FCM token for push notifications.
   */
  async updateFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fcmToken } = req.body;
      await AuthService.updateFcmToken(req.user!.userId, fcmToken);

      const response: ApiResponse = {
        success: true,
        message: 'FCM token updated',
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/auth/me
   * Deactivate/delete account.
   */
  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.deactivateAccount(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
