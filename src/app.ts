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
import { authRoutes } from './modules/auth';
import userRoutes from './modules/user/user.routes';
import tripRoutes from './modules/trips/trip.routes';
import expenseRoutes from './modules/expense/expense.routes';
import settlementRoutes from './modules/settlement/settlement.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import receiptRoutes from './modules/receipt/receipt.routes';
import notificationRoutes from './modules/notification/notification.routes';
import invitationRoutes from './modules/trips/invitation.routes';
import friendsRoutes from './modules/friends/friends.routes';
import remindersRoutes from './modules/reminders/reminders.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import personRoutes from './modules/person/person.routes';
import feedbackRoutes from './modules/feedback/feedback.routes';
import { financeRoutes } from './modules/finance';
const app = express();

// ============================================================
// Security Middleware
// ============================================================
app.use(helmet());
app.use(cors({
  origin: config.ALLOWED_ORIGINS === '*' ? true : config.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

// ============================================================
// Performance Middleware
// ============================================================
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// Static Files
// ============================================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// Request Logging
// ============================================================
app.use(requestLogger);

// ============================================================
// Rate Limiting (Public)
// ============================================================
app.use('/api/', publicRateLimiter);

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
app.use('/api/v1/auth', authenticatedRateLimiter, authRoutes);

// User routes
app.use('/api/v1/users', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, userRoutes);

// Trip routes
app.use('/api/v1/trips', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, tripRoutes);

// Expense routes
app.use('/api/v1/expenses', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, expenseRoutes);

// Settlement routes
app.use('/api/v1/settlements', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, settlementRoutes);

// Analytics routes
app.use('/api/v1/analytics', authenticatedRateLimiter, analyticsRoutes);

// Receipt routes
app.use('/api/v1/receipts', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, receiptRoutes);

// Notification routes
app.use('/api/v1/notifications', authenticatedRateLimiter, notificationRoutes);

app.use('/api/v1/invitations', authenticatedRateLimiter, invitationRoutes);
app.use('/api/v1/friends', authenticatedRateLimiter, friendsRoutes);
app.use('/api/v1/reminders', authenticatedRateLimiter, remindersRoutes);
app.use('/api/v1/dashboard', authenticatedRateLimiter, dashboardRoutes);
app.use('/api/v1/person', authenticatedRateLimiter, personRoutes);
app.use('/api/v1/feedback', authenticatedRateLimiter, feedbackRoutes);
app.use('/api/v1/finance', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, financeRoutes);



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
app.use(errorHandler);

export default app;