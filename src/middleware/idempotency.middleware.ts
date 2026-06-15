import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import { AppError } from '../shared/errors/AppError';
import crypto from 'crypto';

export class IdempotencyMiddleware {
  static async checkIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.method === 'GET') return next();

      const idempotencyKey = req.headers['idempotency-key'] as string;

      if (!idempotencyKey) {
        throw new AppError(400, 'Idempotency-Key header is required for mutation operations', 'IDEMPOTENCY_KEY_MISSING');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idempotencyKey)) {
        throw new AppError(400, 'Invalid Idempotency-Key format. Must be UUID v4', 'INVALID_IDEMPOTENCY_KEY');
      }

      const cacheKey = `idempotency:${idempotencyKey}`;
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return res.status(parsed.status).json(parsed.body);
        }
      }

      const fingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          method: req.method,
          path: req.path,
          body: req.body,
          userId: (req as any).user?.id
        }))
        .digest('hex');

      const lockAcquired = await redisClient.set(
        `${cacheKey}:lock`,
        fingerprint,
        10 // 10 second lock
      );

      if (!lockAcquired) {
        throw new AppError(409, 'Duplicate request detected. Previous request is being processed.', 'DUPLICATE_REQUEST');
      }

      (req as any).idempotencyKey = idempotencyKey;
      (req as any).idempotencyCacheKey = cacheKey;

      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisClient.set(
            cacheKey,
            JSON.stringify({
              status: res.statusCode,
              body,
              timestamp: Date.now()
            }),
            24 * 60 * 60
          ).catch(console.error);
        }

        redisClient.delete(`${cacheKey}:lock`).catch(console.error);
        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  }
}
// // src/middleware/idempotency.middleware.ts

// import { Request, Response, NextFunction } from 'express';
// import Redis from 'ioredis';
// import crypto from 'crypto';
// import { AppError } from '../shared/errors/AppError';

// const redis = new Redis(process.env.REDIS_URL!);

// export class IdempotencyMiddleware {
//   /**
//    * ENTERPRISE FEATURE: Prevents duplicate financial transactions
//    * Essential for mobile apps where network drops are common
//    */
//   static async checkIdempotency(
//     req: Request, 
//     res: Response, 
//     next: NextFunction
//   ) {
//     try {
//       // Skip for GET requests
//       if (req.method === 'GET') {
//         return next();
//       }

//       const idempotencyKey = req.headers['idempotency-key'] as string;

//       if (!idempotencyKey) {
//         throw new AppError(400, 'Idempotency-Key header is required for mutation operations');
//       }

//       // Validate UUID format
//       const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//       if (!uuidRegex.test(idempotencyKey)) {
//         throw new AppError(400, 'Invalid Idempotency-Key format. Must be UUID v4');
//       }

//       const cacheKey = `idempotency:${idempotencyKey}`;

//       // Check if this request was already processed
//       const cachedResponse = await redis.get(cacheKey);

//       if (cachedResponse) {
//         const parsed = JSON.parse(cachedResponse);
        
//         // Return the original response if within 24 hours
//         if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
//           return res.status(parsed.status).json(parsed.body);
//         }
//       }

//       // Store request fingerprint to prevent concurrent duplicates
//       const fingerprint = crypto
//         .createHash('sha256')
//         .update(JSON.stringify({
//           method: req.method,
//           path: req.path,
//           body: req.body,
//           userId: (req as any).user?.id
//         }))
//         .digest('hex');

//       // SET NX (Only set if not exists) - Atomic operation
//       const lockAcquired = await redis.set(
//         `${cacheKey}:lock`,
//         fingerprint,
//         'NX',
//         'EX',
//         10 // 10 second lock
//       );

//       if (!lockAcquired) {
//         throw new AppError(409, 'Duplicate request detected. Previous request is being processed.');
//       }

//       // Attach to request for later use
//       (req as any).idempotencyKey = idempotencyKey;
//       (req as any).idempotencyCacheKey = cacheKey;

//       // Override res.json to cache the response
//       const originalJson = res.json.bind(res);
//       res.json = function(body: any) {
//         // Cache successful responses
//         if (res.statusCode >= 200 && res.statusCode < 300) {
//           redis.set(
//             cacheKey,
//             JSON.stringify({
//               status: res.statusCode,
//               body,
//               timestamp: Date.now()
//             }),
//             'EX',
//             24 * 60 * 60 // 24 hours
//           ).catch(console.error);
//         }

//         // Release lock
//         redis.del(`${cacheKey}:lock`).catch(console.error);

//         return originalJson(body);
//       };

//       next();
//     } catch (error) {
//       next(error);
//     }
//   }
// }