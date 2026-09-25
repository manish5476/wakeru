import mongoose from 'mongoose';
import { config } from '../config';
import { User } from '../modules/auth/auth.model';
import { Expense } from '../modules/expense/expense.model';
import { PiiCryptoService } from '../shared/utils/piiCrypto.service';
import { logger } from '../config/logger';

async function migrateBankingAndExpenses() {
  logger.info('🚀 Starting Comprehensive Banking & Expense Privacy Migration...');

  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info(' Connected to MongoDB');

    // ── 1. MIGRATE BANKING DETAILS ──────────────────────────────────────────
    logger.info('📦 Phase 1: Encrypting Banking & UPI Details...');
    const userCursor = User.collection.find({
      $or: [
        { 'bankingDetails.upiId': { $exists: true, $nin: [null, ''] } },
        { 'bankingDetails.bankAccount.accountNumber': { $exists: true, $nin: [null, ''] } },
      ],
    });

    let usersMigrated = 0;
    while (await userCursor.hasNext()) {
      const user = await userCursor.next();
      if (!user) break;

      const updateSet: Record<string, any> = {};
      const updateUnset: Record<string, any> = {};

      const bd = user.bankingDetails || {};
      if (bd.upiId && !bd.upiIdEncrypted) {
        const normalizedUpi = bd.upiId.trim().toLowerCase();
        updateSet['bankingDetails.upiIdEncrypted'] = PiiCryptoService.encrypt(normalizedUpi);
        updateSet['bankingDetails.upiSearchIndex'] = PiiCryptoService.computeUpiBlindIndex(normalizedUpi);
        updateUnset['bankingDetails.upiId'] = '';
      }

      if (bd.bankAccount) {
        const { accountNumber, ifscCode, accountHolderName } = bd.bankAccount;
        if (accountNumber && !bd.bankAccount.accountNumberEncrypted) {
          updateSet['bankingDetails.bankAccount.accountNumberEncrypted'] = PiiCryptoService.encrypt(accountNumber.trim());
          updateSet['bankingDetails.bankAccount.accountNumberMasked'] = PiiCryptoService.maskAccountNumber(accountNumber);
          updateUnset['bankingDetails.bankAccount.accountNumber'] = '';
        }
        if (ifscCode && !bd.bankAccount.ifscCodeEncrypted) {
          updateSet['bankingDetails.bankAccount.ifscCodeEncrypted'] = PiiCryptoService.encrypt(ifscCode.trim().toUpperCase());
          updateUnset['bankingDetails.bankAccount.ifscCode'] = '';
        }
        if (accountHolderName && !bd.bankAccount.accountHolderNameEncrypted) {
          updateSet['bankingDetails.bankAccount.accountHolderNameEncrypted'] = PiiCryptoService.encrypt(accountHolderName.trim());
          updateUnset['bankingDetails.bankAccount.accountHolderName'] = '';
        }
      }

      if (Object.keys(updateSet).length > 0 || Object.keys(updateUnset).length > 0) {
        const updateDoc: any = {};
        if (Object.keys(updateSet).length > 0) updateDoc.$set = updateSet;
        if (Object.keys(updateUnset).length > 0) updateDoc.$unset = updateUnset;

        await User.collection.updateOne({ _id: user._id }, updateDoc);
        usersMigrated++;
      }
    }
    logger.info(`   Users Banking Encrypted: ${usersMigrated}`);

    // ── 2. MIGRATE EXPENSE NOTES & INTEGRITY HASHES ──────────────────────────
    logger.info('📦 Phase 2: Encrypting Expense Notes & Computing Ledger Hashes...');
    const expenseCursor = Expense.collection.find({
      $or: [
        { notes: { $exists: true, $nin: [null, ''] } },
        { integrityHash: { $exists: false } },
        { splitMethod: 'personal', isPrivateVault: { $ne: true } },
      ],
    });

    let expensesMigrated = 0;
    while (await expenseCursor.hasNext()) {
      const exp = await expenseCursor.next();
      if (!exp) break;

      const updateSet: Record<string, any> = {};
      const updateUnset: Record<string, any> = {};

      if (exp.notes && !exp.notesEncrypted) {
        updateSet.notesEncrypted = PiiCryptoService.encrypt(exp.notes);
        updateUnset.notes = '';
      }

      if (exp.splitMethod === 'personal' && !exp.isPrivateVault) {
        updateSet.isPrivateVault = true;
      }

      if (!exp.integrityHash) {
        updateSet.integrityHash = PiiCryptoService.computeHashChain(exp.previousHash || '', {
          amountBase: exp.amountBase,
          paidBy: exp.paidBy,
          title: exp.title,
          date: exp.date,
          splitsCount: exp.splits?.length || 0,
        });
      }

      if (Object.keys(updateSet).length > 0 || Object.keys(updateUnset).length > 0) {
        const updateDoc: any = {};
        if (Object.keys(updateSet).length > 0) updateDoc.$set = updateSet;
        if (Object.keys(updateUnset).length > 0) updateDoc.$unset = updateUnset;

        await Expense.collection.updateOne({ _id: exp._id }, updateDoc);
        expensesMigrated++;
      }
    }
    logger.info(`   Expenses Encrypted & Hashed: ${expensesMigrated}`);

    logger.info('═══════════════════════════════════════════════════════');
    logger.info(' All Banking & Expense Privacy Migrations Completed Successfully!');
    logger.info('═══════════════════════════════════════════════════════');
  } catch (error: any) {
    logger.error(` Fatal migration error: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info(' Disconnected from MongoDB');
  }
}

if (require.main === module) {
  migrateBankingAndExpenses()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { migrateBankingAndExpenses };
