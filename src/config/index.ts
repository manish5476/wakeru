import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_VERSION: process.env.API_VERSION || 'v1',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || '',
  MONGO_ROOT_USER: process.env.MONGO_ROOT_USER,
  MONGO_ROOT_PASSWORD: process.env.MONGO_ROOT_PASSWORD,

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION || '30d',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '30d',

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || '',
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || '',

  // OCR
  OCR_SERVICE_PROVIDER: process.env.OCR_SERVICE_PROVIDER || 'google_vision',
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY || '',
  AWS_TEXTRACT_ACCESS_KEY: process.env.AWS_TEXTRACT_ACCESS_KEY || '',
  AWS_TEXTRACT_SECRET_KEY: process.env.AWS_TEXTRACT_SECRET_KEY || '',

  // Payment Gateways
  UPI_MERCHANT_ID: process.env.UPI_MERCHANT_ID || '',
  UPI_API_KEY: process.env.UPI_API_KEY || '',

  // Exchange Rate API
  EXCHANGE_RATE_API_KEY: process.env.EXCHANGE_RATE_API_KEY || '',
  EXCHANGE_RATE_API_URL: process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),

  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads/',
  RUN_SCHEDULER: process.env.RUN_SCHEDULER === 'true',

  // Admin & App Owner
  OWNER_EMAIL: (process.env.OWNER_EMAIL || 'msms5476@gmail.com').trim().toLowerCase(),
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || process.env.OWNER_EMAIL || 'msms5476@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  // PII Encryption & Searchable Blind Index Secrets
  PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY || 'e7b1c4d92a08f53198e6c72b4f910a35d28b61c9e4720fa8513db2e96417ca03',
  PII_BLIND_INDEX_SECRET: process.env.PII_BLIND_INDEX_SECRET || 'f8a3c5d710b9e82649a21b7c03d4e658a912f3b4c5d6e7f8a9b0c1d2e3f4a5b6',

  // Email
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || '',
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  WEB_URL: process.env.WEB_URL || '',
} as const;

// Validate critical configuration
export const validateConfig = (): void => {
  const requiredVars: Array<keyof typeof config> = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI'];
  const placeholders = new Set([
    'your_jwt_secret_here',
    'your_jwt_refresh_secret_here',
    'default-secret-change-in-production',
    'tripsplit-jwt-refresh-secret-dev-only',
    'changeme',
  ]);
  const missing = requiredVars.filter((varName) => {
    const value = config[varName];
    return typeof value !== 'string' || !value.trim() || placeholders.has(value.trim().toLowerCase());
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
