import crypto from 'crypto';
import { PiiCryptoService } from '../../shared/utils/piiCrypto.service';
import { logger } from '../../config/logger';

export interface AuditRecord {
  entityId: string;
  entityType: 'expense' | 'settlement' | 'trip';
  action: 'create' | 'update' | 'delete' | 'settle';
  actorId: string;
  timestamp: Date;
  payloadHash: string;
  previousHash: string;
  chainHash: string;
}

export class AuditTrailService {
  /**
   * Generates a tamper-proof SHA-256 hash chain record for a financial event.
   */
  static generateChainHash(
    previousHash: string,
    action: string,
    entityId: string,
    payload: Record<string, any>
  ): { payloadHash: string; chainHash: string } {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload, Object.keys(payload).sort()))
      .digest('hex');

    const chainHash = PiiCryptoService.computeHashChain(previousHash, {
      action,
      entityId,
      payloadHash,
    });

    return { payloadHash, chainHash };
  }

  /**
   * Validates if an expense hash matches the computed chain hash to ensure no retroactive manipulation.
   */
  static verifyIntegrity(
    previousHash: string,
    storedHash: string,
    payload: Record<string, any>
  ): boolean {
    const computed = PiiCryptoService.computeHashChain(previousHash, payload);
    return computed === storedHash;
  }
}
