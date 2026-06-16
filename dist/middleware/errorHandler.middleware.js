"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const AppError_1 = require("../shared/errors/AppError");
const logger_1 = require("../config/logger");
const config_1 = require("../config");
const errorHandler = (err, req, res, next) => {
    // Log error
    logger_1.logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        user: req.user?.userId
    });
    // Handle AppError instances
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
        });
        return;
    }
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            error: err.message,
            stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
        });
        return;
    }
    // Handle Mongoose duplicate key errors
    if (err.code === 11000) {
        res.status(409).json({
            success: false,
            error: 'Duplicate entry found: ' + JSON.stringify(err.keyValue),
            stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
        });
        return;
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            error: 'Invalid authentication token',
            stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
        });
        return;
    }
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            error: 'Authentication token has expired',
            stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
        });
        return;
    }
    // Handle multer errors
    if (err.name === 'MulterError') {
        res.status(400).json({
            success: false,
            error: err.message,
            stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
        });
        return;
    }
    // Default error
    const statusCode = err.statusCode || 500;
    const message = config_1.config.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : err.message;
    res.status(statusCode).json({
        success: false,
        error: message,
        stack: config_1.config.NODE_ENV === 'development' ? err.stack : undefined
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.middleware.js.map