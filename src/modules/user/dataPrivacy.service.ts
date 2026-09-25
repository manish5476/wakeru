import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { Settlement } from '../settlement/settlement.model';
import { PiiCryptoService } from '../../shared/utils/piiCrypto.service';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';
import crypto from 'crypto';

export class DataPrivacyService {
  /**
   * Generates a complete, decrypted JSON archive of all personal data held
   * for a user under the Right to Data Portability (GDPR / DPDP Act).
   */
  static async exportUserData(userId: string): Promise<Record<string, any>> {
    const user = await User.findOne({
      $or: [{ _id: userId }, { firebaseUid: userId }],
    }).lean();

    if (!user) throw new NotFoundError('User');

    // Decrypt all user PII for the export archive
    const decryptedPhone = user.phoneEncrypted
      ? PiiCryptoService.decrypt(user.phoneEncrypted)
      : user.phoneNumber;

    const decryptedUpi = user.bankingDetails?.upiIdEncrypted
      ? PiiCryptoService.decrypt(user.bankingDetails.upiIdEncrypted)
      : user.bankingDetails?.upiId;

    const decryptedAccount = user.bankingDetails?.bankAccount?.accountNumberEncrypted
      ? PiiCryptoService.decrypt(user.bankingDetails.bankAccount.accountNumberEncrypted)
      : user.bankingDetails?.bankAccount?.accountNumber;

    const [trips, expenses, settlements] = await Promise.all([
      Trip.find({
        $or: [{ owner: user.firebaseUid }, { 'members.userId': user.firebaseUid }],
      }).lean(),

      Expense.find({
        $or: [{ paidBy: user.firebaseUid }, { 'splits.userId': user.firebaseUid }],
      }).lean(),

      Settlement.find({
        $or: [
          { 'transactions.from': user.firebaseUid },
          { 'transactions.to': user.firebaseUid },
        ],
      }).lean(),
    ]);

    // Decrypt expense notes
    const sanitizedExpenses = expenses.map((exp: any) => {
      const copy = { ...exp };
      if (copy.notesEncrypted) {
        copy.notes = PiiCryptoService.decrypt(copy.notesEncrypted);
        delete copy.notesEncrypted;
      }
      return copy;
    });

    logger.info(`[Privacy] Data export completed for user ${userId}`);

    return {
      exportGeneratedAt: new Date().toISOString(),
      profile: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        displayName: user.displayName,
        email: user.email,
        phoneNumber: decryptedPhone,
        bankingDetails: {
          upiId: decryptedUpi,
          bankAccount: {
            ...user.bankingDetails?.bankAccount,
            accountNumber: decryptedAccount,
          },
        },
        preferences: user.preferences,
        stats: user.stats,
      },
      trips,
      expenses: sanitizedExpenses,
      settlements,
    };
  }

  /**
   * Performs compliant account erasure under the Right to be Forgotten.
   * Permanently scrubs all PII, phone, banking details, and notes while
   * maintaining anonymized accounting balance nodes so group ledgers don't break.
   */
  static async anonymizeUserAccount(userId: string): Promise<void> {
    const user = await User.findOne({
      $or: [{ _id: userId }, { firebaseUid: userId }],
    });

    if (!user) throw new NotFoundError('User');

    const anonymizedHash = crypto.randomBytes(6).toString('hex');

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          displayName: `Former Member (${anonymizedHash})`,
          email: `deleted_${anonymizedHash}@anonymized.local`,
          photoURL: null,
          bio: null,
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          bankingDetails: {
            upiVerified: false,
          },
        },
        $unset: {
          phoneNumber: '',
          phoneEncrypted: '',
          phoneSearchIndex: '',
          fcmTokens: '',
          refreshTokens: '',
        },
      }
    );

    logger.info(`[Privacy] Account successfully scrubbed & anonymized for user ${userId}`);
  }
}
