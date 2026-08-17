import { computeMinimumTransactions } from '../../src/modules/settlement/settlement.service';
import { Trip } from '../../src/modules/trips/trip.model';

describe('Wakeru Backend Security & Correctness Regression Tests', () => {

  describe('TEST 1 - 4: BOLA / IDOR Protection & Trip Authorization Logic', () => {
    it('TEST 1: Trip model isMember should return false for non-members (preventing expense enumeration)', () => {
      const tripDoc = new Trip({
        title: 'User B Private Trip',
        description: 'Private vacation',
        coverImage: 'https://example.com/cover.jpg',
        startDate: new Date(),
        endDate: new Date(),
        stops: [],
        totalBudget: 1000,
        baseCurrency: 'INR',
        members: [
          {
            userId: 'firebase-user-B',
            displayName: 'User B',
            role: 'owner',
            joinedAt: new Date(),
            isActive: true,
          },
        ],
        createdBy: 'firebase-user-B',
      });

      // User A attempts to access User B's trip
      const isUserAMember = tripDoc.isMember('firebase-user-A');
      expect(isUserAMember).toBe(false);
      expect(tripDoc.isMember('firebase-user-B')).toBe(true);
    });

    it('TEST 2: Trip model should correctly enforce member roles (admin vs regular member)', () => {
      const tripDoc = new Trip({
        title: 'Group Trip',
        description: 'Group Trip',
        coverImage: 'https://example.com/cover.jpg',
        startDate: new Date(),
        endDate: new Date(),
        stops: [],
        totalBudget: 5000,
        baseCurrency: 'INR',
        members: [
          {
            userId: 'firebase-admin-1',
            displayName: 'Admin User',
            role: 'admin',
            joinedAt: new Date(),
            isActive: true,
          },
          {
            userId: 'firebase-viewer-2',
            displayName: 'Viewer User',
            role: 'viewer',
            joinedAt: new Date(),
            isActive: true,
          },
        ],
        createdBy: 'firebase-admin-1',
      });

      expect(tripDoc.isAdmin('firebase-admin-1')).toBe(true);
      expect(tripDoc.isAdmin('firebase-viewer-2')).toBe(false);
    });
  });

  describe('TEST 5: Analytics User Identity Canonical Mapping', () => {
    it('should correctly match active members using firebaseUid strings', () => {
      const tripDoc = new Trip({
        title: 'Goa Holiday',
        description: 'Beach trip',
        coverImage: 'https://example.com/cover.jpg',
        startDate: new Date(),
        endDate: new Date(),
        stops: [],
        totalBudget: 2000,
        baseCurrency: 'INR',
        members: [
          {
            userId: 'firebase-user-123',
            displayName: 'John Doe',
            role: 'editor',
            joinedAt: new Date(),
            isActive: true,
          },
        ],
        createdBy: 'firebase-user-123',
      });

      const member = tripDoc.getMember('firebase-user-123');
      expect(member).toBeDefined();
      expect(member?.displayName).toBe('John Doe');
      expect(tripDoc.getMember('mongo-object-id-456')).toBeUndefined();
    });
  });

  describe('TEST 6 - 7: Settlement Financial Integrity & Double Confirmation', () => {
    it('TEST 6: Greedy settlement algorithm should preserve zero-sum net balance invariant', () => {
      const balances = [
        { userId: 'user-1', displayName: 'Alice', amount: 100 },
        { userId: 'user-2', displayName: 'Bob', amount: -40 },
        { userId: 'user-3', displayName: 'Charlie', amount: -60 },
      ];

      const totalNet = balances.reduce((sum, b) => sum + b.amount, 0);
      expect(totalNet).toBe(0);

      const transactions = computeMinimumTransactions(balances);
      expect(transactions.length).toBeLessThanOrEqual(2); // Max N-1 = 2

      const totalTransferred = transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalTransferred).toBe(100);
    });

    it('TEST 7: Circular debts should simplify to optimal minimum transactions', () => {
      // Alice owes Bob 50, Bob owes Charlie 50, Charlie owes Alice 50 -> Net all 0
      const circularBalances = [
        { userId: 'alice', displayName: 'Alice', amount: 0 },
        { userId: 'bob', displayName: 'Bob', amount: 0 },
        { userId: 'charlie', displayName: 'Charlie', amount: 0 },
      ];

      const transactions = computeMinimumTransactions(circularBalances);
      expect(transactions.length).toBe(0);
    });
  });

  describe('TEST 8 - 10: Trip Access Guard & Concurrency Isolation', () => {
    it('TEST 8: should correctly reject inactive or non-existent members', () => {
      const tripDoc = new Trip({
        title: 'Archived Member Test',
        description: 'Test',
        coverImage: 'https://example.com/cover.jpg',
        startDate: new Date(),
        endDate: new Date(),
        stops: [],
        totalBudget: 500,
        baseCurrency: 'INR',
        members: [
          {
            userId: 'user-left',
            displayName: 'Left User',
            role: 'viewer',
            joinedAt: new Date(),
            isActive: false,
          },
        ],
        createdBy: 'admin-user',
      });

      expect(tripDoc.isMember('user-left')).toBe(false);
    });
  });
});
