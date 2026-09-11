import { Plan, IPlan } from './plan.model';
import { Subscription, ISubscription, SubscriptionProvider } from './subscription.model';
import { EntitlementService } from './entitlement.service';
import { AppError } from '../../shared/errors/AppError';
import { redisClient } from '../../config/redis';
import { logger } from '../../config/logger';
import crypto from 'crypto';

export interface CheckoutSessionInput {
  userId: string;
  userEmail: string;
  planKey: string;
  billingInterval?: 'month' | 'year';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  planKey: string;
  amount: number;
  currency: string;
}

export interface WebhookEvent {
  id: string;
  type:
    | 'checkout.session.completed'
    | 'invoice.payment_succeeded'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted'
    | 'payment.failed';
  provider: SubscriptionProvider;
  data: {
    userId?: string;
    planKey?: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    providerPaymentId?: string;
    status?: string;
    currentPeriodEnd?: Date;
    raw?: any;
  };
}

export interface IPaymentProvider {
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyAndParseWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
}

/**
 * Mock & Sandbox Payment Provider.
 * Allows full end-to-end purchasing, renewal, upgrade, and webhook testing
 * without requiring external Stripe/Razorpay API keys.
 */
export class MockPaymentProvider implements IPaymentProvider {
  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const plan = await Plan.findOne({ key: input.planKey, status: 'active' });
    if (!plan) {
      throw new AppError(`Plan "${input.planKey}" not found or inactive`, 404);
    }

    const sessionId = `mock_sess_${crypto.randomUUID().replace(/-/g, '')}`;

    return {
      sessionId,
      checkoutUrl: `/checkout-complete?session_id=${sessionId}`,
      planKey: plan.key,
      amount: plan.pricing.amount,
      currency: plan.pricing.currency,
    };
  }

  async verifyAndParseWebhook(payload: any, _signature?: string): Promise<WebhookEvent> {
    return {
      id: payload.id || `evt_${crypto.randomUUID()}`,
      type: payload.type || 'checkout.session.completed',
      provider: 'mock',
      data: payload.data || payload,
    };
  }
}

export class PaymentManager {
  private static provider: IPaymentProvider = new MockPaymentProvider();

  static setProvider(provider: IPaymentProvider): void {
    this.provider = provider;
  }

  static getProvider(): IPaymentProvider {
    return this.provider;
  }

  /**
   * Process a verified webhook event idempotently.
   * Ensures duplicate deliveries do not duplicate records or subscriptions.
   */
  static async handleWebhookEvent(event: WebhookEvent): Promise<{ processed: boolean; reason?: string }> {
    const lockKey = `webhook:lock:${event.id}`;

    // Redis idempotency check
    if (redisClient.ready) {
      const acquired = await redisClient.setIfNotExists(lockKey, 'processed', 86400); // 24h
      if (!acquired) {
        logger.info(`Webhook event ${event.id} already processed or in progress. Skipping.`);
        return { processed: false, reason: 'Duplicate event (idempotency key matched)' };
      }
    }

    logger.info(`Processing subscription webhook: ${event.type} for provider ${event.provider}`);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'invoice.payment_succeeded': {
        const { userId, planKey, providerCustomerId, providerSubscriptionId, providerPaymentId } =
          event.data;

        if (!userId || !planKey) {
          throw new AppError('Webhook missing required userId or planKey', 400);
        }

        const plan = await Plan.findOne({ key: planKey, status: 'active' });
        if (!plan) {
          throw new AppError(`Plan "${planKey}" not found during webhook processing`, 404);
        }

        const features =
          plan.features instanceof Map
            ? Object.fromEntries(plan.features)
            : (plan.features as Record<string, boolean>) || {};
        const limits =
          plan.limits instanceof Map
            ? Object.fromEntries(plan.limits)
            : (plan.limits as Record<string, any>) || {};

        const now = new Date();
        const intervalDays = plan.pricing.billingInterval === 'year' ? 365 : 30;
        const currentPeriodEnd =
          event.data.currentPeriodEnd || new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

        // Cancel previous active subscriptions for this user
        await Subscription.updateMany(
          { userId, status: { $in: ['active', 'trialing'] } },
          { $set: { status: 'canceled', canceledAt: now } }
        );

        // Create new active subscription
        await Subscription.create({
          userId,
          planId: plan._id,
          planKey: plan.key,
          status: 'active',
          planSnapshot: {
            key: plan.key,
            name: plan.name,
            pricing: {
              amount: plan.pricing.amount,
              currency: plan.pricing.currency,
              billingInterval: plan.pricing.billingInterval,
            },
            limits,
            features,
          },
          provider: event.provider,
          providerCustomerId: providerCustomerId || null,
          providerSubscriptionId: providerSubscriptionId || `sub_${crypto.randomUUID().slice(0, 12)}`,
          providerPaymentId: providerPaymentId || null,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          autoRenew: true,
          entitlementPolicy: 'dynamic_latest',
        });

        // Invalidate user's entitlement cache
        await EntitlementService.invalidateUserEntitlements(userId);
        logger.info(`Successfully activated subscription for user ${userId} on plan ${planKey}`);
        return { processed: true };
      }

      case 'customer.subscription.deleted': {
        const { providerSubscriptionId, userId } = event.data;
        const query: any = {};
        if (providerSubscriptionId) query.providerSubscriptionId = providerSubscriptionId;
        if (userId) query.userId = userId;

        if (Object.keys(query).length > 0) {
          const sub = await Subscription.findOneAndUpdate(
            query,
            { $set: { status: 'expired', autoRenew: false } },
            { new: true }
          );

          if (sub) {
            await EntitlementService.invalidateUserEntitlements(sub.userId);
            logger.info(`Expired subscription for user ${sub.userId}`);
          }
        }
        return { processed: true };
      }

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
        return { processed: true, reason: 'Ignored event type' };
    }
  }
}
