import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config'; // adjust path to your actual config location
import { User } from '../modules/auth/auth.model'; // adjust path to match your folder structure
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from '../shared/types/common.types';

export interface JwtPayload {
  userId: string;
  email?: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  sub?: string;
}
export class AuthMiddleware {
  static async authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('No authentication token provided');
      }

      const token = authHeader.split(' ')[1];
      if (!token) throw new UnauthorizedError('No authentication token provided');

      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

      if (decoded.type !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }

      // CRITICAL FIX: Select only needed fields and use .lean() for performance
      const user = await User.findOne({ userId: decoded.userId })
        .select('email isActive isDeleted')
        .lean();

      if (!user) throw new UnauthorizedError('User no longer exists');
      if (!user.isActive) throw new UnauthorizedError('Account is deactivated');
      if (user.isDeleted) throw new UnauthorizedError('Account has been deleted');

      req.user = {
        userId: decoded.userId,
        email: user.email,
        role: decoded.role,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        next(new UnauthorizedError('Token has expired'));
      } else if (error instanceof jwt.JsonWebTokenError) {
        next(new UnauthorizedError('Invalid token'));
      } else {
        next(error);
      }
    }
  }
// export class AuthMiddleware {
//   /**
//    * Verify JWT access token and attach the user to the request.
//    *
//    * IMPORTANT: your User schema's identity field is the custom `userId`
//    * string (a UUID), not Mongoose's built-in `_id` ObjectId. Every lookup
//    * here uses findOne({ userId }) — NOT findById() — because findById()
//    * queries by `_id` and will fail to find anything when given a UUID.
//    */
//   static async authenticate(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         throw new UnauthorizedError('No authentication token provided');
//       }

//       const token = authHeader.split(' ')[1];
//       if (!token) {
//         throw new UnauthorizedError('No authentication token provided');
//       }

//       const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

//       if (decoded.type !== 'access') {
//         throw new UnauthorizedError('Invalid token type');
//       }

//       // FIX: findOne({ userId }) instead of findById(decoded.userId)
//       const user = await User.findOne({ userId: decoded.userId }).select('-refreshTokens');

//       if (!user) {
//         throw new UnauthorizedError('User no longer exists');
//       }

//       if (!user.isActive) {
//         throw new UnauthorizedError('Account is deactivated');
//       }

//       if (user.isDeleted) {
//         throw new UnauthorizedError('Account has been deleted');
//       }

//       req.user = {
//         userId: decoded.userId,
//         email: user.email,
//         role: decoded.role,
//       };

//       next();
//     } catch (error) {
//       if (error instanceof jwt.TokenExpiredError) {
//         next(new UnauthorizedError('Token has expired'));
//       } else if (error instanceof jwt.JsonWebTokenError) {
//         next(new UnauthorizedError('Invalid token'));
//       } else {
//         next(error);
//       }
//     }
//   }

//   /**
//    * Optional authentication — proceeds even if no token is present,
//    * but attaches req.user if a valid one is found.
//    */
//   static async optionalAuth(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return next();
//       }

//       const token = authHeader.split(' ')[1];
//       if (!token) {
//         return next();
//       }

//       const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

//       // FIX: findOne({ userId }) instead of findById(decoded.userId)
//       const user = await User.findOne({ userId: decoded.userId });

//       if (user && user.isActive && !user.isDeleted) {
//         req.user = {
//           userId: decoded.userId,
//           email: user.email,
//           role: decoded.role,
//         };
//       }

//       next();
//     } catch {
//       // Optional auth — any failure here just means "proceed unauthenticated"
//       next();
//     }
//   }

//   /**
//    * Role-based authorization. Use after `authenticate`.
//    */
//   static authorize(...roles: string[]) {
//     return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
//       try {
//         if (!req.user) {
//           throw new UnauthorizedError('Authentication required');
//         }

//         if (roles.length > 0 && !roles.includes(req.user.role)) {
//           throw new ForbiddenError('Insufficient permissions');
//         }

//         next();
//       } catch (error) {
//         next(error);
//       }
//     };
//   }

//   /**
//    * Premium user check.
//    */
//   static async requirePremium(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       if (!req.user) {
//         throw new UnauthorizedError('Authentication required');
//       }

//       // FIX: findOne({ userId }) instead of findById(req.user.userId)
//       const user = await User.findOne({ userId: req.user.userId });

