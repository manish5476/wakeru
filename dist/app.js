"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const errorHandler_middleware_1 = require("./middleware/errorHandler.middleware");
const requestLogger_middleware_1 = require("./middleware/requestLogger.middleware");
const idempotency_middleware_1 = require("./middleware/idempotency.middleware");
const rateLimiter_middleware_1 = require("./middleware/rateLimiter.middleware");
// Import routes
const auth_1 = require("./modules/auth");
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const group_routes_1 = __importDefault(require("./modules/group/group.routes"));
const expense_routes_1 = __importDefault(require("./modules/expense/expense.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const receipt_routes_1 = __importDefault(require("./modules/receipt/receipt.routes"));
const notification_routes_1 = __importDefault(require("./modules/notification/notification.routes"));
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.ALLOWED_ORIGINS === '*' ? true : config_1.config.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}));
// Performance middleware
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static files
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Request logging
app.use(requestLogger_middleware_1.requestLogger);
// Public rate limiting
app.use('/api/', rateLimiter_middleware_1.publicRateLimiter);
// Health check (no auth required)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'WAKERU API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// API routes with idempotency check
app.use('/api/v1/auth', rateLimiter_middleware_1.authenticatedRateLimiter, auth_1.authRoutes);
app.use('/api/v1/users', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, user_routes_1.default);
app.use('/api/v1/groups', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, group_routes_1.default);
app.use('/api/v1/expenses', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, expense_routes_1.default);
app.use('/api/v1/analytics', rateLimiter_middleware_1.authenticatedRateLimiter, analytics_routes_1.default);
app.use('/api/v1/receipts', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, receipt_routes_1.default);
app.use('/api/v1/notifications', rateLimiter_middleware_1.authenticatedRateLimiter, notification_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        },
        timestamp: new Date().toISOString()
    });
});
// Global error handler
app.use(errorHandler_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map