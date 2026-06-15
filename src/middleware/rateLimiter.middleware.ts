import rateLimit from 'express-rate-limit';
import { CONSTANTS } from '../config/constants';

export const publicRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.PUBLIC.windowMs,
  max: CONSTANTS.RATE_LIMITS.PUBLIC.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const authenticatedRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.AUTHENTICATED.windowMs,
  max: CONSTANTS.RATE_LIMITS.AUTHENTICATED.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const expenseCreateRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.windowMs,
  max: CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many expenses created, please slow down'
    }
  }
});

export const ocrUploadRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.OCR_UPLOAD.windowMs,
  max: CONSTANTS.RATE_LIMITS.OCR_UPLOAD.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many uploads, please try again later'
    }
  }
});