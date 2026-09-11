import { Request, Response, NextFunction } from 'express';
import { Plan } from './plan.model';
import { Subscription } from './subscription.model';
import { SubscriptionAuditLog } from './audit-log.model';
import { EntitlementService } from './entitlement.service';
import { AuthenticatedRequest } from '../../shared/types/common.types';
import { AppError } from '../../shared/errors/AppError';

export class AdminPlanController {
  /**
   * GET /api/v1/admin/plans
   * List all plans (including draft/archived) with subscriber statistics.
   */
  static async listPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await Plan.find().sort({ displayOrder: 1, createdAt: -1 }).lean();

      // Aggregate active subscribers count for each plan
      const subscriberCounts = await Subscription.aggregate([
        { $match: { status: { $in: ['active', 'trialing'] } } },
        { $group: { _id: '$planKey', count: { $sum: 1 } } },
      ]);

      const subMap = new Map<string, number>();
      for (const item of subscriberCounts) {
        subMap.set(item._id, item.count);
      }

      const formatted = plans.map((p: any) => ({
        ...p,
        id: p._id,
        activeSubscribers: subMap.get(p.key) || 0,
        features: p.features instanceof Map ? Object.fromEntries(p.features) : p.features || {},
        limits: p.limits instanceof Map ? Object.fromEntries(p.limits) : p.limits || {},
      }));

      res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/plans/:id
   * Get single plan detail.
   */
  static async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await Plan.findById(req.params.id).lean();
      if (!plan) {
        throw new AppError('Plan not found', 404);
      }

      const activeSubscribers = await Subscription.countDocuments({
        planKey: plan.key,
        status: { $in: ['active', 'trialing'] },
      });

      res.status(200).json({
        success: true,
        data: {
          ...plan,
          id: plan._id,
          activeSubscribers,
          features:
            plan.features instanceof Map
              ? Object.fromEntries(plan.features)
              : plan.features || {},
          limits:
            plan.limits instanceof Map
              ? Object.fromEntries(plan.limits)
              : plan.limits || {},
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/plans
   * Create a new subscription plan with arbitrary limits and features.
   */
  static async createPlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const actorUserId = req.user?.firebaseUid || req.user?.userId || 'admin';
      const {
        key,
        name,
        description,
        status,
        pricing,
        features,
        limits,
        permissions,
        displayOrder,
        isDefault,
        isPublic,
      } = req.body;

      if (!key || !name || !pricing) {
        throw new AppError('key, name, and pricing are required fields', 400);
      }

      const sanitizedKey = key.trim().toLowerCase();
      const existing = await Plan.findOne({ key: sanitizedKey });
      if (existing) {
        throw new AppError(`Plan key "${sanitizedKey}" already exists`, 409);
      }

      // If marked as default, unset other default plans
      if (isDefault) {
        await Plan.updateMany({}, { $set: { isDefault: false } });
      }

      const newPlan = await Plan.create({
        key: sanitizedKey,
        name,
        description: description || '',
        status: status || 'active',
        pricing: {
          amount: pricing.amount ?? 0,
          currency: (pricing.currency || 'INR').toUpperCase(),
          billingInterval: pricing.billingInterval || 'month',
        },
        features: features || {},
        limits: limits || {},
        permissions: permissions || [],
        displayOrder: displayOrder ?? 10,
        isDefault: !!isDefault,
        isPublic: isPublic !== undefined ? isPublic : true,
      });

      // Audit Log
      await SubscriptionAuditLog.create({
        actorUserId,
        targetType: 'plan',
        targetId: newPlan._id.toString(),
        action: 'create_plan',
        afterState: newPlan.toJSON(),
        reason: req.body.auditReason || 'New plan created by admin',
      });

      await EntitlementService.invalidateAllPlanCaches();

      res.status(201).json({
        success: true,
        message: 'Plan created successfully',
        data: newPlan,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/plans/:id
   * Update plan pricing, limits, features, or status.
   */
  static async updatePlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const actorUserId = req.user?.firebaseUid || req.user?.userId || 'admin';
      const plan = await Plan.findById(req.params.id);
      if (!plan) {
        throw new AppError('Plan not found', 404);
      }

      const beforeState = plan.toJSON();
      const updates = req.body;

      // Cannot change plan key if active subscribers exist
      if (updates.key && updates.key.trim().toLowerCase() !== plan.key) {
        const subCount = await Subscription.countDocuments({ planKey: plan.key });
        if (subCount > 0) {
          throw new AppError(
            'Cannot modify key of a plan with active or past subscriptions',
            400
          );
        }
        plan.key = updates.key.trim().toLowerCase();
      }

      if (updates.name !== undefined) plan.name = updates.name;
      if (updates.description !== undefined) plan.description = updates.description;
      if (updates.status !== undefined) plan.status = updates.status;
      if (updates.displayOrder !== undefined) plan.displayOrder = updates.displayOrder;
      if (updates.isPublic !== undefined) plan.isPublic = updates.isPublic;

      if (updates.isDefault) {
        await Plan.updateMany({ _id: { $ne: plan._id } }, { $set: { isDefault: false } });
        plan.isDefault = true;
      }

      if (updates.pricing) {
        plan.pricing = {
          amount: updates.pricing.amount ?? plan.pricing.amount,
          currency: (updates.pricing.currency || plan.pricing.currency).toUpperCase(),
          billingInterval: updates.pricing.billingInterval || plan.pricing.billingInterval,
        };
      }

      if (updates.features) {
        plan.features = updates.features;
        plan.markModified('features');
      }

      if (updates.limits) {
        plan.limits = updates.limits;
        plan.markModified('limits');
      }

      if (updates.permissions) {
        plan.permissions = updates.permissions;
      }

      await plan.save();

      // Audit Log
      await SubscriptionAuditLog.create({
        actorUserId,
        targetType: 'plan',
        targetId: plan._id.toString(),
        action: 'update_plan',
        beforeState,
        afterState: plan.toJSON(),
        reason: updates.auditReason || 'Plan updated by admin',
      });

      // Clear all cached entitlements so updated limits take effect immediately
      await EntitlementService.invalidateAllPlanCaches();

      res.status(200).json({
        success: true,
        message: 'Plan updated successfully',
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/plans/:id/archive
   * Archive a plan (no longer available for new subscriptions).
   */
  static async archivePlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const actorUserId = req.user?.firebaseUid || req.user?.userId || 'admin';
      const plan = await Plan.findById(req.params.id);
      if (!plan) {
        throw new AppError('Plan not found', 404);
      }

      if (plan.isDefault) {
        throw new AppError('Cannot archive the default plan', 400);
      }

      const beforeState = plan.toJSON();
      plan.status = 'archived';
      plan.isPublic = false;
      await plan.save();

      await SubscriptionAuditLog.create({
        actorUserId,
        targetType: 'plan',
        targetId: plan._id.toString(),
        action: 'archive_plan',
        beforeState,
        afterState: plan.toJSON(),
        reason: req.body.reason || 'Plan archived by admin',
      });

      await EntitlementService.invalidateAllPlanCaches();

      res.status(200).json({
        success: true,
        message: `Plan "${plan.name}" has been archived.`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/audit-logs
   * List recent subscription & plan audit events.
   */
  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
      const logs = await SubscriptionAuditLog.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  }
}
