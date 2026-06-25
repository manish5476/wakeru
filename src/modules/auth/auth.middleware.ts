import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from './auth.model';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { config } from '../../config';
import { redisClient } from '../../config/redis';
import { logger } from '../../config/logger';

// ============================================================
// JWT Payload Interface
// ============================================================

export interface JwtPayload {
  userId: string;
  role?: string;
  type: 'access' | 'refresh';
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

// ============================================================
// Token Blacklist Helpers  (Redis-backed)
// ============================================================

/**
 * Blacklist a token on logout or password change.
 * TTL = token's remaining lifetime so Redis auto-cleans.
 *
 * Call from AuthService on:
 *   - logout         → blacklistToken(accessToken, decoded.exp)
 *   - password change → blacklistToken(accessToken, decoded.exp)
 *                       + User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } })
 */
export const blacklistToken = async (
  token: string,
  expUnix?: number
): Promise<void> => {
  const ttlSeconds = expUnix
    ? Math.max(expUnix - Math.floor(Date.now() / 1000), 1)
    : 60 * 60;
  await redisClient.set(`blacklist:${token}`, '1', ttlSeconds);
};

const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const val = await redisClient.get(`blacklist:${token}`);
    return val !== null;
  } catch {
    logger.warn('[AuthMiddleware] Redis unavailable for blacklist check — proceeding');
    return false;
  }
};

// ============================================================
// AuthMiddleware  (single source of truth)
// ============================================================

export class AuthMiddleware {

  /**
   * Verify Bearer JWT access token. Attaches req.user on success.
   *
   * Fixes applied:
   *   1. Redis blacklist check  (logout / password-change revocation)
   *   2. tokenVersion check     (force-logout all devices)
   *   3. JWT_SECRET from config only — no inline fallback string
   *   4. Consistent next(error) — no void/undefined leakage
   *   5. 401 vs 403 correctly distinguished in authorize()
   */
  static async authenticate(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // ── 1. Extract token ──────────────────────────────────────────────────
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return next(new UnauthorizedError('No authentication token provided'));
      }

      const token = authHeader.split(' ')[1];
      if (!token || token === 'null' || token === 'undefined') {
        return next(new UnauthorizedError('Invalid authentication token'));
      }

      // ── 2. Redis blacklist check ──────────────────────────────────────────
      if (await isTokenBlacklisted(token)) {
        return next(new UnauthorizedError('Token has been revoked. Please login again.'));
      }

      // ── 3. Verify JWT signature + expiry ─────────────────────────────────
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          return next(new UnauthorizedError('Token has expired. Please refresh your token.'));
        }
        return next(new UnauthorizedError('Invalid token. Please login again.'));
      }

      // ── 4. Validate token type ────────────────────────────────────────────
      if (decoded.type !== 'access') {
        return next(new UnauthorizedError('Invalid token type. Use access token for API requests.'));
      }

      // ── 5. Fetch live user from DB ────────────────────────────────────────
      // Always read from DB (not token) so role changes take effect immediately.
      const userDoc = await User.findOne(
        { _id: decoded.userId, isActive: true, isDeleted: false },
        'email role displayName photoURL tokenVersion'
      ).lean();

      if (!userDoc) {
        return next(new UnauthorizedError('Account not found or has been deactivated.'));
      }

      // ── 6. tokenVersion check (force-logout all devices) ─────────────────
      // Increment user.tokenVersion on password change / admin force-logout.
      // All tokens minted before the increment are instantly rejected.
      if (
        decoded.tokenVersion !== undefined &&
        userDoc.tokenVersion !== undefined &&
        decoded.tokenVersion !== userDoc.tokenVersion
      ) {
        return next(new UnauthorizedError('Session invalidated. Please login again.'));
      }

      // ── 7. Attach user to request ─────────────────────────────────────────
      req.user = {
        userId:      decoded.userId,
        email:       userDoc.email,
        role:        userDoc.role,
        displayName: userDoc.displayName || 'User',
        photoURL:    userDoc.photoURL    || '',
      };

      next();
    } catch {
      next(new UnauthorizedError('Authentication failed'));
    }
  }

  /**
   * Role-based access control guard. Must come AFTER authenticate.
   *
   * Usage:
   *   router.delete('/x', protect, authorize('admin'), handler);
   *   router.put('/y',    protect, authorize('admin', 'moderator'), handler);
   */
  static authorize(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }
      if (!allowedRoles.includes(req.user.role)) {
        return next(
          new ForbiddenError(
            `Access denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`
          )
        );
      }
      next();
    };
  }

  /**
   * Optional authentication — attaches req.user if valid token present,
   * continues silently if not. Use for public endpoints with richer auth responses.
   */
  static async optional(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return next();

      const token = authHeader.split(' ')[1];
      if (!token || token === 'null' || token === 'undefined') return next();
      if (await isTokenBlacklisted(token)) return next();

      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      if (decoded.type !== 'access') return next();

      const userDoc = await User.findOne(
        { _id: decoded.userId, isActive: true, isDeleted: false },
        'email role displayName photoURL'
      ).lean();

      if (userDoc) {
        req.user = {
          userId:      decoded.userId,
          email:       userDoc.email,
          role:        userDoc.role,
          displayName: userDoc.displayName || 'User',
          photoURL:    userDoc.photoURL    || '',
        };
      }

      next();
    } catch {
      next(); // Any failure → continue without user
    }
  }
}

