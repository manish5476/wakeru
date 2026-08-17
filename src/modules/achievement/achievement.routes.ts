import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { loadTrip, requireMember } from '../trips/trip.middleware';
import { achievementController } from './achievement.controller';

const router = Router();
router.use(protect);

// Get user's achievements + stats
router.get('/', achievementController.getMyAchievements);

// Get achievement notifications
router.get('/notifications', achievementController.getNotifications);

// Mark notifications as read
router.post('/notifications/read', achievementController.markNotificationsRead);

// Get trip leaderboard
router.get('/leaderboard/:tripId', loadTrip(), requireMember, achievementController.getTripLeaderboard);

export default router;