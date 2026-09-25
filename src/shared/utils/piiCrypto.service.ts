import crypto from 'crypto';
import parsePhoneNumberFromString, { CountryCode } from 'libphonenumber-js';
import { config } from '../../config';

export class PiiCryptoService {
  private static getKeyBuffer(): Buffer {
    const rawKey = config.PII_ENCRYPTION_KEY;
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }
    // Fallback: derive 32-byte key via SHA-256
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  private static getBlindIndexSecret(): Buffer {
    const rawSecret = config.PII_BLIND_INDEX_SECRET;
    if (/^[0-9a-fA-F]{64}$/.test(rawSecret)) {
      return Buffer.from(rawSecret, 'hex');
    }
    return crypto.createHash('sha256').update(rawSecret).digest();
  }

  /**
   * Normalizes raw phone inputs to canonical E.164 format (e.g. +919876543210).
   */
  static normalizePhoneNumber(rawPhone: string, defaultCountry: CountryCode = 'IN'): string | null {
    if (!rawPhone || typeof rawPhone !== 'string') return null;
    const trimmed = rawPhone.trim();
    if (!trimmed) return null;

    try {
      const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
      if (parsed && parsed.isValid()) {
        return parsed.format('E.164');
      }
    } catch {
      // Fallback below
    }

    // Fallback: Clean digits and leading '+'
    const cleaned = trimmed.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+') && cleaned.length >= 8) {
      return cleaned;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`; // Default Indian phone
    }
    return cleaned.length >= 7 ? `+${cleaned}` : null;
  }

  /**
   * Generates a deterministic HMAC-SHA256 blind index for exact search match
   * without decrypting database records or exposing plaintext.
   */
  static computeBlindIndex(canonicalPhone: string): string {
    if (!canonicalPhone) return '';
    return crypto
      .createHmac('sha256', this.getBlindIndexSecret())
      .update(canonicalPhone)
      .digest('hex');
  }

  /**
   * Encrypts plaintext data using AES-256-GCM.
   * Format: v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
   */
  static encrypt(plaintext: string): string {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getKeyBuffer(), iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts AES-256-GCM encrypted payload.
   * Gracefully returns original string if not encrypted in v1 format.
   */
  static decrypt(payload: string): string {
    if (!payload || typeof payload !== 'string') return '';
    if (!payload.startsWith('v1:')) {
      return payload; // Legacy unencrypted plaintext
    }

    const parts = payload.split(':');
    if (parts.length !== 4) {
      return payload;
    }

    const [, ivHex, tagHex, ciphertextHex] = parts;
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.getKeyBuffer(), iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err) {
      // If decryption fails, return masked placeholder to prevent crash
      return '[ENCRYPTED_PII]';
    }
  }

  /**
   * Masks a phone number for safe display and logging (e.g., +91 98****3210).
   */
  static maskPhoneNumber(phone: string): string {
    if (!phone) return '';
    const clean = phone.trim();
    if (clean.length < 6) return '****';
    const start = clean.slice(0, 4);
    const end = clean.slice(-3);
    return `${start}${'*'.repeat(Math.max(2, clean.length - 7))}${end}`;
  }
}
