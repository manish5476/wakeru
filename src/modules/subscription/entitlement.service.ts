import { Plan, IPlan, ILimitConfig, seedDefaultPlans } from './plan.model';
import { Subscription, ISubscription } from './subscription.model';
import { UsageCounter, getCurrentPeriodKey } from './usage-counter.model';
import { Trip } from '../trips/trip.model';
import { AppError } from '../../shared/errors/AppError';
import { redisClient } from '../../config/redis';
import { logger } from '../../config/logger';

export interface IUserEntitlements {
  plan: {
    id: string;
    key: string;
    name: string;
    description: string;
    billingInterval: string;
    isDefault: boolean;
  };
  features: Record<string, boolean>;
  limits: Record<string, ILimitConfig>;
  usage: Record<string, number>;
  remaining: Record<string, number | null>;
  isPaid: boolean;
  subscription: {
    id?: string;
    status: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd: boolean;
    autoRenew: boolean;
    provider?: string;
  };
}

const ENTITLEMENT_CACHE_TTL_SEC = 60; // 60 seconds fast cache

export class EntitlementService {
  /**
   * Resolve effective entitlements for a user.
   * Checks for an active subscription, otherwise falls back to default Free plan.
   * Calculates real-time usage for authoritative assets and periodic usage counters.
   */
  static async getUserEntitlements(userId: string, skipCache = false): Promise<IUserEntitlements> {
    const cacheKey = `entitlements:${userId}`;

    if (!skipCache && redisClient.ready) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        logger.warn('Redis entitlement cache read failed, falling back to DB', err);
      }
    }

    // 1. Check for active subscription
    const now = new Date();
    const activeSubscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'trialing'] },
      currentPeriodEnd: { $gte: now },
    })
      .sort({ createdAt: -1 })
      .populate('planId');

    let planData: {
      id: string;
      key: string;
      name: string;
      description: string;
      billingInterval: string;
      isDefault: boolean;
      features: Record<string, boolean>;
      limits: Record<string, ILimitConfig>;
    };

    let isPaid = false;
    let subscriptionMeta: IUserEntitlements['subscription'] = {
      status: 'none',
      cancelAtPeriodEnd: false,
      autoRenew: false,
    };

    if (activeSubscription) {
      isPaid = true;
      subscriptionMeta = {
        id: activeSubscription._id.toString(),
        status: activeSubscription.status,
        currentPeriodStart: activeSubscription.currentPeriodStart,
        currentPeriodEnd: activeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
        autoRenew: activeSubscription.autoRenew,
        provider: activeSubscription.provider,
      };

      // Determine whether to use latest dynamic plan or historical snapshot
      const populatedPlan = activeSubscription.planId as unknown as IPlan;
      if (
        activeSubscription.entitlementPolicy === 'dynamic_latest' &&
        populatedPlan &&
        populatedPlan.status === 'active'
      ) {
        // Plan object may have Mongoose Map or object
        const features =
          populatedPlan.features instanceof Map
            ? Object.fromEntries(populatedPlan.features)
            : (populatedPlan.features as Record<string, boolean>) || {};
        const limits =
          populatedPlan.limits instanceof Map
            ? Object.fromEntries(populatedPlan.limits)
            : (populatedPlan.limits as Record<string, ILimitConfig>) || {};

        planData = {
          id: populatedPlan._id.toString(),
          key: populatedPlan.key,
          name: populatedPlan.name,
          description: populatedPlan.description,
          billingInterval: populatedPlan.pricing?.billingInterval || 'month',
          isDefault: populatedPlan.isDefault || false,
          features,
          limits,
        };
      } else {
        // Use historical snapshot
        const snapshot = activeSubscription.planSnapshot;
        planData = {
          id: activeSubscription.planId ? activeSubscription.planId.toString() : '',
          key: snapshot.key,
          name: snapshot.name,
          description: '',
          billingInterval: snapshot.pricing?.billingInterval || 'month',
          isDefault: false,
          features: snapshot.features || {},
          limits: snapshot.limits || {},
        };
      }
    } else {
      // 2. Fallback to default Free plan
      let defaultPlan = await Plan.findOne({ isDefault: true, status: 'active' });
      if (!defaultPlan) {
        defaultPlan = await Plan.findOne({ key: 'free', status: 'active' });
      }

      if (!defaultPlan) {
        await seedDefaultPlans();
        defaultPlan = await Plan.findOne({ isDefault: true });
      }

      if (!defaultPlan) {
        throw new AppError('Default subscription plan not configured', 500);
      }

      const features =
        defaultPlan.features instanceof Map
          ? Object.fromEntries(defaultPlan.features)
          : (defaultPlan.features as Record<string, boolean>) || {};
      const limits =
        defaultPlan.limits instanceof Map
          ? Object.fromEntries(defaultPlan.limits)
          : (defaultPlan.limits as Record<string, ILimitConfig>) || {};

      planData = {
        id: defaultPlan._id.toString(),
        key: defaultPlan.key,
        name: defaultPlan.name,
        description: defaultPlan.description,
        billingInterval: defaultPlan.pricing?.billingInterval || 'free',
        isDefault: true,
        features,
        limits,
      };
    }

    // 3. Compute real-time usage for authoritative assets
    const [tripsCount, periodicCounters] = await Promise.all([
      Trip.countDocuments({ createdBy: userId, isArchived: false }),
      UsageCounter.find({ userId, periodKey: getCurrentPeriodKey() }).lean(),
    ]);

    const usage: Record<string, number> = {
      trips: tripsCount,
    };

    for (const counter of periodicCounters) {
      usage[counter.key] = counter.count;
    }

    // 4. Calculate remaining quotas
    const remaining: Record<string, number | null> = {};
    for (const [key, limitConfig] of Object.entries(planData.limits)) {
      if (limitConfig.unlimited || limitConfig.value === null) {
        remaining[key] = null; // null represents uncapped / unlimited
      } else {
        const used = usage[key] || 0;
        remaining[key] = Math.max(0, limitConfig.value - used);
      }
    }

    const result: IUserEntitlements = {
      plan: {
        id: planData.id,
        key: planData.key,
        name: planData.name,
        description: planData.description,
        billingInterval: planData.billingInterval,
        isDefault: planData.isDefault,
      },
      features: planData.features,
      limits: planData.limits,
      usage,
      remaining,
      isPaid,
      subscription: subscriptionMeta,
    };

    // Cache result
    if (redisClient.ready) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(result), ENTITLEMENT_CACHE_TTL_SEC);
      } catch (err) {
        logger.warn('Failed to cache entitlements in Redis', err);
      }
    }

    return result;
  }

  /**
   * Invalidate cached entitlements for a user or all users.
   */
  static async invalidateUserEntitlements(userId: string): Promise<void> {
    if (redisClient.ready) {
      try {
        await redisClient.delete(`entitlements:${userId}`);
      } catch (err) {
        logger.warn('Failed to invalidate user entitlement cache in Redis', err);
      }
    }
  }

  /**
   * Invalidate all cached entitlements (e.g. after an admin updates plan limits/features).
   */
  static async invalidateAllPlanCaches(): Promise<void> {
    if (redisClient.ready) {
      try {
        await redisClient.deletePattern('entitlements:*');
      } catch (err) {
        logger.warn('Failed to clear entitlement keys in Redis', err);
      }
    }
  }

  /**
   * Authoritatively assert that a requested operation is within the user's plan limit.
   * Throws a structured AppError(403, 'PLAN_LIMIT_REACHED') if the limit is exceeded.
   * 
   * @param userId Creator / user whose plan limit applies
   * @param limitKey The limit key being tested ('trips', 'peoplePerTrip', 'stopsPerTrip', etc.)
   * @param requestedAmount Increment amount (defaults to 1)
   * @param currentContextCount Contextual count (e.g. current members on a specific trip)
   */
  static async assertWithinLimit(
    userId: string,
    limitKey: string,
    requestedAmount = 1,
    currentContextCount?: number
  ): Promise<void> {
    const entitlements = await this.getUserEntitlements(userId);
    const limitConfig = entitlements.limits[limitKey];

    // If no limit is configured or it is explicitly unlimited, allow unconditionally
    if (!limitConfig || limitConfig.unlimited || limitConfig.value === null) {
      return;
    }

    const currentUsage =
      currentContextCount !== undefined
        ? currentContextCount
        : entitlements.usage[limitKey] || 0;

    const projectedUsage = currentUsage + requestedAmount;

    if (projectedUsage > limitConfig.value) {
      throw new AppError(
        `Plan limit reached. Your ${entitlements.plan.name} allows up to ${limitConfig.value} ${limitKey}, but you currently have ${currentUsage}.`,
        403,
        'PLAN_LIMIT_REACHED',
        {
          limitKey,
          currentUsage,
          limit: limitConfig.value,
          requested: requestedAmount,
          plan: entitlements.plan.name,
          planKey: entitlements.plan.key,
          upgradeAvailable: entitlements.plan.key !== 'super_pro',
        }
      );
    }
  }

  /**
   * Authoritatively assert that a specific feature is enabled on the user's plan.
   * Throws AppError(403, 'FEATURE_NOT_PERMITTED') if disabled.
   */
  static async assertCanUseFeature(userId: string, featureKey: string): Promise<void> {
    const entitlements = await this.getUserEntitlements(userId);
    const isEnabled = !!entitlements.features[featureKey];

    if (!isEnabled) {
      throw new AppError(
        `The feature "${featureKey}" is not included in your current ${entitlements.plan.name} plan. Upgrade to unlock it.`,
        403,
        'FEATURE_NOT_PERMITTED',
        {
          featureKey,
          plan: entitlements.plan.name,
          planKey: entitlements.plan.key,
          upgradeAvailable: true,
        }
      );
    }
  }

  /**
   * Increment a periodic usage counter (e.g. monthly exports or OCR scans).
   */
  static async incrementPeriodicUsage(
    userId: string,
    key: string,
    amount = 1
  ): Promise<number> {
    const periodKey = getCurrentPeriodKey();
    const doc = await UsageCounter.findOneAndUpdate(
      { userId, key, periodKey },
      { $inc: { count: amount } },
      { upsert: true, new: true }
    );

    // Invalidate user cache so next read is accurate
    await this.invalidateUserEntitlements(userId);

    return doc ? doc.count : 0;
  }
}

export const entitlementService = EntitlementService;
