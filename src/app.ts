import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { IdempotencyMiddleware } from './middleware/idempotency.middleware';
import { publicRateLimiter, authenticatedRateLimiter } from './middleware/rateLimiter.middleware';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import groupRoutes from './modules/group/group.routes';
import expenseRoutes from './modules/expense/expense.routes';
import settlementRoutes from './modules/settlement/settlement.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import receiptRoutes from './modules/receipt/receipt.routes';
import notificationRoutes from './modules/notification/notification.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}));

// Performance middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging
app.use(requestLogger);

// Public rate limiting
app.use('/api/', publicRateLimiter);

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
app.use('/api/v1/auth', authenticatedRateLimiter, authRoutes);
app.use('/api/v1/users', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, userRoutes);
app.use('/api/v1/groups', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, groupRoutes);
app.use('/api/v1/expenses', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, expenseRoutes);
app.use('/api/v1/settlements', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, settlementRoutes);
app.use('/api/v1/analytics', authenticatedRateLimiter, analyticsRoutes);
app.use('/api/v1/receipts', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, receiptRoutes);
app.use('/api/v1/notifications', authenticatedRateLimiter, notificationRoutes);

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
app.use(errorHandler);

export default app;