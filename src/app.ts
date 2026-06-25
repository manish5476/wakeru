import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { IdempotencyMiddleware } from './middleware/idempotency.middleware';
import {
  publicRateLimiter,
  authenticatedRateLimiter,
  strictRateLimiter,        // FIX 1: imported but was unused before
} from './middleware/rateLimiter.middleware';

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

const app = express();

// ============================================================
// Security Middleware
// ============================================================

// FIX 2: Helmet with explicit CSP — don't rely on defaults in production.
// Adjust directives to match your frontend domain(s).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // FIX 3: Prevent MIME-type sniffing
    noSniff: true,
    // FIX 4: Force HTTPS in production
    hsts: config.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    // FIX 5: Hide X-Powered-By
    hidePoweredBy: true,
  })
);

// FIX 6: Tighten CORS — explicitly list allowed origins rather than
// splitting a single string. Reflect origin only if it's whitelisted.
const allowedOrigins: string[] =
  config.ALLOWED_ORIGINS === '*'
    ? ['*']
    : config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    // FIX 7: Expose rate-limit headers to clients so they can back off
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  })
);

// ============================================================
// Performance Middleware
// ============================================================
app.use(compression());

// FIX 8: Reduce JSON body limit — 10mb is too large for a standard API.
// Only receipt/OCR upload routes need large payloads; set a sensible default
// and override per-route where needed (e.g. receiptRoutes handles multipart).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================================
// Static Files
// ============================================================
// FIX 9: Disable directory listing and dot-file serving for uploads
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    dotfiles: 'deny',
    index: false,
  })
);

// ============================================================
// Request Logging
// ============================================================
app.use(requestLogger);

// ============================================================
// Global Public Rate Limiting
// ============================================================
// FIX 10: Apply publicRateLimiter to ALL /api/ traffic as a baseline.
// Individual route groups then layer their own stricter limiters on top.
app.use('/api/', publicRateLimiter);

// ============================================================
// Health Checks (No Auth Required)
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

// FIX 11: Remove require() inside route handler — move import to top level.
// Dynamic require inside a request handler causes a blocking filesystem read
// on every call and defeats module caching.
import { socketServer } from './infrastructure/websocket/socket.server';

