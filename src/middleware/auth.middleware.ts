import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../modules/auth/auth.model';
import { UnauthorizedError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from '../shared/types/common.types';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  role?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

interface CachedUser {
  data: {
    userId: string;
    firebaseUid: string;
    email: string;
    role: string;
    displayName: string;
    photoURL: string;
  };
  expiresAt: number;
}

const userAuthCache = new Map<string, CachedUser>();
const USER_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const invalidateUserAuthCache = (userId: string): void => {
  userAuthCache.delete(userId);
};

/**
 * Authentication middleware — verifies JWT access token.
 * Attaches user info to req.user on success.
 */
export const protect = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Not authorized, no token provided'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new UnauthorizedError('Not authorized, no token provided'));
    }

    // 2. Verify JWT
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        token,
        config.JWT_SECRET
      ) as JwtPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return next(new UnauthorizedError('Token has expired. Please login again.'));
      }
      return next(new UnauthorizedError('Invalid token. Please login again.'));
    }

    // 3. Validate token type
    if (decoded.type !== 'access') {
      return next(new UnauthorizedError('Invalid token type. Use access token for API requests.'));
    }

    // 4. Resolve user (Check fast in-memory cache first to avoid ~20ms MongoDB overhead per request)
    const now = Date.now();
    let userRecord = userAuthCache.get(decoded.userId);

    if (!userRecord || userRecord.expiresAt < now) {
      const userDoc = await User.findOne({
        _id: decoded.userId,
        isActive: true,
        isDeleted: false,
      }).select('email role displayName photoURL isActive isDeleted firebaseUid').lean();

      if (!userDoc) {
        userAuthCache.delete(decoded.userId);
        return next(new UnauthorizedError('User no longer exists or account is deactivated.'));
      }

      let effectiveRole = userDoc.role;
      const normalizedEmail = (userDoc.email || '').toLowerCase().trim();
      if (config.ADMIN_EMAILS.includes(normalizedEmail)) {
        effectiveRole = 'admin';
        if (userDoc.role !== 'admin') {
          User.updateOne({ _id: userDoc._id }, { $set: { role: 'admin' } }).catch(() => {});
        }
      }

      userRecord = {
        data: {
          userId: decoded.userId,
          firebaseUid: (userDoc as any).firebaseUid || decoded.userId,
          email: userDoc.email,
          role: effectiveRole,
          displayName: userDoc.displayName || 'User',
          photoURL: userDoc.photoURL || '',
        },
        expiresAt: now + USER_CACHE_TTL_MS,
      };

      // Cap cache size to prevent memory leaks
      if (userAuthCache.size > 5000) {
        userAuthCache.clear();
      }
      userAuthCache.set(decoded.userId, userRecord);
    }

    // 5. Attach user to request
    req.user = userRecord.data;

    next();
  } catch (error) {
    return next(new UnauthorizedError('Not authorized, authentication failed'));
  }
};

/**
 * Role-based authorization middleware.
 * Must be used AFTER protect middleware.
 * 
 * Usage: router.post('/admin', protect, authorize('admin'), handler);
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }

    next();
  };
};
