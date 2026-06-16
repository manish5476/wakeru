"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
exports.config = {
    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    API_VERSION: process.env.API_VERSION || 'v1',
    // MongoDB
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://dummymailme_db_user:manishsingh@finance.ykj5rds.mongodb.net',
    MONGO_ROOT_USER: process.env.MONGO_ROOT_USER,
    MONGO_ROOT_PASSWORD: process.env.MONGO_ROOT_PASSWORD,
    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
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
};
// Validate critical configuration
const validateConfig = () => {
    const requiredVars = [
        'JWT_SECRET',
        'MONGODB_URI',
    ];
    const missing = requiredVars.filter(varName => {
        return !process.env[varName] && exports.config[varName] === `default-${varName.toLowerCase()}-change-in-production`;
    });
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
exports.validateConfig = validateConfig;
//# sourceMappingURL=index.js.map