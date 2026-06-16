"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = void 0;
const bull_1 = __importDefault(require("bull"));
const config_1 = require("../../config");
const logger_1 = require("../../config/logger");
class QueueManager {
    static getQueue(queueName) {
        if (!this.queues.has(queueName)) {
            const queue = new bull_1.default(queueName, {
                redis: {
                    host: new URL(config_1.config.REDIS_URL).hostname,
                    port: parseInt(new URL(config_1.config.REDIS_URL).port || '6379'),
                    password: config_1.config.REDIS_PASSWORD
                },
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    },
                    removeOnComplete: 100,
                    removeOnFail: 50
                }
            });
            queue.on('error', (error) => {
                logger_1.logger.error(`Queue ${queueName} error:`, error);
            });
            queue.on('failed', (job, error) => {
                logger_1.logger.error(`Job ${job.id} failed in queue ${queueName}:`, error);
            });
            queue.on('completed', (job) => {
                logger_1.logger.info(`Job ${job.id} completed in queue ${queueName}`);
            });
            this.queues.set(queueName, queue);
        }
        return this.queues.get(queueName);
    }
    static async closeAll() {
        for (const [name, queue] of this.queues) {
            await queue.close();
            logger_1.logger.info(`Queue ${name} closed`);
        }
    }
}
exports.QueueManager = QueueManager;
QueueManager.queues = new Map();
//# sourceMappingURL=bull.config.js.map