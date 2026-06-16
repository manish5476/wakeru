import { Router } from 'express';

const router = Router();

// Placeholder route - get all notifications
router.get('/', (req, res) => {
  res.status(200).json({ message: 'Fetched all notifications' });
});

// Placeholder route - mark a notification as read
router.patch('/:id/read', (req, res) => {
  res.status(200).json({ message: `Notification ${req.params.id} marked as read` });
});

export default router;