app.get('/ws-health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    onlineUsers: socketServer.getOnlineCount(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// API Routes
// ============================================================

// FIX 1 (CRITICAL): Auth routes MUST use strictRateLimiter to prevent
// brute-force attacks on login/register/forgot-password.
// The original code used authenticatedRateLimiter here — that's too lenient.
// NO idempotency on auth routes (token generation is intentionally non-idempotent).
app.use('/api/v1/auth', strictRateLimiter, authRoutes);

// User routes
app.use(
  '/api/v1/users',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  userRoutes
);

// Trip routes
app.use(
  '/api/v1/trips',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  tripRoutes
);

// Expense routes
app.use(
  '/api/v1/expenses',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  expenseRoutes
);

// Settlement routes
app.use(
  '/api/v1/settlements',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  settlementRoutes
);

// Analytics — read-only, no idempotency needed
app.use('/api/v1/analytics', authenticatedRateLimiter, analyticsRoutes);

// Receipt routes — uploads need larger body limit, handled at route level
app.use(
  '/api/v1/receipts',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  receiptRoutes
);

// Notification routes — read-heavy, no idempotency needed
app.use('/api/v1/notifications', authenticatedRateLimiter, notificationRoutes);

// Invitation routes
app.use(
  '/api/v1/invitations',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  invitationRoutes
);

// Friends routes
app.use(
  '/api/v1/friends',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  friendsRoutes
);

// Reminders routes
app.use(
  '/api/v1/reminders',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  remindersRoutes
);

// Dashboard — read-only, no idempotency needed
app.use('/api/v1/dashboard', authenticatedRateLimiter, dashboardRoutes);

// Person routes
app.use(
  '/api/v1/person',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  personRoutes
);

// Feedback routes
app.use(
  '/api/v1/feedback',
  authenticatedRateLimiter,
  IdempotencyMiddleware.checkIdempotency,
  feedbackRoutes
);

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
// IMPORTANT: Must be registered LAST — after all routes and
// other middleware. Express identifies error handlers by their
// 4-argument signature (err, req, res, next).
// ============================================================
app.use(errorHandler);

export default app;
// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import compression from 'compression';
// import path from 'path';
// import { config } from './config';
// import { errorHandler } from './middleware/errorHandler.middleware';
// import { requestLogger } from './middleware/requestLogger.middleware';
// import { IdempotencyMiddleware } from './middleware/idempotency.middleware';
// import { publicRateLimiter, authenticatedRateLimiter } from './middleware/rateLimiter.middleware';

// // Import routes
// import { authRoutes } from './modules/auth';
// import userRoutes from './modules/user/user.routes';
// import tripRoutes from './modules/trips/trip.routes';
// import expenseRoutes from './modules/expense/expense.routes';
// import settlementRoutes from './modules/settlement/settlement.routes';
// import analyticsRoutes from './modules/analytics/analytics.routes';
// import receiptRoutes from './modules/receipt/receipt.routes';
// import notificationRoutes from './modules/notification/notification.routes';
// import invitationRoutes from './modules/trips/invitation.routes';
// import friendsRoutes from './modules/friends/friends.routes';
// import remindersRoutes from './modules/reminders/reminders.routes';
// import dashboardRoutes from './modules/dashboard/dashboard.routes';
// import personRoutes from './modules/person/person.routes';
// import feedbackRoutes from './modules/feedback/feedback.routes';
// const app = express();

// // ============================================================
// // Security Middleware
// // ============================================================
// app.use(helmet());
// app.use(cors({
//   origin: config.ALLOWED_ORIGINS === '*' ? true : config.ALLOWED_ORIGINS.split(','),
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
// }));

// // ============================================================
// // Performance Middleware
// // ============================================================
// app.use(compression());
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // ============================================================
// // Static Files
// // ============================================================
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// // ============================================================
// // Request Logging
// // ============================================================
// app.use(requestLogger);

// // ============================================================
// // Rate Limiting (Public)
// // ============================================================
// app.use('/api/', publicRateLimiter);

// // ============================================================
// // Health Check (No Auth Required)
// // ============================================================
// app.get('/health', (_req, res) => {
//   res.status(200).json({
//     status: 'healthy',
//     service: 'WAKERU API',
//     version: '1.0.0',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//   });
// });

// // ============================================================
// // WebSocket Health Check
// // ============================================================
// app.get('/ws-health', (_req, res) => {
//   const { socketServer } = require('./infrastructure/websocket/socket.server');
//   res.status(200).json({
//     status: 'healthy',
//     onlineUsers: socketServer.getOnlineCount(),
//     timestamp: new Date().toISOString(),
//   });
// });

// // ============================================================
// // API Routes
// // ============================================================

// // Auth routes — has its own strict rate limiting for login/register
// app.use('/api/v1/auth', authenticatedRateLimiter, authRoutes);

// // User routes
// app.use('/api/v1/users', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, userRoutes);

// // Trip routes
// app.use('/api/v1/trips', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, tripRoutes);

// // Expense routes
// app.use('/api/v1/expenses', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, expenseRoutes);

// // Settlement routes
// app.use('/api/v1/settlements', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, settlementRoutes);

// // Analytics routes
// app.use('/api/v1/analytics', authenticatedRateLimiter, analyticsRoutes);

// // Receipt routes
// app.use('/api/v1/receipts', authenticatedRateLimiter, IdempotencyMiddleware.checkIdempotency, receiptRoutes);

// // Notification routes
// app.use('/api/v1/notifications', authenticatedRateLimiter, notificationRoutes);

// app.use('/api/v1/invitations', authenticatedRateLimiter, invitationRoutes);
// app.use('/api/v1/friends', authenticatedRateLimiter, friendsRoutes);
// app.use('/api/v1/reminders', authenticatedRateLimiter, remindersRoutes);
// app.use('/api/v1/dashboard', authenticatedRateLimiter, dashboardRoutes);
// app.use('/api/v1/person', authenticatedRateLimiter, personRoutes);
// app.use('/api/v1/feedback', authenticatedRateLimiter, feedbackRoutes);



// // ============================================================
// // 404 Handler
// // ============================================================
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     error: {
//       code: 'NOT_FOUND',
//       message: `Route ${req.method} ${req.path} not found`,
//     },
//     timestamp: new Date().toISOString(),
//   });
// });

// // ============================================================
// // Global Error Handler
// // ============================================================
// app.use(errorHandler);

// export default app;