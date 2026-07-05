import { Router } from 'express';
import { remindersController } from './reminders.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
    createReminderSchema,
    createSettlementReminderSchema,
    createBudgetReminderSchema,
    pingUserSchema,
    reminderParamSchema,
    reminderQuerySchema,
} from './reminders.validation';

const router = Router();
router.use(protect);

// Create reminders
router.post('/', validate(createReminderSchema), remindersController.create);
router.post('/settlement', validate(createSettlementReminderSchema), remindersController.createSettlementReminder);
router.post('/budget', validate(createBudgetReminderSchema), remindersController.createBudgetReminder);
router.post('/ping', validate(pingUserSchema), remindersController.pingUser);

// Get reminders
router.get('/', validate(reminderQuerySchema, 'query'), remindersController.getMyReminders);
router.get('/incoming', remindersController.getIncomingReminders);
router.get('/trip/:tripId', remindersController.getTripReminders);

// Manage reminders
router.patch('/:reminderId/pause', validate(reminderParamSchema, 'params'), remindersController.pause);
router.patch('/:reminderId/resume', validate(reminderParamSchema, 'params'), remindersController.resume);
router.delete('/:reminderId', validate(reminderParamSchema, 'params'), remindersController.cancel);

export default router;