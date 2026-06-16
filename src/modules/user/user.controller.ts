import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { 
  updateProfileSchema,
  updatePreferencesSchema,
  updateBankingDetailsSchema,
  searchUsersSchema,
  upgradeRoleSchema
} from './user.validation';
import { ValidationError, ForbiddenError } from '../../shared/errors/AppError';

export class UserController {
  /**
   * Get user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { user },
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID (public profile)
   */
  async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await userService.getPublicProfile(userId);

      const response: ApiResponse = {
        success: true,
        data: { user },
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const user = await userService.updateProfile(req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update preferences
   */
  async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updatePreferencesSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const user = await userService.updatePreferences(req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Preferences updated successfully',
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update banking details
   */
  async updateBankingDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updateBankingDetailsSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const user = await userService.updateBankingDetails(req.user!.userId, value);

      const response: ApiResponse = {
        success: true,
        message: 'Banking details updated successfully',
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      const profilePictureUrl = await userService.uploadProfilePicture(req.user!.userId, req.file);

      const response: ApiResponse = {
        success: true,
        message: 'Profile picture uploaded successfully',
        data: { profilePicture: profilePictureUrl },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete account
   */
  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.deleteAccount(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate account
   */
  async deactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.deactivateAccount(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Account deactivated successfully',
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reactivate account
   */
  async reactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.reactivateAccount(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        message: 'Account reactivated successfully',
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search users
   */
  async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = searchUsersSchema.validate(req.query);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const result = await userService.searchUsers(value.query, value.page, value.limit);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user stats
   */
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await userService.getUserStats(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { stats },
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get linked accounts
   */
  async getLinkedAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const linkedAccounts = await userService.getLinkedAccounts(req.user!.userId);

      const response: ApiResponse = {
        success: true,
        data: { linkedAccounts },
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upgrade user role (admin only)
   */
  async upgradeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { error, value } = upgradeRoleSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      // Only admin can upgrade roles
      if (req.user?.role !== 'admin') {
        throw new ForbiddenError('Only administrators can upgrade user roles');
      }

      const user = await userService.upgradeRole(userId, value.role);

      const response: ApiResponse = {
        success: true,
        message: `User role upgraded to ${value.role}`,
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();