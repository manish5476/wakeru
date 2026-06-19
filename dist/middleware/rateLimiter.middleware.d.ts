export declare const publicRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authenticatedRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute force attacks on login/register/forgot-password.
 *
 * 10 requests per 15 minutes per IP — very strict.
 */
export declare const strictRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Slightly more lenient auth limiter — 30 requests per 15 minutes.
 * Use for token refresh and other auth-related but less sensitive endpoints.
 */
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const expenseCreateRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const ocrUploadRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * UPI verification rate limiter.
 * Prevents abuse of penny drop verification.
 */
export declare const upiVerificationRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.middleware.d.ts.map