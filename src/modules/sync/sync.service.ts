import { Types } from 'mongoose';
import { SyncLog } from './sync.model';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { Stop } from '../trips/stop.model';
import { Settlement } from '../settlement/settlement.model';
import * as expenseService from '../expense/expense.service';
import { logger } from '../../config/logger';

export interface PushOperation {
  clientOperationId: string;
  entityType: 'trip' | 'expense' | 'settlement';
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  clientTimestamp?: string;
}

export interface PushResult {
  clientOperationId: string;
  status: 'APPLIED' | 'CONFLICT' | 'VALIDATION_ERROR';
  serverId?: string;
  serverRecord?: any;
  error?: string;
}

export class SyncService {
  /**
   * Processes a batch of operations pushed from an offline client.
   * Guarantees idempotency via clientOperationId.
   */
  async processPush(
    userId: string,
    userDisplayName: string,
    operations: PushOperation[]
  ): Promise<PushResult[]> {
    const results: PushResult[] = [];

    for (const op of operations) {
      // 1. Idempotency check: has this operation already been processed?
      const existingLog = await SyncLog.findOne({ clientOperationId: op.clientOperationId });
      if (existingLog) {
        results.push({
          clientOperationId: op.clientOperationId,
          status: existingLog.status,
          serverId: existingLog.entityId,
          serverRecord: existingLog.resultPayload,
          error: existingLog.error,
        });
        continue;
      }

      try {
        if (op.entityType === 'expense') {
          if (op.operationType === 'CREATE') {
            let stopId = op.payload.stopId;
            const tripId = op.payload.tripId;

            // Auto-resolve stopId if omitted or empty from offline client
            if (!stopId && tripId) {
              const defaultStop = await Stop.findOne({ tripId });
              if (defaultStop) {
                stopId = defaultStop._id.toString();
              } else {
                // If trip exists with no stops, create a default stop
                const trip = await Trip.findById(tripId);
                if (trip) {
                  const newStop = await Stop.create({
                    tripId: trip._id,
                    name: 'General',
                    currency: trip.baseCurrency || 'INR',
                    currentExchangeRate: 1,
                    order: 0,
                    createdBy: userId,
                  });
                  stopId = newStop._id.toString();
                }
              }
            }

            // Ensure amountLocal is present if amountMinor was sent
            const amountLocal = op.payload.amountLocal !== undefined
              ? op.payload.amountLocal
              : (op.payload.amountMinor ? op.payload.amountMinor / 100 : 0);

            // Ensure split memberIds is populated for equal splits
            const split = { ...(op.payload.split || { method: 'equal' }) };
            if (split.method === 'equal' && (!split.memberIds || split.memberIds.length === 0)) {
              if (op.payload.splits && Array.isArray(op.payload.splits) && op.payload.splits.length > 0) {
                split.memberIds = op.payload.splits.map((s: any) => s.userId);
              } else if (tripId) {
                const trip = await Trip.findById(tripId);
                if (trip) {
                  split.memberIds = trip.getActiveMembers().map((m) => m.userId);
                }
              }
            }

            // Validate split sums match total amount if splits array was provided
            if (op.payload.splits && Array.isArray(op.payload.splits) && op.payload.splits.length > 0) {
              const totalSplitMinor = op.payload.splits.reduce(
                (sum: number, s: any) => sum + (s.amountMinor ?? Math.round((s.amountLocal || 0) * 100)),
                0
              );
              const totalMinor = op.payload.amountMinor ?? Math.round(amountLocal * 100);
              if (Math.abs(totalSplitMinor - totalMinor) > 1) {
                throw new Error(`Split sum (${totalSplitMinor}) does not match total amount (${totalMinor})`);
              }
            }

            const input = {
              stopId,
              title: op.payload.title,
              category: op.payload.category || 'other',
              amountLocal,
              currency: op.payload.currency || 'INR',
              paidBy: op.payload.paidBy || userId,
              date: op.payload.date ? new Date(op.payload.date) : new Date(),
              notes: op.payload.notes,
              tags: op.payload.tags,
              location: op.payload.location,
              split,
            };

            const created = await expenseService.createExpense(
              input as any,
              userId,
              userDisplayName || 'User'
            );

            // Persist receipt metadata and images if provided
            if (op.payload.receiptMetadata) {
              const rm = op.payload.receiptMetadata;
              created.receiptMetadata = {
                receiptHash: rm.receiptHash,
                receiptNumber: rm.receiptNumber,
                merchantName: rm.receiptMerchant || rm.merchantName,
                receiptDate: rm.receiptDate ? new Date(rm.receiptDate) : undefined,
                ocrParserVersion: rm.ocrParserVersion,
                confidence: rm.confidence,
              };
              if (rm.receiptImageUri && !created.receiptImages.includes(rm.receiptImageUri)) {
                created.receiptImages.push(rm.receiptImageUri);
              }
              await created.save();
            }

            try {
              await SyncLog.create({
                clientOperationId: op.clientOperationId,
                userId,
                entityType: 'expense',
                entityId: created._id.toString(),
                operationType: 'CREATE',
                status: 'APPLIED',
                resultPayload: created,
              });
            } catch (logErr: any) {
              if (logErr.code === 11000 || logErr.message?.includes('duplicate key')) {
                const raceLog = await SyncLog.findOne({ clientOperationId: op.clientOperationId });
                if (raceLog) {
                  results.push({
                    clientOperationId: op.clientOperationId,
                    status: raceLog.status,
                    serverId: raceLog.entityId,
                    serverRecord: raceLog.resultPayload,
                    error: raceLog.error,
                  });
                  continue;
                }
              }
              throw logErr;
            }

            results.push({
              clientOperationId: op.clientOperationId,
              status: 'APPLIED',
              serverId: created._id.toString(),
              serverRecord: created,
            });
          } else if (op.operationType === 'UPDATE') {
            const existingExpense = await Expense.findById(op.entityId);
            if (!existingExpense) {
              results.push({
                clientOperationId: op.clientOperationId,
                status: 'CONFLICT',
                error: 'Expense not found on server',
              });
              continue;
            }

            const updated = await expenseService.updateExpense(
              op.entityId,
              op.payload,
              userId
            );

            try {
              await SyncLog.create({
                clientOperationId: op.clientOperationId,
                userId,
                entityType: 'expense',
                entityId: op.entityId,
                operationType: 'UPDATE',
                status: 'APPLIED',
                resultPayload: updated,
              });
            } catch (logErr: any) {
              if (logErr.code === 11000 || logErr.message?.includes('duplicate key')) {
                const raceLog = await SyncLog.findOne({ clientOperationId: op.clientOperationId });
                if (raceLog) {
                  results.push({
                    clientOperationId: op.clientOperationId,
                    status: raceLog.status,
                    serverId: raceLog.entityId,
                    serverRecord: raceLog.resultPayload,
                    error: raceLog.error,
                  });
                  continue;
                }
              }
              throw logErr;
            }

            results.push({
              clientOperationId: op.clientOperationId,
              status: 'APPLIED',
              serverId: op.entityId,
              serverRecord: updated,
            });
          } else if (op.operationType === 'DELETE') {
            const existingExpense = await Expense.findById(op.entityId);
            if (!existingExpense) {
              results.push({
                clientOperationId: op.clientOperationId,
                status: 'APPLIED',
                serverId: op.entityId,
              });
              continue;
            }

            if (!existingExpense.isArchived) {
              await expenseService.archiveExpense(op.entityId, userId);
            }

            try {
              await SyncLog.create({
                clientOperationId: op.clientOperationId,
                userId,
                entityType: 'expense',
                entityId: op.entityId,
                operationType: 'DELETE',
                status: 'APPLIED',
              });
            } catch (logErr: any) {
              if (logErr.code === 11000 || logErr.message?.includes('duplicate key')) {
                const raceLog = await SyncLog.findOne({ clientOperationId: op.clientOperationId });
                if (raceLog) {
                  results.push({
                    clientOperationId: op.clientOperationId,
                    status: raceLog.status,
                    serverId: raceLog.entityId,
                    serverRecord: raceLog.resultPayload,
                    error: raceLog.error,
                  });
                  continue;
                }
              }
              throw logErr;
            }

            results.push({
              clientOperationId: op.clientOperationId,
              status: 'APPLIED',
              serverId: op.entityId,
            });
          }
        } else if (op.entityType === 'trip') {
          if (op.operationType === 'UPDATE') {
            const trip = await Trip.findById(op.entityId);
            if (trip && trip.canEdit(userId)) {
              if (op.payload.title) trip.title = op.payload.title;
              if (op.payload.description !== undefined) trip.description = op.payload.description;
              await trip.save();

              try {
                await SyncLog.create({
                  clientOperationId: op.clientOperationId,
                  userId,
                  entityType: 'trip',
                  entityId: op.entityId,
                  operationType: 'UPDATE',
                  status: 'APPLIED',
                  resultPayload: trip,
                });
              } catch (logErr: any) {
                if (logErr.code === 11000 || logErr.message?.includes('duplicate key')) {
                  const raceLog = await SyncLog.findOne({ clientOperationId: op.clientOperationId });
                  if (raceLog) {
                    results.push({
                      clientOperationId: op.clientOperationId,
                      status: raceLog.status,
                      serverId: raceLog.entityId,
                      serverRecord: raceLog.resultPayload,
                      error: raceLog.error,
                    });
                    continue;
                  }
                }
                throw logErr;
              }

              results.push({
                clientOperationId: op.clientOperationId,
                status: 'APPLIED',
                serverId: op.entityId,
                serverRecord: trip,
              });
            } else {
              results.push({
                clientOperationId: op.clientOperationId,
                status: 'CONFLICT',
                error: 'Trip not found or permission denied',
              });
            }
          }
        } else {
          results.push({
            clientOperationId: op.clientOperationId,
            status: 'VALIDATION_ERROR',
            error: `Unsupported entity type: ${op.entityType}`,
          });
        }
      } catch (err: any) {
        if (err.code === 11000 || err.message?.includes('duplicate key')) {
          const raceLog = await SyncLog.findOne({ clientOperationId: op.clientOperationId });
          if (raceLog) {
            results.push({
              clientOperationId: op.clientOperationId,
              status: raceLog.status,
              serverId: raceLog.entityId,
              serverRecord: raceLog.resultPayload,
              error: raceLog.error,
            });
            continue;
          }
        }

        logger.error('[SyncService] Error processing operation:', {
          clientOperationId: op.clientOperationId,
          error: err.message,
        });

        try {
          await SyncLog.create({
            clientOperationId: op.clientOperationId,
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
            operationType: op.operationType,
            status: 'VALIDATION_ERROR',
            error: err.message,
          });
        } catch {
          // Ignore secondary logging failures
        }

        results.push({
          clientOperationId: op.clientOperationId,
          status: 'VALIDATION_ERROR',
          error: err.message || 'Operation failed',
        });
      }
    }

    return results;
  }

  /**
   * Pulls all entities updated since the given timestamp for the user's trips.
   */
  async processPull(userId: string, sinceTimestamp?: string, tripId?: string) {
    const since = sinceTimestamp && !isNaN(new Date(sinceTimestamp).getTime())
      ? new Date(sinceTimestamp)
      : new Date(0);

    // Get all trips user belongs to
    const userTrips = await Trip.find({
      'members.userId': userId,
      isArchived: false,
    });

    const tripIds = tripId
      ? [new Types.ObjectId(tripId)]
      : userTrips.map((t) => t._id);

    // Trips modified since
    const modifiedTrips = userTrips.filter((t) => t.updatedAt >= since);

    // Expenses modified since
    const modifiedExpenses = await Expense.find({
      tripId: { $in: tripIds },
      updatedAt: { $gte: since },
    }).lean();

    // Settlements modified since
    const modifiedSettlements = await Settlement.find({
      tripId: { $in: tripIds },
      updatedAt: { $gte: since },
    }).lean();

    return {
      serverTimestamp: new Date().toISOString(),
      trips: modifiedTrips,
      expenses: modifiedExpenses,
      settlements: modifiedSettlements,
    };
  }
}

export const syncService = new SyncService();
