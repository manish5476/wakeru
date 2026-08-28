import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { CONSTANTS } from '../config/constants';
import { config } from '../config';
import { redisClient } from '../config/redis';

// A configured managed Redis service makes limits shared by every API instance.
// Local development retains express-rate-limit's in-memory store.
// express-rate-limit requires unique store instances per limiter with distinct prefixes.
const createStore = (prefix: string) => {
  if (config.REDIS_URL && config.REDIS_URL !== 'redis://localhost:6379') {
    return new RedisStore({
      prefix: `rate-limit:${prefix}:`,
      sendCommand: (...args: string[]) => (redisClient.client.call as (...command: string[]) => Promise<any>)(...args),
    });
  }
  return undefined;
};

const message = (text: string) => ({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: text } });

export const publicRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.PUBLIC.windowMs,
  max: CONSTANTS.RATE_LIMITS.PUBLIC.max,
  message: message('Too many requests, please try again later'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('public'),
});

export const authenticatedRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.AUTHENTICATED.windowMs,
  max: CONSTANTS.RATE_LIMITS.AUTHENTICATED.max,
  message: message('Too many requests, please try again later'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth-user'),
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  message: message('Too many authentication attempts. Please try again in 15 minutes.'),
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('strict'),
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: message('Too many requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
});

export const expenseCreateRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.windowMs,
  max: CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.max,
  message: message('Too many expenses created, please slow down'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('expense-create'),
});

export const ocrUploadRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.OCR_UPLOAD.windowMs,
  max: CONSTANTS.RATE_LIMITS.OCR_UPLOAD.max,
  message: message('Too many uploads, please try again later'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('ocr-upload'),
});

export const feedbackRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: message('Too many feedback submissions, please try again later'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('feedback'),
});

export const upiVerificationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: message('Too many UPI verification attempts. Please try again in 1 hour.'),
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('upi-verify'),
});
