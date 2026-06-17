import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { User } from './auth.model';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';
import { AuthenticatedRequest } from '../../shared/types/common.types';

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

  static authorize(...roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new UnauthorizedError('Authentication required');
        }

        if (roles.length > 0 && !roles.includes(req.user.role)) {
          throw new ForbiddenError('Insufficient permissions');
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}
