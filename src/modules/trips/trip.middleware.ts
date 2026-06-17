import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Trip } from './trip.model';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// ZOD VALIDATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic Zod validation middleware factory.
 * Pass in the schema and which part of req to validate: body, params, or query.
 *
 * Usage:
 *   router.post('/', validate(createTripSchema), tripController.createTrip);
 *   router.get('/:tripId', validate(tripIdParamSchema, 'params'), tripController.getTrip);
 */
export const validate =
  (schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      // Attach parsed (coerced, trimmed, uppercased) data back to request
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
        return;
      }
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// TRIP MEMBERSHIP GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the trip from the DB and attaches it to req.trip.
 * Must come BEFORE any membership/role guards.
 *
 * Returns 404 if trip not found or is archived (unless includeArchived option set).
 */
export const loadTrip = (opts: { includeArchived?: boolean } = {}) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tripId } = req.params;

      if (!tripId) {
        return next(new AppError('Trip ID is required', 400));
      }

      const query: Record<string, unknown> = { _id: tripId };
      if (!opts.includeArchived) {
        query.isArchived = false;
      }

      const trip = await Trip.findOne(query);

      if (!trip) {
        return next(new AppError('Trip not found', 404));
      }

      (req as any).trip = trip;
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * Ensures the authenticated user is an active member of req.trip.
 * Must be used AFTER loadTrip.
 */
export const requireMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = (req as any).trip;
    const userId = (req as any).user?.uid;  // set by Firebase auth middleware

    if (!trip) {
      return next(new AppError('Trip not loaded — use loadTrip() first', 500));
    }

    if (!trip.isMember(userId)) {
      return next(new AppError('You are not a member of this trip', 403));
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Ensures the authenticated user is an admin of req.trip.
 * Must be used AFTER loadTrip.
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = (req as any).trip;
    const userId = (req as any).user?.uid;

    if (!trip) {
      return next(new AppError('Trip not loaded — use loadTrip() first', 500));
    }

    if (!trip.isAdmin(userId)) {
      return next(new AppError('Only trip admins can perform this action', 403));
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Ensures the user can edit the trip (admin or member — not viewer).
 * Use this on all POST/PATCH expense, stop, and rate endpoints.
 * Must be used AFTER loadTrip.
 */
export const requireEditor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = (req as any).trip;
    const userId = (req as any).user?.uid;

    if (!trip) {
      return next(new AppError('Trip not loaded — use loadTrip() first', 500));
    }

    if (!trip.canEdit(userId)) {
      return next(
        new AppError('Viewers cannot make changes to this trip', 403)
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Validates that :stopId in the URL belongs to req.trip.
 * Attaches the stop to req.stop.
 * Must be used AFTER loadTrip.
 */
export const loadStop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = (req as any).trip;
    const { stopId } = req.params;

    if (!trip) {
      return next(new AppError('Trip not loaded — use loadTrip() first', 500));
    }

    if (!stopId) {
      return next(new AppError('Stop ID is required', 400));
    }

    const stop = trip.getStop(stopId);

    if (!stop) {
      return next(new AppError('Stop not found in this trip', 404));
    }

    (req as any).stop = stop;
    next();
  } catch (err) {
    next(err);
  }
};
