import { Request, Response, NextFunction } from 'express';
import { TravelPlan } from './travelPlan.model';
import { AppError } from '../../shared/errors/AppError';
import { Trip } from './trip.model';

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.uid) throw new AppError('Not authenticated', 401);
  return user as { uid: string; displayName: string; photoURL?: string };
};

export const getTravelPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;
    const user = getUser(req);

    // Verify trip exists and user is a member
    const trip = await Trip.findById(tripId);
    if (!trip) throw new AppError('Trip not found', 404);
    
    const isMember = trip.members.some(m => m.userId === user.uid && m.isActive);
    if (!isMember) throw new AppError('Not authorized to view this trip plan', 403);

    let plan = await TravelPlan.findOne({ tripId });
    if (!plan) {
      // Create empty plan if it doesn't exist
      plan = await TravelPlan.create({ tripId });
    }

    res.status(200).json({ status: 'success', data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const updateTravelPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;
    const user = getUser(req);

    const trip = await Trip.findById(tripId);
    if (!trip) throw new AppError('Trip not found', 404);
    
    // Only admins or members can edit. Viewers cannot edit.
    const member = trip.members.find(m => m.userId === user.uid && m.isActive);
    if (!member) throw new AppError('Not authorized to edit this trip plan', 403);
    if (member.role === 'viewer') throw new AppError('Viewers cannot edit the travel plan', 403);

    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ status: 'success', data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const activateTrip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;
    const user = getUser(req);

    const trip = await Trip.findById(tripId);
    if (!trip) throw new AppError('Trip not found', 404);
    
    const member = trip.members.find(m => m.userId === user.uid && m.isActive);
    if (!member || member.role === 'viewer') throw new AppError('Not authorized to activate this trip', 403);

    if (trip.status === 'planning') {
      trip.status = 'active';
      await trip.save();
    }

    res.status(200).json({ status: 'success', data: { trip } });
  } catch (error) {
    next(error);
  }
};
