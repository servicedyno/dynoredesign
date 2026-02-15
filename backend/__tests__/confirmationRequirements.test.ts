/**
 * Unit Tests: Confirmation Requirements
 * Tests CONFIRMATION_REQUIREMENTS and ESTIMATED_CONFIRMATION_TIMES
 * 
 * These determine when a payment is considered "confirmed" and settled.
 * Too few confirmations = double-spend risk (merchant loses funds).
 * Too many confirmations = slow customer experience.
 */

import { 
  CONFIRMATION_REQUIREMENTS, 
  ESTIMATED_CONFIRMATION_TIMES 
} from '../services/pendingPaymentService';

describe('Confirmation Requirements', () => {

  describe('CONFIRMATION_REQUIREMENTS', () => {
    it('BTC requires 1 confirmation', () => {
      expect(CONFIRMATION_REQUIREMENTS['BTC']).toBe(1);
    });

    it('ETH requires 12 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['ETH']).toBe(12);
    });

    it('LTC requires 6 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['LTC']).toBe(6);
    });

    it('DOGE requires 6 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['DOGE']).toBe(6);
    });

    it('BCH requires 6 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['BCH']).toBe(6);
    });

    it('TRX requires 19 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['TRX']).toBe(19);
    });

    it('USDT-TRC20 requires 19 confirmations (same as TRX)', () => {
      expect(CONFIRMATION_REQUIREMENTS['USDT-TRC20']).toBe(19);
    });

    it('USDT-ERC20 requires 12 confirmations (same as ETH)', () => {
      expect(CONFIRMATION_REQUIREMENTS['USDT-ERC20']).toBe(12);
    });

    it('all confirmation counts are positive integers', () => {
      Object.entries(CONFIRMATION_REQUIREMENTS).forEach(([chain, count]) => {
        expect(count).toBeGreaterThan(0);
        expect(Number.isInteger(count)).toBe(true);
      });
    });
  });

  describe('ESTIMATED_CONFIRMATION_TIMES', () => {
    it('all chains with requirements have estimated times', () => {
      Object.keys(CONFIRMATION_REQUIREMENTS).forEach(chain => {
        expect(ESTIMATED_CONFIRMATION_TIMES[chain]).toBeDefined();
        expect(typeof ESTIMATED_CONFIRMATION_TIMES[chain]).toBe('string');
        expect(ESTIMATED_CONFIRMATION_TIMES[chain].length).toBeGreaterThan(0);
      });
    });

    it('time strings contain "minutes" unit', () => {
      Object.values(ESTIMATED_CONFIRMATION_TIMES).forEach(time => {
        expect(time.toLowerCase()).toContain('minutes');
      });
    });
  });
});
