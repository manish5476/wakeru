"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyMiddleware = void 0;
const redis_1 = require("../config/redis");
const AppError_1 = require("../shared/errors/AppError");
const crypto_1 = __importDefault(require("crypto"));
class IdempotencyMiddleware {
    static async checkIdempotency(req, res, next) {
        try {
            if (req.method === 'GET')
                return next();
            const idempotencyKey = req.headers['idempotency-key'];
            if (!idempotencyKey) {
                throw new AppError_1.AppError(400, 'Idempotency-Key header is required for mutation operations', 'IDEMPOTENCY_KEY_MISSING');
            }
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(idempotencyKey)) {
                throw new AppError_1.AppError(400, 'Invalid Idempotency-Key format. Must be UUID v4', 'INVALID_IDEMPOTENCY_KEY');
            }
            const cacheKey = `idempotency:${idempotencyKey}`;
            const cachedResponse = await redis_1.redisClient.get(cacheKey);
            if (cachedResponse) {
                const parsed = JSON.parse(cachedResponse);
                if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                    res.status(parsed.status).json(parsed.body);
                    return;
                }
            }
            const fingerprint = crypto_1.default
                .createHash('sha256')
                .update(JSON.stringify({
                method: req.method,
                path: req.path,
                body: req.body,
                userId: req.user?.id
            }))
                .digest('hex');
            await redis_1.redisClient.set(`${cacheKey}:lock`, fingerprint, 10);
            req.idempotencyKey = idempotencyKey;
            req.idempotencyCacheKey = cacheKey;
            const originalJson = res.json.bind(res);
            res.json = function (body) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis_1.redisClient.set(cacheKey, JSON.stringify({
                        status: res.statusCode,
                        body,
                        timestamp: Date.now()
                    }), 24 * 60 * 60).catch(console.error);
                }
                redis_1.redisClient.delete(`${cacheKey}:lock`).catch(console.error);
                return originalJson(body);
            };
            next();
        }
        catch (error) {
            next(error);
        }
    }
}
exports.IdempotencyMiddleware = IdempotencyMiddleware;
//# sourceMappingURL=idempotency.middleware.js.map