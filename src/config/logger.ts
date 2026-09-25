import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from './index';

const logDir = path.join(__dirname, '../../logs');

function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 6 || !data) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('apikey')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (
      lowerKey.includes('phone') ||
      lowerKey.includes('mobile')
    ) {
      if (typeof value === 'string') {
        sanitized[key] = value.length > 5 ? `${value.slice(0, 3)}****${value.slice(-3)}` : '[REDACTED_PHONE]';
      } else {
        sanitized[key] = '[REDACTED_PHONE]';
      }
    } else if (
      lowerKey.includes('accountnumber') ||
      lowerKey.includes('cardnumber') ||
      lowerKey.includes('cvv')
    ) {
      sanitized[key] = '[REDACTED_FINANCIAL]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const redactSensitiveData = winston.format((info) => {
  if (info.metadata) {
    info.metadata = sanitizeLogData(info.metadata);
  }
  if (typeof info.message === 'string') {
    info.message = info.message.replace(/Bearer\s+([A-Za-z0-9\-_.]+)/gi, 'Bearer [REDACTED]');
  }
  return info;
});

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  redactSensitiveData(),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (metadata && Object.keys(metadata).length > 0) {
      log += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    
    return log;
  })
);

const transports: winston.transport[] = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

// File transports for production
if (config.NODE_ENV === 'production') {
  transports.push(
    // Daily rotate file for all logs
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: customFormat,
    }),
    // Separate file for errors
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '60d',
      format: customFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};