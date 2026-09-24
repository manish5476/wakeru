import { LedgerService } from '../../src/modules/ledger/ledger.service';

describe('LedgerService (Canonical Financial Ledger Engine)', () => {
  describe('Cents / Currency Precision Math', () => {
    it('converts monetary floats to integer cents deterministically', () => {
      expect(LedgerService.toCents(10.55)).toBe(1055);
      expect(LedgerService.toCents(0.1 + 0.2)).toBe(30);
      expect(LedgerService.toCents(0)).toBe(0);
      expect(LedgerService.toCents(NaN)).toBe(0);
    });

    it('converts cents back to 2-decimal floats accurately', () => {
      expect(LedgerService.fromCents(1055)).toBe(10.55);
      expect(LedgerService.fromCents(30)).toBe(0.3);
      expect(LedgerService.fromCents(0)).toBe(0);
    });

    it('handles rounding edge-cases without financial drift', () => {
      const cents = LedgerService.toCents(33.3333333);
      expect(cents).toBe(3333);
      expect(LedgerService.fromCents(cents)).toBe(33.33);
    });
  });

  describe('User Identity & Self-Debt Prevention', () => {
    it('identifies identical IDs and prevents self-debt', () => {
      expect(LedgerService.areSameUser('user123', 'user123')).toBe(true);
      expect(LedgerService.areSameUser('USER123', 'user123')).toBe(true);
      expect(LedgerService.areSameUser(' user123 ', 'user123')).toBe(true);
      expect(LedgerService.areSameUser('user123', 'user456')).toBe(false);
    });

    it('handles null/undefined gracefully without throwing', () => {
      expect(LedgerService.areSameUser('', 'user123')).toBe(false);
      expect(LedgerService.areSameUser('user123', '')).toBe(false);
    });
  });
});
