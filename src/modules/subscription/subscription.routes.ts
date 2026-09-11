import { Router } from 'express';
import { SubscriptionController } from './subscription.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/plans', SubscriptionController.getPublicPlans);
router.post('/webhook', SubscriptionController.handleWebhook);

// Protected routes
router.get('/entitlements', protect, SubscriptionController.getUserEntitlements);
router.post('/checkout', protect, SubscriptionController.createCheckout);
router.post('/simulate-purchase', protect, SubscriptionController.simulatePurchase);
router.post('/cancel', protect, SubscriptionController.cancelSubscription);

export default router;
