import { Request, Response, NextFunction } from 'express';
import { syncService } from './sync.service';

const getUser = (req: Request) => {
  const user = (req as any).user;
  const uid = user?.firebaseUid || user?.userId;
  return {
    uid,
    displayName: user?.displayName || 'User',
  };
};

export const pushChanges = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { operations = [] } = req.body;

    const results = await syncService.processPush(
      user.uid,
      user.displayName,
      operations
    );

    res.status(200).json({
      success: true,
      data: {
        results,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const pullChanges = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { sinceTimestamp, tripId } = req.body;

    const pullResult = await syncService.processPull(
      user.uid,
      sinceTimestamp,
      tripId
    );

    res.status(200).json({
      success: true,
      data: pullResult,
    });
  } catch (err) {
    next(err);
  }
};

export const getStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    res.status(200).json({
      success: true,
      data: {
        status: 'online',
        serverTime: new Date().toISOString(),
        userId: user.uid,
      },
    });
  } catch (err) {
    next(err);
  }
};
