import { Plan } from '../../src/modules/subscription/plan.model';
import { Subscription } from '../../src/modules/subscription/subscription.model';
import { UsageCounter } from '../../src/modules/subscription/usage-counter.model';
import { EntitlementService } from '../../src/modules/subscription/entitlement.service';
import { PaymentManager } from '../../src/modules/subscription/payment.provider';
import { Trip } from '../../src/modules/trips/trip.model';
import { AppError } from '../../src/shared/errors/AppError';

// Mock Redis
jest.mock('../../src/config/redis', () => ({
  redisClient: {
    ready: false,
    isConnected: false,
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    deletePattern: jest.fn().mockResolvedValue(undefined),
    setIfNotExists: jest.fn().mockResolvedValue(true),
  },
}));

describe('Subscription & Entitlement System', () => {
  const testUserId = 'test_user_firebase_uid_101';

  beforeEach(() => {
    jest.restoreAllMocks();
    // Default mocks for Mongoose queries so tests run instantly offline without MongoDB connection
    jest.spyOn(Trip, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(UsageCounter, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    } as any);
  });

  describe('1. Default Plan Resolution & Seeding', () => {
    it('resolves Free plan by default when user has no active subscription', async () => {
      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      jest.spyOn(Plan, 'findOne').mockResolvedValue({
        _id: 'plan_free_id',
        key: 'free',
        name: 'Free Traveler',
        description: 'Free tier',
        status: 'active',
        isDefault: true,
        pricing: { amount: 0, currency: 'INR', billingInterval: 'free' },
        limits: {
          trips: { value: 5, unlimited: false },
          peoplePerTrip: { value: 10, unlimited: false },
          stopsPerTrip: { value: 5, unlimited: false },
        },
        features: {
          trip_creation: true,
          advanced_analytics: false,
        },
      } as any);

      jest.spyOn(Trip, 'countDocuments').mockResolvedValue(2 as never);

      const entitlements = await EntitlementService.getUserEntitlements(testUserId, true);

      expect(entitlements.plan.key).toBe('free');
      expect(entitlements.isPaid).toBe(false);
      expect(entitlements.limits.trips.value).toBe(5);
      expect(entitlements.usage.trips).toBe(2);
      expect(entitlements.remaining.trips).toBe(3);
      expect(entitlements.features.advanced_analytics).toBe(false);
    });
  });

  describe('2. Authoritative Limit Enforcement', () => {
    it('allows operation when within limit', async () => {
      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      jest.spyOn(Plan, 'findOne').mockResolvedValue({
        _id: 'plan_free_id',
        key: 'free',
        name: 'Free Traveler',
        status: 'active',
        isDefault: true,
        pricing: { amount: 0, currency: 'INR', billingInterval: 'free' },
        limits: { trips: { value: 5, unlimited: false } },
        features: { trip_creation: true },
      } as any);

      jest.spyOn(Trip, 'countDocuments').mockResolvedValue(4 as never);

      await expect(
        EntitlementService.assertWithinLimit(testUserId, 'trips', 1)
      ).resolves.not.toThrow();
    });

    it('rejects operation with PLAN_LIMIT_REACHED (403) when quota is exceeded', async () => {
      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      jest.spyOn(Plan, 'findOne').mockResolvedValue({
        _id: 'plan_free_id',
        key: 'free',
        name: 'Free Traveler',
        status: 'active',
        isDefault: true,
        pricing: { amount: 0, currency: 'INR', billingInterval: 'free' },
        limits: { trips: { value: 5, unlimited: false } },
        features: { trip_creation: true },
      } as any);

      jest.spyOn(Trip, 'countDocuments').mockResolvedValue(5 as never);

      let thrownError: any = null;
      try {
        await EntitlementService.assertWithinLimit(testUserId, 'trips', 1);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.statusCode).toBe(403);
      expect(thrownError.code).toBe('PLAN_LIMIT_REACHED');
      expect(thrownError.details.limitKey).toBe('trips');
      expect(thrownError.details.limit).toBe(5);
      expect(thrownError.details.currentUsage).toBe(5);
    });

    it('allows unlimited limits unconditionally', async () => {
      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: 'sub_super_id',
            userId: testUserId,
            planKey: 'super_pro',
            status: 'active',
            entitlementPolicy: 'dynamic_latest',
            currentPeriodEnd: new Date(Date.now() + 86400000),
            planId: {
              _id: 'plan_super_id',
              key: 'super_pro',
              name: 'Super Pro Nomad',
              status: 'active',
              limits: { trips: { value: null, unlimited: true } },
              features: { trip_creation: true },
            },
          }),
        }),
      } as any);

      jest.spyOn(Trip, 'countDocuments').mockResolvedValue(850 as never);

      await expect(
        EntitlementService.assertWithinLimit(testUserId, 'trips', 1)
      ).resolves.not.toThrow();
    });
  });

  describe('3. Dynamic Limit & Feature Updates', () => {
    it('dynamically upgrades limits when admin increases plan allowance', async () => {
      const populatedProPlan = {
        _id: 'plan_pro_id',
        key: 'pro',
        name: 'Pro Explorer',
        status: 'active',
        limits: {
          trips: { value: 100, unlimited: false }, // Admin changed from 50 to 100!
          peoplePerTrip: { value: 50, unlimited: false },
        },
        features: {
          advanced_analytics: true,
        },
      };

      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: 'sub_123',
            userId: testUserId,
            planKey: 'pro',
            status: 'active',
            entitlementPolicy: 'dynamic_latest',
            currentPeriodEnd: new Date(Date.now() + 86400000),
            planId: populatedProPlan,
          }),
        }),
      } as any);

      jest.spyOn(Trip, 'countDocuments').mockResolvedValue(55 as never);

      const entitlements = await EntitlementService.getUserEntitlements(testUserId, true);

      expect(entitlements.plan.key).toBe('pro');
      expect(entitlements.limits.trips.value).toBe(100);
      expect(entitlements.usage.trips).toBe(55);
      expect(entitlements.remaining.trips).toBe(45);
      expect(entitlements.features.advanced_analytics).toBe(true);
    });

    it('rejects access to features not included in current plan', async () => {
      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      } as any);

      jest.spyOn(Plan, 'findOne').mockResolvedValue({
        _id: 'plan_free_id',
        key: 'free',
        name: 'Free Traveler',
        status: 'active',
        isDefault: true,
        pricing: { amount: 0, currency: 'INR', billingInterval: 'free' },
        limits: {},
        features: { advanced_analytics: false },
      } as any);

      let thrownError: any = null;
      try {
        await EntitlementService.assertCanUseFeature(testUserId, 'advanced_analytics');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.statusCode).toBe(403);
      expect(thrownError.code).toBe('FEATURE_NOT_PERMITTED');
      expect(thrownError.details.featureKey).toBe('advanced_analytics');
    });
  });

  describe('4. Webhook Idempotency & Lifecycle Handling', () => {
    it('processes checkout completed webhook and creates subscription', async () => {
      jest.spyOn(Plan, 'findOne').mockResolvedValue({
        _id: 'plan_pro_id',
        key: 'pro',
        name: 'Pro Explorer',
        pricing: { amount: 399, currency: 'INR', billingInterval: 'month' },
        features: { advanced_analytics: true },
        limits: { trips: { value: 50, unlimited: false } },
      } as any);

      jest.spyOn(Subscription, 'updateMany').mockResolvedValue({} as any);
      const createSpy = jest.spyOn(Subscription, 'create').mockResolvedValue({} as any);

      const webhookEvent = {
        id: 'evt_unique_101',
        type: 'checkout.session.completed' as const,
        provider: 'mock' as const,
        data: {
          userId: testUserId,
          planKey: 'pro',
          providerCustomerId: 'cust_123',
          providerSubscriptionId: 'sub_123',
        },
      };

      const result = await PaymentManager.handleWebhookEvent(webhookEvent);

      expect(result.processed).toBe(true);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          planKey: 'pro',
          status: 'active',
          provider: 'mock',
        })
      );
    });

    it('preserves existing data safely when subscription expires', async () => {
      jest.spyOn(Subscription, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null), // Expired, no active subscription
        }),
      } as any);

      jest.spyOn(Plan, 'findOne').mockResolvedValue({
        _id: 'plan_free_id',
        key: 'free',
        name: 'Free Traveler',
        pricing: { amount: 0, currency: 'INR', billingInterval: 'free' },
        limits: { trips: { value: 5, unlimited: false } },
        features: { trip_creation: true },
      } as any);

      jest.spyOn(Trip, 'countDocuments').mockResolvedValue(60 as never);

      const entitlements = await EntitlementService.getUserEntitlements(testUserId, true);

      // Existing 60 trips are preserved in usage!
      expect(entitlements.usage.trips).toBe(60);
      expect(entitlements.remaining.trips).toBe(0);

      // Attempting to create a 61st trip is rejected, but existing 60 trips remain intact
      await expect(
        EntitlementService.assertWithinLimit(testUserId, 'trips', 1)
      ).rejects.toThrow('Plan limit reached');
    });
  });
});
