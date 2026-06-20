import rateLimit from 'express-rate-limit';
import { CONSTANTS } from '../config/constants';

// ============================================================
// Standard Rate Limiters
// ============================================================

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
  legacyHeaders: false,
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
  legacyHeaders: false,
});

// ============================================================
// Strict Rate Limiters — Auth Endpoints
// ============================================================

/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute force attacks on login/register/forgot-password.
 * 
 * 10 requests per 15 minutes per IP — very strict.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // Relax in dev
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts, even successful ones
});

/**
 * Slightly more lenient auth limiter — 30 requests per 15 minutes.
 * Use for token refresh and other auth-related but less sensitive endpoints.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                    // 30 attempts per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Feature-Specific Rate Limiters
// ============================================================

export const expenseCreateRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.windowMs,
  max: CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many expenses created, please slow down'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
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
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * UPI verification rate limiter.
 * Prevents abuse of penny drop verification.
 */
export const upiVerificationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,                     // 3 attempts per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many UPI verification attempts. Please try again in 1 hour.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});