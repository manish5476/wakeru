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
        throw new AppError('Idempotency-Key header is required for mutation operations', 400, 'IDEMPOTENCY_KEY_MISSING');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idempotencyKey)) {
        throw new AppError('Invalid Idempotency-Key format. Must be UUID v4', 400, 'INVALID_IDEMPOTENCY_KEY');
      }

      const cacheKey = `idempotency:${idempotencyKey}`;
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          res.status(parsed.status).json(parsed.body);
          return;
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

      await redisClient.set(
        `${cacheKey}:lock`,
        fingerprint,
        10
      );

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
