import { Trip } from '../../src/modules/trips/trip.model';
import { Invitation } from '../../src/modules/trips/invitation.model';
import { User } from '../../src/modules/auth/auth.model';
import * as tripService from '../../src/modules/trips/trip.service';
import { invitationService } from '../../src/modules/trips/invitation.service';

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

// Mock Socket Server
jest.mock('../../src/infrastructure/websocket/socket.server', () => ({
  socketServer: {
    notifyTripUpdated: jest.fn(),
    notifyMemberJoined: jest.fn(),
    notifyTripJoined: jest.fn(),
    notifyInvitationReceived: jest.fn(),
    notifyInvitationAccepted: jest.fn(),
    notifyInvitationDeclined: jest.fn(),
    notifyTripInvitation: jest.fn(),
    sendToUser: jest.fn(),
  },
}));

// Mock Entitlement & Notification services
jest.mock('../../src/modules/subscription', () => ({
  entitlementService: {
    assertWithinLimit: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../src/modules/notification/notification.service', () => ({
  notificationService: {
    sendNotification: jest.fn().mockResolvedValue(true),
    notifyInvitationAccepted: jest.fn().mockResolvedValue(true),
    notifyInvitationDeclined: jest.fn().mockResolvedValue(true),
    notifyTripInvitation: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../src/modules/notification/notification.model', () => ({
  Notification: {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../src/modules/trips/join_request.model', () => {
  const mockInstance = {
    save: jest.fn().mockResolvedValue(this),
    status: 'pending',
  };
  const MockJoinRequest: any = jest.fn().mockImplementation(() => mockInstance);
  MockJoinRequest.findOne = jest.fn().mockResolvedValue(null);
  MockJoinRequest.create = jest.fn().mockResolvedValue(mockInstance);
  return { JoinRequest: MockJoinRequest };
});

describe('Trip Extension & Invitation Lifecycle Regression Tests', () => {
  const adminUserId = 'user_admin_001';
  const inviteeUserId = 'user_invitee_002';
  const inviteeEmail = 'invitee@example.com';
  const validTripId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Scenario A & C: Trip Extension and Expiration Recalculation', () => {
    it('Scenario A: Extending trip auto-extends inviteCodeExpiresAt to cover extended end date', async () => {
      const now = new Date();
      const originalStart = new Date(now.getTime() + 1 * 86400000);
      const originalEnd = new Date(now.getTime() + 5 * 86400000);
      const originalInviteExpiry = new Date(originalEnd.getTime());

      const mockTripDoc: any = {
        _id: validTripId,
        title: 'Goa Holiday',
        startDate: originalStart,
        endDate: originalEnd,
        status: 'active',
        inviteCode: 'GOA12345',
        inviteCodeExpiresAt: originalInviteExpiry,
        members: [{ userId: adminUserId, role: 'owner', isActive: true }],
        save: jest.fn().mockResolvedValue(this),
        isMember: jest.fn().mockReturnValue(true),
        isAdmin: jest.fn().mockReturnValue(true),
      };

      const extendedEnd = new Date(now.getTime() + 15 * 86400000);
      await tripService.updateTrip(mockTripDoc, {
        endDate: extendedEnd.toISOString() as any,
      });

      expect(mockTripDoc.save).toHaveBeenCalled();
      expect(new Date(mockTripDoc.inviteCodeExpiresAt).getTime()).toBeGreaterThanOrEqual(extendedEnd.getTime());
    });

    it('Scenario B: Auto-reactivates status from completed to active if endDate is extended to future', async () => {
      const now = new Date();
      const pastStart = new Date(now.getTime() - 10 * 86400000);
      const pastEnd = new Date(now.getTime() - 2 * 86400000);

      const mockTripDoc: any = {
        _id: validTripId,
        title: 'Completed Expedition',
        startDate: pastStart,
        endDate: pastEnd,
        status: 'completed',
        inviteCode: 'COMP1234',
        inviteCodeExpiresAt: pastEnd,
        members: [{ userId: adminUserId, role: 'owner', isActive: true }],
        save: jest.fn().mockResolvedValue(this),
        isMember: jest.fn().mockReturnValue(true),
        isAdmin: jest.fn().mockReturnValue(true),
      };

      const futureEnd = new Date(now.getTime() + 7 * 86400000);
      await tripService.updateTrip(mockTripDoc, {
        endDate: futureEnd.toISOString() as any,
      });

      expect(mockTripDoc.status).toBe('active');
    });

    it('Scenario C: Multiple sequential extensions push inviteCodeExpiresAt forward reliably', async () => {
      const now = new Date();
      const mockTripDoc: any = {
        _id: validTripId,
        title: 'Rolling Conference',
        startDate: now,
        endDate: new Date(now.getTime() + 3 * 86400000),
        status: 'active',
        inviteCode: 'ROLL1234',
        inviteCodeExpiresAt: new Date(now.getTime() + 3 * 86400000),
        members: [{ userId: adminUserId, role: 'owner', isActive: true }],
        save: jest.fn().mockResolvedValue(this),
        isMember: jest.fn().mockReturnValue(true),
        isAdmin: jest.fn().mockReturnValue(true),
      };

      // Extension 1
      const ext1 = new Date(now.getTime() + 10 * 86400000);
      await tripService.updateTrip(mockTripDoc, { endDate: ext1.toISOString() as any });
      const expiry1 = new Date(mockTripDoc.inviteCodeExpiresAt).getTime();
      expect(expiry1).toBeGreaterThanOrEqual(ext1.getTime());

      // Extension 2
      const ext2 = new Date(now.getTime() + 20 * 86400000);
      await tripService.updateTrip(mockTripDoc, { endDate: ext2.toISOString() as any });
      const expiry2 = new Date(mockTripDoc.inviteCodeExpiresAt).getTime();
      expect(expiry2).toBeGreaterThanOrEqual(ext2.getTime());
      expect(expiry2).toBeGreaterThan(expiry1);
    });
  });

  describe('Scenario D: Invitations Carry Live Trip Dates', () => {
    it('getPendingInvitations populates trip startDate and endDate', async () => {
      const futureStart = new Date();
      const futureEnd = new Date(Date.now() + 10 * 86400000);

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: inviteeUserId,
            firebaseUid: inviteeUserId,
            email: inviteeEmail,
            displayName: 'Invitee',
          }),
        }),
      } as any);

      const mockInvitationsList = [
        {
          _id: 'inv_1',
          tripId: validTripId,
          fromUserId: adminUserId,
          status: 'pending',
        },
      ];

      jest.spyOn(Invitation, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockInvitationsList),
          }),
        }),
      } as any);

      jest.spyOn(Trip, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: validTripId,
              title: 'Extended Mountain Trip',
              startDate: futureStart,
              endDate: futureEnd,
              status: 'active',
            },
          ]),
        }),
      } as any);

      jest.spyOn(User, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { firebaseUid: adminUserId, displayName: 'Admin User' },
          ]),
        }),
      } as any);

      const pending: any = await invitationService.getPendingInvitations(inviteeUserId);
      expect(pending.length).toBe(1);
      expect(pending[0].tripId.startDate).toEqual(futureStart);
      expect(pending[0].tripId.endDate).toEqual(futureEnd);
    });
  });

  describe('Scenario E: Self-Healing Join by Invite Code on Extended Trip', () => {
    it('joinTripByInviteCode auto-extends inviteCodeExpiresAt if trip.endDate >= now even if expiresAt was stale', async () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 3600000); // 1 hour ago
      const futureEndDate = new Date(now.getTime() + 5 * 86400000); // 5 days in future

      const mockTripDoc: any = {
        _id: validTripId,
        title: 'Himalayan Trek',
        startDate: now,
        endDate: futureEndDate,
        status: 'active',
        inviteCode: 'TREK1234',
        inviteCodeExpiresAt: pastExpiry,
        members: [{ userId: adminUserId, role: 'owner', isActive: true }],
        isMember: jest.fn().mockReturnValue(false),
        save: jest.fn().mockResolvedValue(this),
      };

      jest.spyOn(Trip, 'findOne').mockResolvedValue(mockTripDoc);

      const res = await tripService.joinTripByInviteCode('TREK1234', {
        userId: inviteeUserId,
        displayName: 'Invitee User',
      });
      expect(res.status).toBe('pending');
      expect(new Date(mockTripDoc.inviteCodeExpiresAt).getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Scenario F: Idempotent Invitation Acceptance', () => {
    it('acceptInvitation does not add duplicate members if user is already an active member', async () => {
      const mockTripDoc: any = {
        _id: validTripId,
        title: 'Beach Party',
        members: [
          { userId: adminUserId, role: 'owner', isActive: true },
          { userId: inviteeUserId, role: 'member', isActive: true },
        ],
        save: jest.fn().mockResolvedValue(this),
      };

      const mockInvitation: any = {
        _id: 'inv_existing',
        tripId: validTripId,
        toUserId: inviteeUserId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000),
        save: jest.fn().mockResolvedValue(this),
      };

      jest.spyOn(Invitation, 'findById').mockResolvedValue(mockInvitation);
      jest.spyOn(Trip, 'findById').mockResolvedValue(mockTripDoc);
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: inviteeUserId,
            firebaseUid: inviteeUserId,
            displayName: 'Invitee User',
            email: inviteeEmail,
          }),
        }),
      } as any);

      const result = await invitationService.acceptInvitation('inv_existing', inviteeUserId);

      expect(mockInvitation.status).toBe('accepted');
      // Members count should still be 2, no duplicate
      expect(mockTripDoc.members.filter((m: any) => m.userId === inviteeUserId).length).toBe(1);
    });
  });

  describe('Scenario G: Preventing E11000 Duplicate Key Crashes on Re-invitation', () => {
    it('sendInvitation updates existing declined/expired invitation rather than crashing with duplicate key error', async () => {
      const mockExistingInvite: any = {
        _id: 'inv_old',
        tripId: validTripId,
        toUserId: inviteeUserId,
        status: 'declined',
        save: jest.fn().mockResolvedValue(this),
      };

      const mockTrip: any = {
        _id: validTripId,
        title: 'Re-invite Trip',
        createdBy: adminUserId,
        members: [{ userId: adminUserId, role: 'owner', isActive: true }],
        isMember: jest.fn().mockReturnValue(false),
        isAdmin: jest.fn().mockReturnValue(true),
        getMember: jest.fn().mockReturnValue({ userId: adminUserId, displayName: 'Admin User' }),
      };

      jest.spyOn(Trip, 'findById').mockResolvedValue(mockTrip);
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: inviteeUserId,
        displayName: 'Bob',
        firebaseUid: 'fb_bob',
        email: 'bob@example.com',
      } as any);
      jest.spyOn(Invitation, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Invitation, 'findOne').mockResolvedValue(mockExistingInvite);

      const result = await invitationService.sendInvitation(
        validTripId,
        inviteeUserId,
        adminUserId,
        'Trying again!'
      );

      expect(mockExistingInvite.status).toBe('pending');
      expect(mockExistingInvite.message).toBe('Trying again!');
      expect(mockExistingInvite.save).toHaveBeenCalled();
    });
  });

  describe('Scenario H & I: Email Acceptance and Public Preview', () => {
    it('Scenario H: Email invitation acceptance matches user email successfully', async () => {
      const mockTripDoc: any = {
        _id: validTripId,
        title: 'Email Trip',
        createdBy: adminUserId,
        members: [{ userId: adminUserId, role: 'owner', isActive: true }],
        save: jest.fn().mockResolvedValue(this),
        markModified: jest.fn(),
      };

      const mockInvitation: any = {
        _id: 'inv_email',
        tripId: validTripId,
        toUserId: inviteeEmail,
        email: inviteeEmail,
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000),
        save: jest.fn().mockResolvedValue(this),
      };

      jest.spyOn(Invitation, 'findById').mockResolvedValue(mockInvitation);
      jest.spyOn(Trip, 'findById').mockResolvedValue(mockTripDoc);
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: inviteeUserId,
            firebaseUid: inviteeUserId,
            email: inviteeEmail,
            displayName: 'Invitee User',
          }),
        }),
      } as any);

      const result = await invitationService.acceptInvitation('inv_email', inviteeUserId);

      expect(mockInvitation.status).toBe('accepted');
      expect(mockTripDoc.members.some((m: any) => m.userId === inviteeUserId)).toBe(true);
    });

    it('Scenario I: getTripByInviteCode returns public metadata with extended dates', async () => {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 86400000);

      jest.spyOn(Trip, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: validTripId,
            title: 'Public Trek',
            description: 'High altitude hike',
            coverImage: 'trek.jpg',
            startDate,
            endDate,
            baseCurrency: 'USD',
            members: [{ isActive: true }, { isActive: true }],
          }),
        }),
      } as any);

      const preview = await tripService.getTripByInviteCode('TREK1234');
      expect(preview.title).toBe('Public Trek');
      expect(preview.startDate).toEqual(startDate);
      expect(preview.endDate).toEqual(endDate);
      expect(preview.memberCount).toBe(2);
    });
  });
});
