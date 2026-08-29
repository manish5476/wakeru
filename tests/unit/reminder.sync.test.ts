import mongoose, { Types } from 'mongoose';
import { Reminder, IReminder } from '../../src/modules/reminders/reminder.model';
import { reminderService } from '../../src/modules/reminders/reminder.service';
import { AppError } from '../../src/shared/errors/AppError';

describe('Reminder Settlement Synchronization & Lifecycle Tests', () => {
    const mockTripId1 = new Types.ObjectId();
    const mockTripId2 = new Types.ObjectId();
    const mockSettlementId1 = new Types.ObjectId();
    const mockTxnId1 = new Types.ObjectId().toString();
    const mockTxnId2 = new Types.ObjectId().toString();

    const userAlice = 'user_alice_uid';
    const userBob = 'user_bob_uid';
    const userCharlie = 'user_charlie_uid';

    let reminderAliceBob: IReminder;
    let reminderAliceBobTxn1: IReminder;
    let reminderCharlieBob: IReminder;

    beforeEach(async () => {
        // Mock Reminder model methods for unit testing
        jest.restoreAllMocks();
    });

    // ============================================================
    // 1. MANUAL COMPLETION TESTS
    // ============================================================

    describe('reminderService.complete', () => {
        it('Test 1: should mark an active reminder as completed when authorized', async () => {
            const mockReminder = {
                _id: 'rem_123',
                userId: userBob, // creator
                targetUserId: userAlice, // recipient
                status: 'active',
            };

            const updatedReminder = {
                ...mockReminder,
                status: 'completed',
                completedAt: new Date(),
            };

            jest.spyOn(Reminder, 'findById').mockResolvedValue(mockReminder as any);
            jest.spyOn(Reminder, 'findOneAndUpdate').mockResolvedValue(updatedReminder as any);

            // Bob (creator) completes
            const resultBob = await reminderService.complete('rem_123', userBob);
            expect(resultBob.status).toBe('completed');

            // Alice (target) completes
            const resultAlice = await reminderService.complete('rem_123', userAlice);
            expect(resultAlice.status).toBe('completed');
        });

        it('Test 2: should be idempotent when completing an already completed reminder', async () => {
            const completedDate = new Date('2026-08-20T10:00:00Z');
            const mockReminder = {
                _id: 'rem_123',
                userId: userBob,
                targetUserId: userAlice,
                status: 'completed',
                completedAt: completedDate,
            };

            jest.spyOn(Reminder, 'findById').mockResolvedValue(mockReminder as any);
            const updateSpy = jest.spyOn(Reminder, 'findOneAndUpdate');

            const result = await reminderService.complete('rem_123', userBob);
            expect(result.status).toBe('completed');
            expect(result.completedAt).toEqual(completedDate);
            expect(updateSpy).not.toHaveBeenCalled(); // No unnecessary database write
        });

        it('Test 3: should reject unauthorized users with 403 AppError', async () => {
            const mockReminder = {
                _id: 'rem_123',
                userId: userBob,
                targetUserId: userAlice,
                status: 'active',
            };

            jest.spyOn(Reminder, 'findById').mockResolvedValue(mockReminder as any);

            await expect(
                reminderService.complete('rem_123', userCharlie)
            ).rejects.toThrow(AppError);

            await expect(
                reminderService.complete('rem_123', userCharlie)
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('Test 3b: should return 404 AppError if reminder does not exist', async () => {
            jest.spyOn(Reminder, 'findById').mockResolvedValue(null);

            await expect(
                reminderService.complete('rem_nonexistent', userBob)
            ).rejects.toThrow(AppError);

            await expect(
                reminderService.complete('rem_nonexistent', userBob)
            ).rejects.toMatchObject({ statusCode: 404 });
        });
    });

    // ============================================================
    // 2. SETTLEMENT SYNCHRONIZATION TESTS
    // ============================================================

    describe('reminderService.completeSettlementReminders', () => {
        it('Test 4: should complete only the reminder corresponding to the satisfied obligation', async () => {
            const updateManySpy = jest.spyOn(Reminder, 'updateMany').mockResolvedValue({
                acknowledged: true,
                matchedCount: 1,
                modifiedCount: 1,
                upsertedCount: 0,
                upsertedId: null,
            } as any);

            const modified = await reminderService.completeSettlementReminders(
                mockTripId1.toString(),
                mockSettlementId1.toString(),
                userAlice, // payer
                userBob,   // receiver
                mockTxnId1,
                false      // not fully settled yet
            );

            expect(modified).toBe(1);
            expect(updateManySpy).toHaveBeenCalledTimes(1);
            const callArg = updateManySpy.mock.calls[0][0] as any;
            expect(callArg.status).toEqual({ $in: ['active', 'paused'] });
            expect(callArg.$or).toEqual(
                expect.arrayContaining([
                    {
                        settlementId: expect.any(Types.ObjectId),
                        targetUserId: userAlice,
                        userId: userBob,
                    },
                    {
                        tripId: expect.any(Types.ObjectId),
                        targetUserId: userAlice,
                        userId: userBob,
                        type: { $in: ['settlement', 'payment'] },
                    },
                    {
                        'metadata.transactionId': mockTxnId1,
                    },
                ])
            );
        });

        it('Test 5: should complete all remaining settlement reminders if trip is fully settled', async () => {
            const updateManySpy = jest.spyOn(Reminder, 'updateMany').mockResolvedValue({
                acknowledged: true,
                matchedCount: 2,
                modifiedCount: 2,
                upsertedCount: 0,
                upsertedId: null,
            } as any);

            const modified = await reminderService.completeSettlementReminders(
                mockTripId1.toString(),
                mockSettlementId1.toString(),
                userAlice,
                userBob,
                mockTxnId1,
                true // isFullySettled: true
            );

            expect(updateManySpy).toHaveBeenCalledTimes(2);
            // Second call completes remaining trip_ending & settlement reminders
            const secondCallArg = updateManySpy.mock.calls[1][0] as any;
            expect(secondCallArg.tripId).toEqual(new Types.ObjectId(mockTripId1.toString()));
            expect(secondCallArg.type).toEqual({ $in: ['settlement', 'trip_ending'] });
        });

        it('Test 6: should not complete reminders from an unrelated trip or different users', async () => {
            let capturedQueries: any[] = [];
            (jest.spyOn(Reminder, 'updateMany') as any).mockImplementation((query: any) => {
                capturedQueries.push(query);
                return Promise.resolve({ modifiedCount: 1 });
            });

            await reminderService.completeSettlementReminders(
                mockTripId1.toString(),
                mockSettlementId1.toString(),
                userAlice,
                userBob,
                mockTxnId1,
                false
            );

            // Verify the query strictly scoped to Trip 1 and Alice->Bob
            const q = capturedQueries[0];
            const orList = q.$or;
            // Verify that Trip 2 is NOT touched
            for (const cond of orList) {
                if (cond.tripId) {
                    expect(cond.tripId.toString()).toBe(mockTripId1.toString());
                }
                if (cond.targetUserId) {
                    expect(cond.targetUserId).toBe(userAlice);
                }
            }
        });
    });

    // ============================================================
    // 3. SCHEDULER AUDIT TESTS
    // ============================================================

    describe('Scheduler & Cron Audit', () => {
        it('Test 7: Completed reminders must never be selected by the due reminders query', async () => {
            const findSpy = jest.spyOn(Reminder, 'find').mockResolvedValue([] as any);

            await reminderService.processDueReminders();

            expect(findSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'active',
                })
            );
            // Query strictly specifies status: 'active', meaning 'completed', 'paused', 'cancelled' can never match
        });
    });

    // ============================================================
    // 4. AMOUNT EXTRACTION & PARSER TESTS
    // ============================================================

    describe('Amount Extraction & Formatting Rules', () => {
        // Pattern simulation matching frontend reminder.utils.ts logic
        function parseTestAmount(message: string, metadata?: { amount?: number; currency?: string }) {
            if (metadata?.amount !== undefined && metadata.amount !== null) {
                return {
                    amount: metadata.amount,
                    currency: metadata.currency || 'INR',
                };
            }

            const symbolMatch = message.match(/(?:[^\w]|^)(₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/);
            if (symbolMatch) {
                const symbol = symbolMatch[1];
                const rawNum = symbolMatch[2].replace(/,/g, '');
                let currency = 'INR';
                if (symbol === '$') currency = 'USD';
                else if (symbol === '€') currency = 'EUR';
                else if (symbol === '£') currency = 'GBP';
                return { amount: parseFloat(rawNum), currency };
            }

            const codeMatch = message.match(/(?:[^\w]|^)(INR|USD|EUR|GBP|AED|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
            if (codeMatch) {
                const rawCode = codeMatch[1].toUpperCase().replace(/\./g, '');
                const rawNum = codeMatch[2].replace(/,/g, '');
                const currency = rawCode === 'RS' ? 'INR' : rawCode;
                return { amount: parseFloat(rawNum), currency };
            }

            return null;
        }

        it('Test 8: should extract structured amount from metadata as highest priority', () => {
            const result = parseTestAmount('jay mathurkar owes you INR 500', { amount: 1250, currency: 'INR' });
            expect(result).toEqual({ amount: 1250, currency: 'INR' });
        });

        it('Test 9: should parse INR 500 message correctly', () => {
            const result = parseTestAmount('jay mathurkar owes you INR 500.00');
            expect(result).toEqual({ amount: 500, currency: 'INR' });
        });

        it('Test 10: should parse ₹1,500 message correctly', () => {
            const result = parseTestAmount('Please pay ₹1,500 for GOA trip');
            expect(result).toEqual({ amount: 1500, currency: 'INR' });
        });

        it('Test 11: should parse Rs. 750 message correctly', () => {
            const result = parseTestAmount('Friend owes you Rs. 750');
            expect(result).toEqual({ amount: 750, currency: 'INR' });
        });

        it('Test 12: should parse other currencies (USD $50, EUR €120) correctly', () => {
            expect(parseTestAmount('Please pay $50 for lunch')).toEqual({ amount: 50, currency: 'USD' });
            expect(parseTestAmount('Please settle €120 for museum')).toEqual({ amount: 120, currency: 'EUR' });
        });

        it('Test 13: should return null for messages without amount (not false 0)', () => {
            expect(parseTestAmount('Please check the trip summary')).toBeNull();
        });
    });
});