// ============================================================
// Named exports  (drop-in for all existing route files)
// ============================================================
export const protect      = AuthMiddleware.authenticate;
export const authorize    = AuthMiddleware.authorize;
export const optionalAuth = AuthMiddleware.optional;
// import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
// import { config } from '../../config';
// import { User } from './auth.model';
// import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';
// import { AuthenticatedRequest } from '../../shared/types/common.types';
// import { logger } from '../../config/logger';

// // ============================================================
// // Types
// // ============================================================

// export interface JwtPayload {
//   userId: string;
//   role?: string;
//   type: 'access' | 'refresh';
//   iat?: number;
//   exp?: number;
//   iss?: string;
// }

// // ============================================================
// // Auth Middleware Class
// // ============================================================

// export class AuthMiddleware {
//   /**
//    * Authenticate request using Bearer JWT access token.
//    * Attaches user info to req.user on success.
//    */
//   static async authenticate(
//     req: AuthenticatedRequest,
//     _res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       // Extract token from Authorization header
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         throw new UnauthorizedError('No authentication token provided');
//       }

//       const token = authHeader.split(' ')[1];
//       if (!token || token === 'null' || token === 'undefined') {
//         throw new UnauthorizedError('Invalid authentication token');
//       }

//       // Verify JWT signature + expiry
//       let decoded: JwtPayload;
//       try {
//         decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
//       } catch (error: any) {
//         if (error.name === 'TokenExpiredError') {
//           throw new UnauthorizedError('Token has expired. Please refresh your token.');
//         }
//         if (error.name === 'JsonWebTokenError') {
//           throw new UnauthorizedError('Invalid token. Please login again.');
//         }
//         throw new UnauthorizedError('Token verification failed');
//       }

//       // Validate token type — only access tokens allowed for API access
//       if (decoded.type !== 'access') {
//         throw new UnauthorizedError('Invalid token type. Use access token for API requests.');
//       }

//       // Read user from DATABASE (not token) to get current role
//       // This ensures role changes take effect immediately
//       // const user = await User.findOne(
//       //   { 
//       //     _id: decoded.userId,
//       //     isActive: true,
//       //     isDeleted: false,
//       //   },
//       //   'email role isActive isDeleted'
//       // ).lean();

//       // if (!user) {
//       //   throw new UnauthorizedError('Account not found or has been deactivated');
//       // }

//       // // Attach user to request
//       // req.user = {
//       //   userId: decoded.userId,
//       //   email: user.email,
//       //   role: user.role,
//       // };
//       // ✅ UPGRADED:
//       const user = await User.findOne(
//         { _id: decoded.userId, isActive: true, isDeleted: false },
//         'email role displayName photoURL isActive isDeleted'  // ← ADDED
//       ).lean();

//       if (!user) {
//         throw new UnauthorizedError('Account not found or has been deactivated');
//       }

//       req.user = {
//         userId: decoded.userId,
//         email: user.email,
//         role: user.role,
//         displayName: user.displayName || 'User',   // ← ADDED
//         photoURL: user.photoURL || '',             // ← ADDED
//       };

//       next();
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Role-based authorization guard.
//    * Use after authenticate middleware.
//    */
//   static authorize(...allowedRoles: string[]) {
//     return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
//       try {
//         if (!req.user) {
//           throw new UnauthorizedError('Authentication required');
//         }

//         if (!allowedRoles.includes(req.user.role)) {
//           throw new ForbiddenError(
//             `Access denied. Required role: ${allowedRoles.join(' or ')}`
//           );
//         }

//         next();
//       } catch (error) {
//         next(error);
//       }
//     };
//   }

//   /**
//    * Optional authentication — attaches user if token present, continues if not.
//    * Useful for public endpoints that behave differently for logged-in users.
//    */
//   static async optional(
//     req: AuthenticatedRequest,
//     _res: Response,
//     next: NextFunction
//   ): Promise<void> {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return next(); // No token — continue without user
//       }

//       const token = authHeader.split(' ')[1];
//       if (!token || token === 'null') {
//         return next();
//       }

//       const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

//       if (decoded.type !== 'access') {
//         return next(); // Wrong token type — continue without user
//       }

//       const user = await User.findOne(
//         { _id: decoded.userId, isActive: true, isDeleted: false },
//         'email role'
//       ).lean();

//       if (user) {
//         req.user = {
//           userId: decoded.userId,
//           email: user.email,
//           role: user.role,
//         };
//       }

//       next();
//     } catch {
//       // Token invalid/expired — continue without user
//       next();
//     }
//   }
// }

// // ============================================================
// // Convenience Exports
// // ============================================================

// export const protect = AuthMiddleware.authenticate;
// export const authorize = AuthMiddleware.authorize;
// export const optionalAuth = AuthMiddleware.optional;
