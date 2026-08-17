import cron from 'node-cron';
import { reminderService } from './reminder.service';
import { logger } from '../../config/logger';
import { ScheduledTask } from 'node-cron';

let reminderTask: ScheduledTask | null = null;

// Run every minute to check for due reminders
export function startReminderCron(): void {
    if (reminderTask) return;
    reminderTask = cron.schedule('* * * * *', async () => {
        try {
            await reminderService.processDueReminders();
        } catch (error) {
            logger.error('Reminder cron error:', error);
        }
    });

    logger.info('⏰ Reminder cron job started (every minute)');
}

export function stopReminderCron(): void {
    reminderTask?.stop();
    reminderTask = null;
}
