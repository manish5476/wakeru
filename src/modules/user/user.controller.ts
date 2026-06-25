import { Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { BadRequestError, ForbiddenError } from '../../shared/errors/AppError';

// ============================================================
// Typed request aliases
// Narrows req.params / req.body for specific endpoints so
// TypeScript can verify property access without casting.
// ============================================================

type UpgradeRoleRequest = AuthenticatedRequest<
  { userId: string },  // req.params
  any,                 // res body (unused)
  { role: string }     // req.body
>;

type PublicProfileRequest = AuthenticatedRequest<
  { userId: string }   // req.params
>;

// ============================================================
// UserController
// ============================================================

export class UserController {

  // ── getProfile ──────────────────────────────────────────────────────────────
  async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.userId);
      res.status(200).json({
        success:   true,
        data:      { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── getPublicProfile ────────────────────────────────────────────────────────
  async getPublicProfile(
    req: PublicProfileRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.getPublicProfile(req.params.userId);
      res.status(200).json({
        success:   true,
        data:      { user },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── updateProfile ───────────────────────────────────────────────────────────
  async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updateProfile(req.user!.userId, req.body);
      res.status(200).json({
        success:   true,
        message:   'Profile updated successfully',
        data:      { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── updatePreferences ───────────────────────────────────────────────────────
  async updatePreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updatePreferences(req.user!.userId, req.body);
      res.status(200).json({
        success:   true,
        message:   'Preferences updated successfully',
        data:      { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── updateBankingDetails ────────────────────────────────────────────────────
  async updateBankingDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updateBankingDetails(req.user!.userId, req.body);
      res.status(200).json({
        success:   true,
        message:   'Banking details updated successfully',
        data:      { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── uploadProfilePicture ────────────────────────────────────────────────────
  async uploadProfilePicture(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) throw new BadRequestError('No file uploaded');
      const photoURL = await userService.uploadProfilePicture(
        req.user!.userId,
        req.file
      );
      res.status(200).json({
        success:   true,
        message:   'Profile picture uploaded successfully',
        data:      { photoURL },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── deleteAccount ───────────────────────────────────────────────────────────
  async deleteAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      await userService.deleteAccount(req.user!.userId, token);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ── deactivateAccount ───────────────────────────────────────────────────────
  async deactivateAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await userService.deactivateAccount(req.user!.userId);
      res.status(200).json({
        success:   true,
        message:   'Account deactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── reactivateAccount ───────────────────────────────────────────────────────
  async reactivateAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await userService.reactivateAccount(req.user!.userId);
      res.status(200).json({
        success:   true,
        message:   'Account reactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── searchUsers ─────────────────────────────────────────────────────────────
  async searchUsers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { query, page, limit } = req.query as {
        query: string;
        page?:  string;
        limit?: string;
      };
      const result = await userService.searchUsers(
        query,
        page  ? parseInt(page,  10) : 1,
        limit ? parseInt(limit, 10) : 10
      );
      res.status(200).json({
        success:   true,
        data:      result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── getStats ────────────────────────────────────────────────────────────────
  async getStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await userService.getUserStats(req.user!.userId);
      res.status(200).json({
        success:   true,
        data:      { stats },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── getLinkedAccounts ───────────────────────────────────────────────────────
  async getLinkedAccounts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const linkedAccounts = await userService.getLinkedAccounts(req.user!.userId);
      res.status(200).json({
        success:   true,
        data:      { linkedAccounts },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── upgradeRole ─────────────────────────────────────────────────────────────
  // Uses UpgradeRoleRequest so req.params.userId and req.body.role
  // are fully typed without any casting.
  async upgradeRole(
    req: UpgradeRoleRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const { role }   = req.body;

      if (userId === req.user!.userId) {
        throw new ForbiddenError('You cannot change your own role via this endpoint');
      }

      const user = await userService.upgradeRole(userId, role);
      res.status(200).json({
        success:   true,
        message:   `User role updated to ${role}`,
        data:      { user: user.toFullProfile() },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
// import { Response, NextFunction } from 'express';
// import { userService } from './user.service';
// import { AuthenticatedRequest } from '../../shared/types/common.types';
// import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

// export class UserController {

//   // ── getProfile ──────────────────────────────────────────────────────────────
//   async getProfile(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const user = await userService.getUserById(req.user!.userId);
//       res.status(200).json({
//         success: true,
//         data: { user: user.toFullProfile() },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── getPublicProfile ────────────────────────────────────────────────────────
//   async getPublicProfile(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const user = await userService.getPublicProfile(req.params.userId);
//       res.status(200).json({
//         success: true,
//         data: { user },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── updateProfile ───────────────────────────────────────────────────────────
//   async updateProfile(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const user = await userService.updateProfile(req.user!.userId, req.body);
//       res.status(200).json({
//         success: true,
//         message: 'Profile updated successfully',
//         data: { user: user.toFullProfile() },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── updatePreferences ───────────────────────────────────────────────────────
//   async updatePreferences(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const user = await userService.updatePreferences(req.user!.userId, req.body);
//       res.status(200).json({
//         success: true,
//         message: 'Preferences updated successfully',
//         data: { user: user.toFullProfile() },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── updateBankingDetails ────────────────────────────────────────────────────
//   async updateBankingDetails(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const user = await userService.updateBankingDetails(req.user!.userId, req.body);
//       res.status(200).json({
//         success: true,
//         message: 'Banking details updated successfully',
//         data: { user: user.toFullProfile() },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── uploadProfilePicture ────────────────────────────────────────────────────
//   async uploadProfilePicture(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       // FIX: Use BadRequestError (400) for missing file — not NotFoundError (404)
//       if (!req.file) throw new BadRequestError('No file uploaded');

//       const photoURL = await userService.uploadProfilePicture(
//         req.user!.userId,
//         req.file
//       );
//       res.status(200).json({
//         success: true,
//         message: 'Profile picture uploaded successfully',
//         data: { photoURL },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── deleteAccount ───────────────────────────────────────────────────────────
//   /**
//    * FIX: Pass the current access token to the service so it can be
//    * blacklisted immediately upon account deletion.
//    * FIX: Return 204 No Content (correct HTTP semantics for DELETE).
//    */
//   async deleteAccount(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const token = req.headers.authorization?.split(' ')[1];
//       await userService.deleteAccount(req.user!.userId, token);
//       res.status(204).send();
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── deactivateAccount ───────────────────────────────────────────────────────
//   async deactivateAccount(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       await userService.deactivateAccount(req.user!.userId);
//       res.status(200).json({
//         success: true,
//         message: 'Account deactivated successfully',
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── reactivateAccount ───────────────────────────────────────────────────────
//   async reactivateAccount(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       await userService.reactivateAccount(req.user!.userId);
//       res.status(200).json({
//         success: true,
//         message: 'Account reactivated successfully',
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── searchUsers ─────────────────────────────────────────────────────────────
//   async searchUsers(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const { query, page, limit } = req.query as {
//         query: string;
//         page?: string;
//         limit?: string;
//       };

//       const result = await userService.searchUsers(
//         query,
//         page  ? parseInt(page, 10)  : 1,
//         limit ? parseInt(limit, 10) : 10
//       );

//       res.status(200).json({
//         success: true,
//         data: result,
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── getStats ────────────────────────────────────────────────────────────────
//   async getStats(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const stats = await userService.getUserStats(req.user!.userId);
//       res.status(200).json({
//         success: true,
//         data: { stats },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── getLinkedAccounts ───────────────────────────────────────────────────────
//   async getLinkedAccounts(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const linkedAccounts = await userService.getLinkedAccounts(req.user!.userId);
//       res.status(200).json({
//         success: true,
//         data: { linkedAccounts },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ── upgradeRole ─────────────────────────────────────────────────────────────
//   /**
//    * FIX: Role check belongs in authorize() middleware (already on the route),
//    * but we keep a safety guard here too.
//    * FIX: Prevent admin from accidentally demoting themselves.
//    */
//   async upgradeRole(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const { userId } = req.params;
//       const { role }   = req.body;

//       // Guard: prevent self-role-change via this endpoint (use dedicated flow)
//       if (userId === req.user!.userId) {
//         throw new ForbiddenError('You cannot change your own role via this endpoint');
//       }

//       const user = await userService.upgradeRole(userId, role);
//       res.status(200).json({
//         success: true,
//         message: `User role updated to ${role}`,
//         data: { user: user.toFullProfile() },
//         timestamp: new Date().toISOString(),
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// export const userController = new UserController();

// // import { Request, Response, NextFunction } from 'express';
// // import { userService } from './user.service';
// // import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
// // import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

// // export class UserController {
  
// //   async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const user = await userService.getUserById(req.user!.userId);
// //       res.status(200).json({
// //         success: true,
// //         data: { user: user.toFullProfile() },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async getPublicProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const user = await userService.getPublicProfile(req.params.userId);
// //       res.status(200).json({
// //         success: true,
// //         data: { user },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const user = await userService.updateProfile(req.user!.userId, req.body);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Profile updated successfully',
// //         data: { user: user.toFullProfile() },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const user = await userService.updatePreferences(req.user!.userId, req.body);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Preferences updated successfully',
// //         data: { user: user.toFullProfile() },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async updateBankingDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const user = await userService.updateBankingDetails(req.user!.userId, req.body);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Banking details updated successfully',
// //         data: { user: user.toFullProfile() },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async uploadProfilePicture(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       if (!req.file) throw new NotFoundError('No file uploaded');
// //       const photoURL = await userService.uploadProfilePicture(req.user!.userId, req.file);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Profile picture uploaded successfully',
// //         data: { photoURL },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       await userService.deleteAccount(req.user!.userId);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Account deleted successfully',
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async deactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       await userService.deactivateAccount(req.user!.userId);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Account deactivated successfully',
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async reactivateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       await userService.reactivateAccount(req.user!.userId);
// //       res.status(200).json({
// //         success: true,
// //         message: 'Account reactivated successfully',
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const { query, page, limit } = req.query as any;
// //       const result = await userService.searchUsers(query, page, limit);
// //       res.status(200).json({
// //         success: true,
// //         data: result,
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const stats = await userService.getUserStats(req.user!.userId);
// //       res.status(200).json({
// //         success: true,
// //         data: { stats },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async getLinkedAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       const linkedAccounts = await userService.getLinkedAccounts(req.user!.userId);
// //       res.status(200).json({
// //         success: true,
// //         data: { linkedAccounts },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   async upgradeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
// //     try {
// //       if (req.user?.role !== 'admin') {
// //         throw new ForbiddenError('Only administrators can upgrade user roles');
// //       }
// //       const user = await userService.upgradeRole(req.params.userId, req.body.role);
// //       res.status(200).json({
// //         success: true,
// //         message: `User role upgraded to ${req.body.role}`,
// //         data: { user: user.toFullProfile() },
// //         timestamp: new Date().toISOString(),
// //       });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }
// // }

// // export const userController = new UserController();
