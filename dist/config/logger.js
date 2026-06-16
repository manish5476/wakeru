"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.morganStream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const index_1 = require("./index");
const logDir = path_1.default.join(__dirname, '../../logs');
// Custom format for better readability
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }), winston_1.default.format.printf(({ timestamp, level, message, metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
        log += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    return log;
}));
const transports = [
    // Console transport for development
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }),
];
// File transports for production
if (index_1.config.NODE_ENV === 'production') {
    transports.push(
    // Daily rotate file for all logs
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: customFormat,
    }), 
    // Separate file for errors
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '60d',
        format: customFormat,
    }));
}
exports.logger = winston_1.default.createLogger({
    level: index_1.config.LOG_LEVEL || 'info',
    format: customFormat,
    transports,
    exitOnError: false,
});
// Stream for Morgan HTTP logging
exports.morganStream = {
    write: (message) => {
        exports.logger.info(message.trim());
    },
};
//# sourceMappingURL=logger.js.map