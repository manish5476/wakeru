import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { ApiResponse } from '../../shared/types/common.types';
import { 
  registerSchema, 
  loginSchema, 
  googleAuthSchema, 
  appleAuthSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema
} from './auth.validation';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { User } from './auth.model';

export class AuthController {
  /**
   * Register new user
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const user = await AuthService.register(value);

      const response: ApiResponse = {
        success: true,
        message: 'Registration successful. Please verify your email.',
        data: {
          user: user.toJSON()
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const { user, tokens } = await AuthService.login(value.email, value.password);

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
   * Google OAuth login
   */
  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = googleAuthSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const { user, tokens, isNewUser } = await AuthService.googleAuth(value.token);

      const response: ApiResponse = {
        success: true,
        message: isNewUser ? 'Account created successfully' : 'Login successful',
        data: {
          user: user.toJSON(),
          tokens,
          isNewUser
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apple OAuth login
   */
  async appleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = appleAuthSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const { user, tokens, isNewUser } = await AuthService.appleAuth(
        value.token,
        { firstName: value.firstName, lastName: value.lastName }
      );

      const response: ApiResponse = {
        success: true,
        message: isNewUser ? 'Account created successfully' : 'Login successful',
        data: {
          user: user.toJSON(),
          tokens,
          isNewUser
        },
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
   * Verify email
   */
  /* async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = verifyEmailSchema.validate(req.params);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      await AuthService.verifyEmail(value.token);

      const response: ApiResponse = {
        success: true,
        message: 'Email verified successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  } */

  /**
   * Forgot password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = forgotPasswordSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      await AuthService.forgotPassword(value.email);

      const response: ApiResponse = {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      await AuthService.resetPassword(value.token, value.newPassword);

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successful. Please login with your new password.',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      await AuthService.changePassword(req.user!.userId, value.currentPassword, value.newPassword);

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
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