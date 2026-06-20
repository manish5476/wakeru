import cron from 'node-cron';
import { reminderService } from './reminder.service';
import { logger } from '../../config/logger';

// Run every minute to check for due reminders
export function startReminderCron(): void {
    cron.schedule('* * * * *', async () => {
        try {
            await reminderService.processDueReminders();
        } catch (error) {
            logger.error('Reminder cron error:', error);
        }
    });

    logger.info('⏰ Reminder cron job started (every minute)');
}