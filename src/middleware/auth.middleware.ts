import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../modules/auth/auth.model';
import { UnauthorizedError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from '../shared/types/common.types';

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'a-very-secret-key') as { id: string };

      // Get user from the token
      const userDoc = await User.findById(decoded.id);

      if (!userDoc) {
        return next(new UnauthorizedError('User belonging to this token does no longer exist.'));
      }

      // Attach a lean user object to the request that matches the AuthenticatedRequest type
      req.user = {
        userId: userDoc.userId,
        email: userDoc.email,
        role: userDoc.role,
      };

      next();
    } catch (error) {
      return next(new UnauthorizedError('Not authorized, token failed'));
    }
  }

  if (!token) {
    return next(new UnauthorizedError('Not authorized, no token'));
  }
};
