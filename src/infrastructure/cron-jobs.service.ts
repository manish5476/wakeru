import cron from 'node-cron';
import { smartNotificationService } from '../modules/notification/smart-notifications.service';
import { logger } from '../config/logger';
import { exchangeRateService } from '@/modules/trips/exchange-rate.service';

export const cronJobs = {
    /**
     * Initialize all cron jobs.
     */
    start(): void {
        logger.info('⏰ Starting cron jobs...');

        // Smart notifications — every hour
        cron.schedule('0 * * * *', async () => {
            logger.info('Running smart notification checks...');
            try {
                await smartNotificationService.runScheduledChecks();
            } catch (error) {
                logger.error('Smart notification check failed:', error);
            }
        });

        // Exchange rate alerts — every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            logger.info('Running exchange rate alert checks...');
            try {
                await exchangeRateService.checkAlerts();
            } catch (error) {
                logger.error('Exchange rate alert check failed:', error);
            }
        });

        // Auto-complete trips (past end date) — daily at midnight
        cron.schedule('0 0 * * *', async () => {
            logger.info('Auto-completing past trips...');
            try {
                const { Trip } = await import('../modules/trips/trip.model');
                await Trip.updateMany(
                    {
                        status: { $in: ['active', 'planning'] },
                        endDate: { $lt: new Date() },
                    },
                    { $set: { status: 'completed' } }
                );
            } catch (error) {
                logger.error('Auto-complete trips failed:', error);
            }
        });

        // Clean up expired friend requests — daily
        cron.schedule('0 1 * * *', async () => {
            logger.info('Cleaning up expired friend requests...');
            try {
                const { FriendRequest } = await import('../modules/friends/friends.model');
                await FriendRequest.updateMany(
                    {
                        status: 'pending',
                        expiresAt: { $lt: new Date() },
                    },
                    { $set: { status: 'expired', respondedAt: new Date() } }
                );
            } catch (error) {
                logger.error('Cleanup expired requests failed:', error);
            }
        });

        logger.info('✅ All cron jobs started');
    },
};