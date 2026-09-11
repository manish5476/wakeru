import { Request, Response, NextFunction } from 'express';
import { Plan } from './plan.model';
import { Subscription } from './subscription.model';
import { EntitlementService } from './entitlement.service';
import { PaymentManager } from './payment.provider';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';

export class SubscriptionController {
  /**
   * GET /api/v1/subscription/plans
   * List all public, active subscription plans with limits and features.
   */
  static async getPublicPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await Plan.find({ status: 'active', isPublic: true })
        .sort({ displayOrder: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: plans.map((p: any) => ({
          ...p,
          id: p._id,
          features: p.features instanceof Map ? Object.fromEntries(p.features) : p.features || {},
          limits: p.limits instanceof Map ? Object.fromEntries(p.limits) : p.limits || {},
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/subscription/entitlements
   * Get effective entitlements, feature permissions, limits, and live usage for authenticated user.
   */
  static async getUserEntitlements(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.firebaseUid || req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const entitlements = await EntitlementService.getUserEntitlements(userId);

      res.status(200).json({
        success: true,
        data: entitlements,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscription/checkout
   * Initiate a purchase / checkout session.
   */
  static async createCheckout(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.firebaseUid || req.user?.userId;
      const userEmail = req.user?.email || '';
      const { planKey, billingInterval } = req.body;

      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      if (!planKey) {
        throw new AppError('planKey is required', 400);
      }

      const provider = PaymentManager.getProvider();
      const session = await provider.createCheckoutSession({
        userId,
        userEmail,
        planKey,
        billingInterval,
      });

      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscription/simulate-purchase
   * Sandbox endpoint to instantly simulate a plan upgrade/downgrade for testing.
   */
  static async simulatePurchase(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.firebaseUid || req.user?.userId;
      const { planKey } = req.body;

      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      if (!planKey) {
        throw new AppError('planKey is required', 400);
      }

      const event = {
        id: `sim_${Date.now()}`,
        type: 'checkout.session.completed' as const,
        provider: 'mock' as const,
        data: {
          userId,
          planKey,
          providerCustomerId: `cust_mock_${userId}`,
          providerSubscriptionId: `sub_mock_${Date.now()}`,
        },
      };

      await PaymentManager.handleWebhookEvent(event);
      const updatedEntitlements = await EntitlementService.getUserEntitlements(userId, true);

      res.status(200).json({
        success: true,
        message: `Plan successfully upgraded to ${planKey}`,
        data: updatedEntitlements,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscription/cancel
   * Cancel auto-renew at period end.
   */
  static async cancelSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.firebaseUid || req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const sub = await Subscription.findOneAndUpdate(
        { userId, status: { $in: ['active', 'trialing'] } },
        { $set: { cancelAtPeriodEnd: true, autoRenew: false } },
        { new: true }
      );

      if (!sub) {
        throw new AppError('No active paid subscription found to cancel', 404);
      }

      await EntitlementService.invalidateUserEntitlements(userId);

      res.status(200).json({
        success: true,
        message: 'Your subscription will remain active until the end of the billing period.',
        data: {
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscription/webhook
   * Public webhook endpoint for payment provider callbacks.
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sigHeader = req.headers['stripe-signature'] || req.headers['x-razorpay-signature'];
      const signature = Array.isArray(sigHeader) ? sigHeader[0] : (sigHeader as string | undefined);
      const provider = PaymentManager.getProvider();
      const event = await provider.verifyAndParseWebhook(req.body, signature);

      const result = await PaymentManager.handleWebhookEvent(event);

      res.status(200).json({
        success: true,
        received: true,
        ...result,
      });
    } catch (err) {
      logger.error('Webhook processing error', err);
      next(err);
    }
  }
}
