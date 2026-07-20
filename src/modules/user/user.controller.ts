import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AppError';

export class UserController {
  
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.userId);
      res.status(200).json({
        success: true,
        data: { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async getPublicProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getPublicProfile(req.params.userId);
      res.status(200).json({
        success: true,
        data: { user },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.updateProfile(req.user!.userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async registerFCMToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) throw new BadRequestError('Token is required');
      await userService.registerFCMToken(req.user!.userId, token);
      res.status(200).json({
        success: true,
        message: 'FCM token registered successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.updatePreferences(req.user!.userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const preferences = await userService.getPreferences(req.user!.userId);
      res.status(200).json({
        success: true,
        data: { preferences },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateBankingDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.updateBankingDetails(req.user!.userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Banking details updated successfully',
        data: { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadProfilePicture(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new NotFoundError('No file uploaded');
      const photoURL = await userService.uploadProfilePicture(req.user!.userId, req.file);
      res.status(200).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: { photoURL },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deleteAccount(req.user!.userId);
      res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deactivateAccount(req.user!.userId);
      res.status(200).json({
        success: true,
        message: 'Account deactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async reactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.reactivateAccount(req.user!.userId);
      res.status(200).json({
        success: true,
        message: 'Account reactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, page, limit } = req.query as any;
      const result = await userService.searchUsers(query, page, limit);
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await userService.getUserStats(req.user!.userId);
      res.status(200).json({
        success: true,
        data: { stats },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async getLinkedAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const linkedAccounts = await userService.getLinkedAccounts(req.user!.userId);
      res.status(200).json({
        success: true,
        data: { linkedAccounts },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async upgradeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin') {
        throw new ForbiddenError('Only administrators can upgrade user roles');
      }
      const user = await userService.upgradeRole(req.params.userId, req.body.role);
      res.status(200).json({
        success: true,
        message: `User role upgraded to ${req.body.role}`,
        data: { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async createCustomTheme(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const theme = await userService.createCustomTheme(req.user!.userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Custom theme created successfully',
        data: { theme },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCustomTheme(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const theme = await userService.updateCustomTheme(req.user!.userId, req.params.themeId, req.body);
      res.status(200).json({
        success: true,
        message: 'Custom theme updated successfully',
        data: { theme },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCustomTheme(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deleteCustomTheme(req.user!.userId, req.params.themeId);
      res.status(200).json({
        success: true,
        message: 'Custom theme deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async applyCustomTheme(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.applyCustomTheme(req.user!.userId, req.params.themeId);
      res.status(200).json({
        success: true,
        message: 'Custom theme applied successfully',
        data: { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async validateContrast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { color1, color2 } = req.body;
      if (!color1 || !color2) throw new BadRequestError('Both color1 and color2 are required');
      const result = await userService.validateContrast(color1, color2);
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
