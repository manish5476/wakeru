import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { User } from './auth.model';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { logger } from '../../config/logger';

// ============================================================
// Types
// ============================================================

export interface JwtPayload {
  userId: string;
  role?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
}

// ============================================================
// Auth Middleware Class
// ============================================================

export class AuthMiddleware {
  /**
   * Authenticate request using Bearer JWT access token.
   * Attaches user info to req.user on success.
   */
  static async authenticate(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('No authentication token provided');
      }

      const token = authHeader.split(' ')[1];
      if (!token || token === 'null' || token === 'undefined') {
        throw new UnauthorizedError('Invalid authentication token');
      }

      // Verify JWT signature + expiry
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedError('Token has expired. Please refresh your token.');
        }
        if (error.name === 'JsonWebTokenError') {
          throw new UnauthorizedError('Invalid token. Please login again.');
        }
        throw new UnauthorizedError('Token verification failed');
      }

      // Validate token type — only access tokens allowed for API access
      if (decoded.type !== 'access') {
        throw new UnauthorizedError('Invalid token type. Use access token for API requests.');
      }

      // Read user from DATABASE (not token) to get current role
      // This ensures role changes take effect immediately
      // const user = await User.findOne(
      //   { 
      //     _id: decoded.userId,
      //     isActive: true,
      //     isDeleted: false,
      //   },
      //   'email role isActive isDeleted'
      // ).lean();

      // if (!user) {
      //   throw new UnauthorizedError('Account not found or has been deactivated');
      // }

      // // Attach user to request
      // req.user = {
      //   userId: decoded.userId,
      //   email: user.email,
      //   role: user.role,
      // };
      // ✅ UPGRADED:
      const user = await User.findOne(
        { _id: decoded.userId, isActive: true, isDeleted: false },
        'email role displayName photoURL isActive isDeleted'  // ← ADDED
      ).lean();

      if (!user) {
        throw new UnauthorizedError('Account not found or has been deactivated');
      }

      req.user = {
        userId: decoded.userId,
        email: user.email,
        role: user.role,
        displayName: user.displayName || 'User',   // ← ADDED
        photoURL: user.photoURL || '',             // ← ADDED
      };

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Role-based authorization guard.
   * Use after authenticate middleware.
   */
  static authorize(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new UnauthorizedError('Authentication required');
        }

        if (!allowedRoles.includes(req.user.role)) {
          throw new ForbiddenError(
            `Access denied. Required role: ${allowedRoles.join(' or ')}`
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Optional authentication — attaches user if token present, continues if not.
   * Useful for public endpoints that behave differently for logged-in users.
   */
  static async optional(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // No token — continue without user
      }

      const token = authHeader.split(' ')[1];
      if (!token || token === 'null') {
        return next();
      }

      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

      if (decoded.type !== 'access') {
        return next(); // Wrong token type — continue without user
      }

      const user = await User.findOne(
        { _id: decoded.userId, isActive: true, isDeleted: false },
        'email role'
      ).lean();

      if (user) {
        req.user = {
          userId: decoded.userId,
          email: user.email,
          role: user.role,
        };
      }

      next();
    } catch {
      // Token invalid/expired — continue without user
      next();
    }
  }
}

// ============================================================
// Convenience Exports
// ============================================================

export const protect = AuthMiddleware.authenticate;
export const authorize = AuthMiddleware.authorize;
export const optionalAuth = AuthMiddleware.optional;