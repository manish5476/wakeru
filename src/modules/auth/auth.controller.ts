import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { User } from './auth.model';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';

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
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ip = req.ip || 'Unknown IP';
      const { user, tokens, isNewUser } = await AuthService.register(idToken, metadata, userAgent, ip);

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
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ip = req.ip || 'Unknown IP';
      const { user, tokens, isNewUser } = await AuthService.login(idToken, userAgent, ip);

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
   * POST /api/v1/auth/forgot-password
   * Send password reset email via Firebase.
   * Always returns 200 to prevent email enumeration.
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await AuthService.forgotPassword(email);

      const response: ApiResponse = {
        success: true,
        message: 'If an account exists for this email, reset instructions have been sent',
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   * Refresh access token using valid refresh token.
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ip = req.ip || 'Unknown IP';
      const tokens = await AuthService.refreshToken(refreshToken, userAgent, ip);

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
      const sessions = await AuthService.getSessions(req.user!.userId);

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

      const response: ApiResponse = {
        success: true,
        message: 'Profile fetched successfully',
        data: { user: user.toObject() },
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