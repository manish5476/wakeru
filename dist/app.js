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
const trip_routes_1 = __importDefault(require("./modules/trips/trip.routes"));
const expense_routes_1 = __importDefault(require("./modules/expense/expense.routes"));
const settlement_routes_1 = __importDefault(require("./modules/settlement/settlement.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const receipt_routes_1 = __importDefault(require("./modules/receipt/receipt.routes"));
const notification_routes_1 = __importDefault(require("./modules/notification/notification.routes"));
const invitation_routes_1 = __importDefault(require("./modules/trips/invitation.routes"));
const friends_routes_1 = __importDefault(require("./modules/friends/friends.routes"));
const reminders_routes_1 = __importDefault(require("./modules/reminders/reminders.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const person_routes_1 = __importDefault(require("./modules/person/person.routes"));
const feedback_routes_1 = __importDefault(require("./modules/feedback/feedback.routes"));
const finance_1 = require("./modules/finance");
const app = (0, express_1.default)();
// ============================================================
// Security Middleware
// ============================================================
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.ALLOWED_ORIGINS === '*' ? true : config_1.config.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));
// ============================================================
// Performance Middleware
// ============================================================
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// ============================================================
// Static Files
// ============================================================
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// ============================================================
// Request Logging
// ============================================================
app.use(requestLogger_middleware_1.requestLogger);
// ============================================================
// Rate Limiting (Public)
// ============================================================
app.use('/api/', rateLimiter_middleware_1.publicRateLimiter);
// ============================================================
// Health Check (No Auth Required)
// ============================================================
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'WAKERU API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// ============================================================
// WebSocket Health Check
// ============================================================
app.get('/ws-health', (_req, res) => {
    const { socketServer } = require('./infrastructure/websocket/socket.server');
    res.status(200).json({
        status: 'healthy',
        onlineUsers: socketServer.getOnlineCount(),
        timestamp: new Date().toISOString(),
    });
});
// ============================================================
// API Routes
// ============================================================
// Auth routes — has its own strict rate limiting for login/register
app.use('/api/v1/auth', rateLimiter_middleware_1.authenticatedRateLimiter, auth_1.authRoutes);
// User routes
app.use('/api/v1/users', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, user_routes_1.default);
// Trip routes
app.use('/api/v1/trips', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, trip_routes_1.default);
// Expense routes
app.use('/api/v1/expenses', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, expense_routes_1.default);
// Settlement routes
app.use('/api/v1/settlements', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, settlement_routes_1.default);
// Analytics routes
app.use('/api/v1/analytics', rateLimiter_middleware_1.authenticatedRateLimiter, analytics_routes_1.default);
// Receipt routes
app.use('/api/v1/receipts', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, receipt_routes_1.default);
// Notification routes
app.use('/api/v1/notifications', rateLimiter_middleware_1.authenticatedRateLimiter, notification_routes_1.default);
app.use('/api/v1/invitations', rateLimiter_middleware_1.authenticatedRateLimiter, invitation_routes_1.default);
app.use('/api/v1/friends', rateLimiter_middleware_1.authenticatedRateLimiter, friends_routes_1.default);
app.use('/api/v1/reminders', rateLimiter_middleware_1.authenticatedRateLimiter, reminders_routes_1.default);
app.use('/api/v1/dashboard', rateLimiter_middleware_1.authenticatedRateLimiter, dashboard_routes_1.default);
app.use('/api/v1/person', rateLimiter_middleware_1.authenticatedRateLimiter, person_routes_1.default);
app.use('/api/v1/feedback', rateLimiter_middleware_1.authenticatedRateLimiter, feedback_routes_1.default);
app.use('/api/v1/finance', rateLimiter_middleware_1.authenticatedRateLimiter, idempotency_middleware_1.IdempotencyMiddleware.checkIdempotency, finance_1.financeRoutes);
// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
        timestamp: new Date().toISOString(),
    });
});
// ============================================================
// Global Error Handler
// ============================================================
app.use(errorHandler_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map