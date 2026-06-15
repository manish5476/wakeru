import Bull from 'bull';
import { config } from '../../config';
import { logger } from '../../config/logger';

export class QueueManager {
  private static queues: Map<string, Bull.Queue> = new Map();

  static getQueue(queueName: string): Bull.Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Bull(queueName, {
        redis: {
          host: new URL(config.REDIS_URL).hostname,
          port: parseInt(new URL(config.REDIS_URL).port || '6379'),
          password: config.REDIS_PASSWORD
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
        logger.error(`Queue ${queueName} error:`, error);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed in queue ${queueName}:`, error);
      });

      queue.on('completed', (job) => {
        logger.info(`Job ${job.id} completed in queue ${queueName}`);
      });

      this.queues.set(queueName, queue);
    }

    return this.queues.get(queueName)!;
  }

  static async closeAll(): Promise<void> {
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }
  }
}