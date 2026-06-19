import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';
import { ValidationError } from '@shared/errors/AppError';

export class ValidationMiddleware {
  static validate(schema: ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const errorMessages = error.issues.map((issue) => ({
            message: `${issue.path.join('.')} is ${issue.message}`,
          }));
          next(new ValidationError('Invalid input', errorMessages));
        } else {
          next(error);
        }
      }
    };
  }

  static validateQuery(schema: ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        schema.parse(req.query);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const errorMessages = error.issues.map((issue) => ({
            message: `${issue.path.join('.')} is ${issue.message}`,
          }));
          next(new ValidationError('Invalid query parameters', errorMessages));
        } else {
          next(error);
        }
      }
    };
  }

  static validateParams(schema: ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        schema.parse(req.params);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const errorMessages = error.issues.map((issue) => ({
            message: `${issue.path.join('.')} is ${issue.message}`,
          }));
          next(new ValidationError('Invalid path parameters', errorMessages));
        } else {
          next(error);
        }
      }
    };
  }
}
