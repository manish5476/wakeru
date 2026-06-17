import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { verifyFirebaseTokenSchema, refreshTokenSchema, logoutSchema } from './auth.validation';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { User } from './auth.model';

export class AuthController {
  /**
   * Register a new user.
   * Firebase has already verified the user's identity client-side —
   * this endpoint verifies the resulting idToken and creates our Mongo user.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = verifyFirebaseTokenSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const { user, tokens } = await AuthService.register(value.idToken, value.metadata);

      const response: ApiResponse = {
        success: true,
        message: 'Account created successfully',
        data: {
          user: user.toJSON(),
          tokens,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login an existing user.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = verifyFirebaseTokenSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      const { user, tokens } = await AuthService.login(value.idToken);

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

  /**
   * Forgot password.
   *
   * NOTE: Since Firebase owns authentication, the actual password-reset
   * email is normally triggered client-side via Firebase's own
   * sendPasswordResetEmail(). This backend endpoint is optional — use it
   * ONLY if you want server-side logging/analytics of reset requests, or
   * if you specifically want the Admin SDK to generate the reset link
   * server-side (e.g. to embed in your own branded email template).
   *
   * As written, this does not call Firebase at all — it only validates
   * input and returns success. If you don't need server-side involvement,
   * delete this endpoint and call Firebase directly from the client.
   * If you DO want server-side control, uncomment the Admin SDK call below.
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        throw new ValidationError('email is required', []);
      }

      // Example of actually doing something server-side with Firebase Admin:
      //
      // import { getAuth } from 'firebase-admin/auth';
      // const link = await getAuth().generatePasswordResetLink(email);
      // await sendCustomEmail(email, link); // your own email service
      //
      // Left commented out since your current flow may handle this
      // entirely client-side via Firebase's client SDK instead.

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
   * Refresh access token using a valid refresh token.
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
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout — invalidates the provided refresh token.
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = logoutSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message, error.details);
      }

      await AuthService.logout(req.user!.userId, value.refreshToken);

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
   * Get current authenticated user's profile.
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // FIX: findOne({ userId }) instead of findById(req.user.userId) —
      // your schema's identity field is the custom userId string, not _id.
      const user = await User.findOne({ userId: req.user!.userId });

      if (!user) {
        throw new NotFoundError('User');
      }

      const response: ApiResponse = {
        success: true,
        data: { user: user.toJSON() },
        timestamp: new Date().toISOString(),
        message: 'Profile fetched successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();// import { Request, Response, NextFunction } from 'express';
// import { AuthService } from './auth.service';
// import { AuthenticatedRequest } from '../../shared/types/common.types';
// import { ApiResponse } from '../../shared/types/common.types';
// import { 
//   verifyFirebaseTokenSchema,
//   refreshTokenSchema
// } from './auth.validation';
// import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
// import { User } from './auth.model';

// export class AuthController {
//   /**
//    * Register a new user
//    */
//   async register(req: Request, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { idToken, metadata } = req.body;
//       if (!idToken) throw new ValidationError('idToken is required', []);

//       const { user, tokens } = await AuthService.register(idToken, metadata);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Account created successfully',
//         data: {
//           user: user.toJSON(),
//           tokens
//         },
//         timestamp: new Date().toISOString()
//       };

//       res.status(201).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Login existing user
//    */
//   async login(req: Request, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { idToken } = req.body;
//       if (!idToken) throw new ValidationError('idToken is required', []);

//       const { user, tokens } = await AuthService.login(idToken);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Login successful',
//         data: {
//           user: user.toJSON(),
//           tokens
//         },
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Handle forgot password hook
//    */
//   async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
//     try {
//       // Firebase handles the email. This endpoint is for tracking/logging if necessary.
//       const { email } = req.body;
//       if (!email) throw new ValidationError('email is required', []);

//       // In a real scenario, you could log this or trigger internal analytics.
//       const response: ApiResponse = {
//         success: true,
//         message: 'Password reset instructions dispatched',
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Refresh access token
//    */
//   async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { error, value } = refreshTokenSchema.validate(req.body);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }

//       const tokens = await AuthService.refreshToken(value.refreshToken);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Token refreshed successfully',
//         data: { tokens },
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Logout user
//    */
//   async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const refreshToken = req.body.refreshToken;
//       await AuthService.logout(req.user!.userId, refreshToken);

//       const response: ApiResponse = {
//         success: true,
//         message: 'Logged out successfully',
//         timestamp: new Date().toISOString()
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get current user profile
//    */
//   async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const user = await User.findById(req.user!.userId);
      
//       if (!user) {
//         throw new NotFoundError('User');
//       }

//       const response: ApiResponse = {
//         success: true,
//         data: { user: user.toJSON() },
//         timestamp: new Date().toISOString(),
//         message: 'Profile fetched successfully'
//       };

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// export const authController = new AuthController();