//       if (!user || !['premium', 'business', 'admin'].includes(user.role)) {
//         throw new ForbiddenError('Premium subscription required');
//       }

//       next();
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Business account check.
//    */
//   static async requireBusiness(
//     req: AuthenticatedRequest,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       if (!req.user) {
//         throw new UnauthorizedError('Authentication required');
//       }

//       // FIX: findOne({ userId }) instead of findById(req.user.userId)
//       const user = await User.findOne({ userId: req.user.userId });

//       if (!user || !['business', 'admin'].includes(user.role)) {
//         throw new ForbiddenError('Business account required');
//       }

//       next();
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// Export a ready-to-use `protect` alias matching your auth.routes.ts import
export const protect = AuthMiddleware.authenticate;// import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
// import { config } from '../../config';
// import { User } from './auth.model';
// import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';
// import { AuthenticatedRequest } from '../../shared/types/common.types';
// import { logger } from '../../config/logger';

// export interface JwtPayload {
//   userId: string;
//   email: string;
//   role: string;
//   type: 'access' | 'refresh';
//   iat?: number;
//   exp?: number;
//   iss?: string;
//   sub?: string;
// }

// export class AuthMiddleware {
//   /**
//    * Verify JWT access token
//    */
//   static async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       // Get token from header
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         throw new UnauthorizedError('No authentication token provided');
//       }

//       const token = authHeader.split(' ')[1];
      
//       if (!token) {
//         throw new UnauthorizedError('No authentication token provided');
//       }

//       // Verify token
//       const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

//       // Check token type
//       if (decoded.type !== 'access') {
//         throw new UnauthorizedError('Invalid token type');
//       }

//       // Check if user still exists and is active
//       const user = await User.findById(decoded.userId).select('-password -refreshTokens');
      
//       if (!user) {
//         throw new UnauthorizedError('User no longer exists');
//       }

//       if (!user.isActive) {
//         throw new UnauthorizedError('Account is deactivated');
//       }

//       if (user.isDeleted) {
//         throw new UnauthorizedError('Account has been deleted');
//       }

//       // Attach user info to request
//       req.user = {
//         userId: decoded.userId,
//         email: decoded.email,
//         role: decoded.role,
//       };

//       next();
//     } catch (error) {
//       if (error instanceof jwt.TokenExpiredError) {
//         next(new UnauthorizedError('Token has expired'));
//       } else if (error instanceof jwt.JsonWebTokenError) {
//         next(new UnauthorizedError('Invalid token'));
//       } else {
//         next(error);
//       }
//     }
//   }

//   /**
//    * Optional authentication - doesn't fail if no token
//    */
//   static async optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return next();
//       }

//       const token = authHeader.split(' ')[1];
      
//       if (!token) {
//         return next();
//       }

//       const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
//       const user = await User.findById(decoded.userId);

//       if (user && user.isActive && !user.isDeleted) {
//         req.user = {
//           userId: decoded.userId,
//           email: decoded.email,
//           role: decoded.role,
//         };
//       }

//       next();
//     } catch (error) {
//       // Continue without authentication
//       next();
//     }
//   }

//   /**
//    * Role-based authorization
//    */
//   static authorize(...roles: string[]) {
//     return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
//       if (!req.user) {
//         throw new UnauthorizedError('Authentication required');
//       }

//       if (roles.length > 0 && !roles.includes(req.user.role)) {
//         throw new ForbiddenError('Insufficient permissions');
//       }

//       next();
//     };
//   }

//   /**
//    * Premium user check
//    */
//   static async requirePremium(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       if (!req.user) {
//         throw new UnauthorizedError('Authentication required');
//       }

//       const user = await User.findById(req.user.userId);
      
//       if (!user || !['premium', 'business', 'admin'].includes(user.role)) {
//         throw new ForbiddenError('Premium subscription required');
//       }

//       next();
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Business account check
//    */
//   static async requireBusiness(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       if (!req.user) {
//         throw new UnauthorizedError('Authentication required');
//       }

//       const user = await User.findById(req.user.userId);
      
//       if (!user || !['business', 'admin'].includes(user.role)) {
//         throw new ForbiddenError('Business account required');
//       }

//       next();
//     } catch (error) {
//       next(error);
//     }
//   }
// }
