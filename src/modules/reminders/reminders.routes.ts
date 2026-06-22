import { Router } from 'express';
import { remindersController } from './reminders.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware';
import { createReminderSchema, reminderParamSchema } from './reminders.validation';

const router = Router();
router.use(protect);

// Create reminder
router.post('/', validate(createReminderSchema), remindersController.create);

// Ping User
router.post('/ping', remindersController.pingUser);

// Get my reminders
router.get('/', remindersController.getMyReminders);

// Pause reminder
router.patch('/:reminderId/pause', validate(reminderParamSchema, 'params'), remindersController.pause);

// Resume reminder
router.patch('/:reminderId/resume', validate(reminderParamSchema, 'params'), remindersController.resume);

// Cancel/delete reminder
router.delete('/:reminderId', validate(reminderParamSchema, 'params'), remindersController.cancel);

export default router;