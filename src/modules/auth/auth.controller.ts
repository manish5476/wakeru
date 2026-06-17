import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { NotFoundError } from '../../shared/errors/AppError';
import { User } from './auth.model';

export class AuthController {
  
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.body is already validated and strongly typed by Zod middleware
      const { idToken, metadata } = req.body;
      const { user, tokens } = await AuthService.register(idToken, metadata);

      const response: ApiResponse = {
        success: true,
        message: 'Account created successfully',
        data: {
          user: user.toJSON(), // toJSON safely strips refreshTokens
          tokens,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body;
      const { user, tokens } = await AuthService.login(idToken);

      const response: ApiResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          tokens,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Guaranteed to be a valid email string thanks to Zod
      const { email } = req.body; 

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

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Using .lean() for performance, so we must explicitly exclude refreshTokens
      // using .select() because Mongoose's toJSON() transform won't run on lean objects.
      const user = await User.findOne({ userId: req.user!.userId })
        .select('-refreshTokens -__v -_id') 
        .lean();

      if (!user) {
        throw new NotFoundError('User');
      }

      const response: ApiResponse = {
        success: true,
        data: { user },
        timestamp: new Date().toISOString(),
        message: 'Profile fetched successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
