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
    body: req.body,
    user: (req as any).user?.userId
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: err.message,
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle Mongoose duplicate key errors
  if ((err as any).code === 11000) {
    res.status(409).json({
      success: false,
      error: 'Duplicate entry found: ' + JSON.stringify((err as any).keyValue),
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Authentication token has expired',
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    res.status(400).json({
      success: false,
      error: err.message,
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    });
    return;
  }

  // Default error
  const statusCode = (err as any).statusCode || 500;
  const message = config.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined
  });
};