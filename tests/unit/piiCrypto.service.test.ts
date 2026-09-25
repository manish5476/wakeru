import { PiiCryptoService } from '../../src/shared/utils/piiCrypto.service';

describe('PiiCryptoService (Security, PII Encryption & Audit Integrity)', () => {
  describe('AES-256-GCM Envelope Encryption', () => {
    it('encrypts plaintext into v1:iv:tag:ciphertext format', () => {
      const plaintext = 'sensitive_account_number_9876543210';
      const encrypted = PiiCryptoService.encrypt(plaintext);

      expect(encrypted.startsWith('v1:')).toBe(true);
      const parts = encrypted.split(':');
      expect(parts.length).toBe(4);
      expect(parts[1].length).toBe(24); // 12-byte IV in hex = 24 chars
      expect(parts[2].length).toBe(32); // 16-byte auth tag in hex = 32 chars
    });

    it('decrypts back to original plaintext accurately', () => {
      const sensitiveList = [
        '+919876543210',
        'my-secret-bank-account-456789',
        'private expense note: split hotel with John',
        'alice@upi',
      ];

      for (const item of sensitiveList) {
        const encrypted = PiiCryptoService.encrypt(item);
        expect(encrypted).not.toBe(item);
        const decrypted = PiiCryptoService.decrypt(encrypted);
        expect(decrypted).toBe(item);
      }
    });

    it('gracefully handles legacy plaintext without throwing', () => {
      const legacy = '+919999988888';
      expect(PiiCryptoService.decrypt(legacy)).toBe(legacy);
    });

    it('gracefully handles corrupted ciphertext with safe fallback placeholder', () => {
      const corrupted = 'v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:badciphertext';
      expect(PiiCryptoService.decrypt(corrupted)).toBe('[ENCRYPTED_PII]');
    });
  });

  describe('HMAC-SHA256 Blind Indexing', () => {
    it('produces deterministic blind index for identical phone numbers', () => {
      const phone = '+919876543210';
      const index1 = PiiCryptoService.computeBlindIndex(phone);
      const index2 = PiiCryptoService.computeBlindIndex(phone);
      expect(index1).toBe(index2);
      expect(index1.length).toBe(64); // SHA-256 hex string
    });

    it('produces distinct blind index for different phone numbers', () => {
      const index1 = PiiCryptoService.computeBlindIndex('+919876543210');
      const index2 = PiiCryptoService.computeBlindIndex('+919876543211');
      expect(index1).not.toBe(index2);
    });

    it('produces deterministic blind index for UPI IDs regardless of casing', () => {
      const upiLower = 'alice@okhdfcbank';
      const upiMixed = 'AliCe@OkHdfcBank';
      const index1 = PiiCryptoService.computeUpiBlindIndex(upiLower);
      const index2 = PiiCryptoService.computeUpiBlindIndex(upiMixed);
      expect(index1).toBe(index2);
    });
  });

  describe('Phone Canonicalization (E.164)', () => {
    it('canonicalizes standard Indian numbers to E.164', () => {
      expect(PiiCryptoService.normalizePhoneNumber('9876543210')).toBe('+919876543210');
      expect(PiiCryptoService.normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210');
      expect(PiiCryptoService.normalizePhoneNumber('09876543210')).toBe('+919876543210');
    });

    it('preserves valid international numbers in E.164', () => {
      const usNumber = '+14155552671';
      expect(PiiCryptoService.normalizePhoneNumber(usNumber)).toBe(usNumber);
    });
  });

  describe('Safe Data Masking', () => {
    it('masks phone numbers safely', () => {
      const masked = PiiCryptoService.maskPhoneNumber('+919876543210');
      expect(masked).toBe('+919******210');
      expect(masked).not.toContain('76543');
    });

    it('masks bank account numbers preserving only last 4 digits', () => {
      const masked = PiiCryptoService.maskAccountNumber('1234567890124321');
      expect(masked).toBe('**** **** 4321');
    });

    it('masks UPI IDs safely', () => {
      const masked = PiiCryptoService.maskUpiId('manish@okhdfcbank');
      expect(masked).toBe('m*****@okhdfcbank');
    });
  });

  describe('Ledger Audit Hash Chain Integrity', () => {
    it('computes deterministic hash chain block for transaction data', () => {
      const prevHash = 'genesis_hash_0000000000000000';
      const data = { amount: 1500, title: 'Dinner', paidBy: 'user_alice' };
      const hash1 = PiiCryptoService.computeHashChain(prevHash, data);
      const hash2 = PiiCryptoService.computeHashChain(prevHash, data);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('detects tampering when data or order changes', () => {
      const prevHash = 'genesis_hash_0000000000000000';
      const original = { amount: 1500, title: 'Dinner', paidBy: 'user_alice' };
      const tampered = { amount: 1501, title: 'Dinner', paidBy: 'user_alice' };

      const hashOriginal = PiiCryptoService.computeHashChain(prevHash, original);
      const hashTampered = PiiCryptoService.computeHashChain(prevHash, tampered);

      expect(hashOriginal).not.toBe(hashTampered);
    });
  });
});
