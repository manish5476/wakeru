import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { logger } from '../config/logger';
import { config } from '../config';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: (req as any).user?.userId
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    const code = err.code || 'APP_ERROR';
    const message = err.message || 'An error occurred';
    res.status(err.statusCode).json({
      success: false,
      message,
      code,
      details: err.details,
      error: {
        code,
        message,
        details: err.details,
      },
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = (err as any).errors;
    res.status(400).json({
      success: false,
      message: err.message,
      code: 'VALIDATION_ERROR',
      details,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details,
      },
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle Mongoose duplicate key errors
  if ((err as any).code === 11000) {
    const keys = Object.keys((err as any).keyValue || {}).join(', ');
    const msg = keys ? `A record with this ${keys} already exists` : 'Duplicate entry found';
    res.status(409).json({
      success: false,
      message: msg,
      code: 'DUPLICATE_ENTRY',
      details: (err as any).keyValue,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: msg,
        details: (err as any).keyValue,
      },
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const msg = 'Invalid authentication token';
    res.status(401).json({
      success: false,
      message: msg,
      code: 'INVALID_TOKEN',
      error: {
        code: 'INVALID_TOKEN',
        message: msg,
      },
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const msg = 'Authentication token has expired';
    res.status(401).json({
      success: false,
      message: msg,
      code: 'TOKEN_EXPIRED',
      error: {
        code: 'TOKEN_EXPIRED',
        message: msg,
      },
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    res.status(400).json({
      success: false,
      message: err.message,
      code: 'UPLOAD_ERROR',
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message,
      },
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message = config.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message || 'An unexpected error occurred';
  const code = (err as any).code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    message,
    code,
    error: {
      code,
      message,
    },
    stack: config.NODE_ENV === 'development' ? err.stack : undefined
  });
};
