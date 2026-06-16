import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { ApiResponse } from '../../shared/types/common.types';
import { 
  verifyFirebaseTokenSchema,
  refreshTokenSchema
} from './auth.validation';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { User } from './auth.model';

export class AuthController {
  /**
   * Register a new user
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken, metadata } = req.body;
      if (!idToken) throw new ValidationError('idToken is required', []);

      const { user, tokens } = await AuthService.register(idToken, metadata);

      const response: ApiResponse = {
        success: true,
        message: 'Account created successfully',
        data: {
          user: user.toJSON(),
          tokens
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login existing user
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body;
      if (!idToken) throw new ValidationError('idToken is required', []);

      const { user, tokens } = await AuthService.login(idToken);

      const response: ApiResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          tokens
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle forgot password hook
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Firebase handles the email. This endpoint is for tracking/logging if necessary.
      const { email } = req.body;
      if (!email) throw new ValidationError('email is required', []);

      // In a real scenario, you could log this or trigger internal analytics.
      const response: ApiResponse = {
        success: true,
        message: 'Password reset instructions dispatched',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const tokens = await AuthService.refreshToken(value.refreshToken);

      const response: ApiResponse = {
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.body.refreshToken;
      await AuthService.logout(req.user!.userId, refreshToken);

      const response: ApiResponse = {
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.userId);
      
      if (!user) {
        throw new NotFoundError('User');
      }

      const response: ApiResponse = {
        success: true,
        data: { user: user.toJSON() },
        timestamp: new Date().toISOString(),
        message: 'Profile fetched successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();