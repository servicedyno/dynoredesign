/**
 * Unit Tests: Webhook Processor (Phase 2)
 *
 * Tests processWebhookJob — the core pipeline that handles incoming
 * blockchain transaction webhooks from Tatum. This is the most critical
 * piece of business logic: if it fails, payments are lost or double-processed.
 *
 * Pipeline stages tested:
 *   1. Duplicate detection (processed-tx Redis key)
 *   2. Atomic lock acquisition
 *   3. Internal wallet filter (admin/fee wallets)
 *   4. Address resolution (BCH normalization, XRP destination tags, fallbacks)
 *   5. Amount validation
 *   6. Status checks (already-successful payments)
 *   7. Crash recovery for stale "processing" payments
 *   8. New transaction handling (first tx + completion payments)
 *   9. Underpayment logic (payment link wait vs direct API immediate)
 *  10. CryptoVerification with exponential backoff retries
 *  11. Lock release guarantee
 */

// ── Mock Setup (must be before imports) ─────────────────────────────────────

// Mock webhookQueue to prevent BullMQ from connecting to Redis at import time
jest.mock('../services/webhookQueue', () => ({}));

// Mock loggers
jest.mock('../utils/loggers', () => ({
  webhookLogs: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  apiLogger: { info: jest.fn(), error: jest.fn() },
}));

// Mock paymentController
jest.mock('../controller', () => ({
  paymentController: {
    cryptoVerification: jest.fn().mockResolvedValue({}),
  },
}));

// Mock pendingPaymentService
jest.mock('../services/pendingPaymentService', () => ({
  sendPendingPaymentNotification: jest.fn().mockResolvedValue(undefined),
}));

// Mock tatumApi
jest.mock('../apis/tatumApi', () => ({
  default: {
    getXrpDestinationTag: jest.fn().mockResolvedValue(null),
  },
  __esModule: true,
}));

// Mock callMerchantWebhook
jest.mock('../webhooks', () => ({
  callMerchantWebhook: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock merchantPoolConfig with deterministic values
jest.mock('../services/merchantPool/merchantPoolConfig', () => ({
  ADMIN_WALLETS: { BTC: '0xAdminBTC', ETH: '0xAdminETH' },
  FEE_WALLETS: { TRX: '0xFeeTRX', ETH: '0xFeeETH' },
  isTagBasedChain: jest.fn(() => false),
  getCryptoRedisKey: jest.fn(
    (addr: string, tag?: number | null) =>
      tag != null ? `crypto-${addr}-tag-${tag}` : `crypto-${addr}`
  ),
  XRP_MASTER_ADDRESS: 'rMasterXRP123',
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import { processWebhookJob } from '../services/webhookProcessor';
import {
  getRedisItem,
  setRedisItem,
  setRedisTTL,
  acquireLock,
  releaseLock,
  __clearMockStore,
  __setMockData,
} from '../utils/redisInstance';
import { paymentController } from '../controller';
import tatumApi from '../apis/tatumApi';
import { callMerchantWebhook } from '../webhooks';
import { sendPendingPaymentNotification } from '../services/pendingPaymentService';
import { companyModel } from '../models';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface JobDataOverrides {
  address?: string;
  counterAddress?: string;
  amount?: string | number;
  txId?: string;
  asset?: string;
  company_id?: number;
  user_id?: number;
  source?: 'webhook' | 'reconciliation';
}

function createJobData(overrides: JobDataOverrides = {}) {
  return {
    payload: {
      address: overrides.address ?? '0xTestAddress',
      counterAddress: overrides.counterAddress ?? '0xCounterAddress',
      amount: overrides.amount ?? '100',
      txId: overrides.txId ?? 'tx-test-123',
      asset: overrides.asset ?? 'ETH',
    },
    queryParams: {
      company_id: overrides.company_id ?? 1,
      user_id: overrides.user_id ?? 1,
    },
    receivedAt: new Date().toISOString(),
    source: overrides.source ?? ('webhook' as const),
  };
}

/** Standard Redis data that simulates a pending payment waiting for a webhook */
function createRedisPaymentData(overrides: Record<string, unknown> = {}) {
  return {
    amount: '100',
    currency: 'ETH',
    payment_id: 'pay-001',
    company_id: 1,
    user_id: 1,
    ref: 'ref-001',
    status: 'pending',
    ...overrides,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Webhook Processor — processWebhookJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearMockStore();
    // Restore defaults
    (acquireLock as jest.Mock).mockResolvedValue(true);
    (paymentController.cryptoVerification as jest.Mock).mockResolvedValue({});
    (callMerchantWebhook as jest.Mock).mockResolvedValue({ success: true });
    (sendPendingPaymentNotification as jest.Mock).mockResolvedValue(undefined);
    (tatumApi.getXrpDestinationTag as jest.Mock).mockResolvedValue(null);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 1: Duplicate Detection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 1 — Duplicate Detection', () => {
    it('skips already-processed transactions', async () => {
      __setMockData('processed-tx-tx-test-123', { processed: true, timestamp: new Date().toISOString() });

      await processWebhookJob(createJobData());

      // Should NOT acquire lock since it bailed early
      expect(acquireLock).not.toHaveBeenCalled();
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('processes new transactions not yet in Redis', async () => {
      // No processed-tx key set → should attempt to acquire lock
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(acquireLock).toHaveBeenCalled();
    });

    it('treats empty processed-tx object as not processed', async () => {
      // Edge case: key exists but has empty object (stale data)
      __setMockData('processed-tx-tx-test-123', {});
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(acquireLock).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 2: Atomic Lock
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 2 — Atomic Lock', () => {
    it('skips if lock cannot be acquired (another worker processing)', async () => {
      (acquireLock as jest.Mock).mockResolvedValue(false);
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
      // Lock was never acquired so should NOT be released
      expect(releaseLock).not.toHaveBeenCalled();
    });

    it('always releases lock in finally block after processing', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(releaseLock).toHaveBeenCalledWith('tatum-webhook-tx-test-123');
    });

    it('releases lock even when an error occurs', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());
      (paymentController.cryptoVerification as jest.Mock).mockRejectedValue(new Error('invalid address'));

      await expect(processWebhookJob(createJobData())).rejects.toThrow();

      expect(releaseLock).toHaveBeenCalledWith('tatum-webhook-tx-test-123');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 3: Internal Wallet Filter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 3 — Internal Wallet Filter', () => {
    it('ignores transfers FROM admin wallets (case-insensitive)', async () => {
      const data = createJobData({ counterAddress: '0xadminbtc' }); // lowercase match

      await processWebhookJob(data);

      // Should mark as internal transfer
      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-test-123',
        expect.objectContaining({ processed: true, type: 'internal_sweep' })
      );
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores transfers FROM fee wallets', async () => {
      const data = createJobData({ counterAddress: '0xfeetrx' });

      await processWebhookJob(data);

      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-test-123',
        expect.objectContaining({ type: 'internal_sweep' })
      );
    });

    it('processes transfers from external wallets', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());
      const data = createJobData({ counterAddress: '0xExternalCustomer' });

      await processWebhookJob(data);

      // Should proceed to processing
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('handles empty counterAddress gracefully', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());
      const data = createJobData({ counterAddress: '' });

      await processWebhookJob(data);

      // Empty string is not in INTERNAL_WALLETS, should proceed
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 4: Address Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 4 — Address Resolution', () => {
    it('resolves payment data from primary address', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('normalizes BCH address with cashaddr prefix', async () => {
      // Primary address has no data, but prefixed version does
      __setMockData('crypto-bitcoincash:0xBCHAddr', createRedisPaymentData({ currency: 'BCH' }));
      const data = createJobData({ address: '0xBCHAddr', asset: 'BCH' });

      await processWebhookJob(data);

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('falls back to counterAddress when primary has no data', async () => {
      // No data for primary address, but counterAddress has data
      __setMockData('crypto-0xCounterAddress', createRedisPaymentData());
      const data = createJobData();

      await processWebhookJob(data);

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('resolves XRP master address via destination tag', async () => {
      // XRP master address scenario
      (tatumApi.getXrpDestinationTag as jest.Mock).mockResolvedValue(12345);
      const { getCryptoRedisKey } = require('../services/merchantPool/merchantPoolConfig');
      (getCryptoRedisKey as jest.Mock).mockReturnValue('crypto-rMasterXRP123-tag-12345');
      __setMockData('crypto-rMasterXRP123-tag-12345', createRedisPaymentData({ currency: 'XRP' }));

      const data = createJobData({ address: 'rMasterXRP123', asset: 'XRP' });
      await processWebhookJob(data);

      expect(tatumApi.getXrpDestinationTag).toHaveBeenCalledWith('tx-test-123');
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('handles XRP master address with no destination tag (tagless)', async () => {
      (tatumApi.getXrpDestinationTag as jest.Mock).mockResolvedValue(null);
      const data = createJobData({ address: 'rMasterXRP123', asset: 'XRP' });

      await processWebhookJob(data);

      // No tag → no Redis data → should not call cryptoVerification
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores webhook when no Redis data found for any address', async () => {
      // No data anywhere
      const data = createJobData();

      await processWebhookJob(data);

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 5: Amount Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 5 — Amount Validation', () => {
    it('ignores zero-amount transactions', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ amount: '0' }));

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores negative-amount transactions', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ amount: '-50' }));

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores NaN amounts', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ amount: 'notanumber' }));

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('processes valid positive amounts', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ amount: '0.0001' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 6: Status Checks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 6 — Already Successful Payments', () => {
    const successStatuses = ['successful', 'completed', 'recovered'];

    successStatuses.forEach((status) => {
      it(`ignores payment with status "${status}"`, async () => {
        __setMockData('crypto-0xTestAddress', createRedisPaymentData({ status }));

        await processWebhookJob(createJobData());

        expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
      });
    });

    it('processes payment with status "pending"', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ status: 'pending' }));

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('processes payment with status "underpaid"', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        status: 'underpaid',
        incomplete: 'true',
        txId: 'tx-previous-456',
        previousAmount: '50',
        originalExpectedAmount: '100',
      }));

      await processWebhookJob(createJobData({ amount: '50' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 7: Crash Recovery
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 7 — Crash Recovery', () => {
    it('recovers stale "processing" payments older than 60s', async () => {
      const staleTime = new Date(Date.now() - 120000).toISOString(); // 2 min ago
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        status: 'processing',
        txId: 'tx-old-789',
        lastAttempt: staleTime,
      }));

      await processWebhookJob(createJobData());

      // Should call cryptoVerification for recovery
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      // Should mark as successful after recovery
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful' })
      );
    });

    it('does NOT trigger recovery for "processing" payments < 60s old', async () => {
      const recentTime = new Date(Date.now() - 30000).toISOString(); // 30s ago
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        status: 'processing',
        txId: 'tx-recent-789',
        lastAttempt: recentTime,
      }));

      await processWebhookJob(createJobData());

      // Not stale, and txId already exists (not first tx, not completion) → should be ignored
      // Because isFirstTransaction = false (items.txId exists) and isCompletionPayment = false
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('handles crash recovery failure with direct webhook fallback', async () => {
      const staleTime = new Date(Date.now() - 120000).toISOString();
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        status: 'processing',
        txId: 'tx-old-789',
        lastAttempt: staleTime,
        ref: 'ref-001',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1, webhook_url: 'https://merchant.com/hook' });

      // cryptoVerification fails
      (paymentController.cryptoVerification as jest.Mock).mockResolvedValue({ status: 500, message: 'Settlement failed' });

      await processWebhookJob(createJobData());

      // Should attempt direct webhook delivery as fallback
      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'payment.confirmed', recovered: true })
      );
      // Should mark as "recovered"
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'recovered' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 8: New Transaction Processing
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 8 — New Transaction (First Tx)', () => {
    it('processes first transaction and marks as successful', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ amount: '100' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful', txId: 'tx-test-123' })
      );
    });

    it('sends pending notification for first transaction', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData());

      expect(sendPendingPaymentNotification).toHaveBeenCalled();
    });

    it('sends payment.pending merchant webhook', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData());

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'payment.pending', status: 'pending' })
      );
    });

    it('ignores duplicate transactions (txId already matches)', async () => {
      // txId exists and matches the incoming tx → duplicate
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: 'tx-test-123' }));

      await processWebhookJob(createJobData());

      // Should not process (not first tx, not completion, not stale)
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('marks processed-tx after successful verification', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData());

      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-test-123',
        expect.objectContaining({ address: '0xTestAddress' })
      );
    });

    it('sets TTL on processed-tx key (48h)', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData());

      expect(setRedisTTL).toHaveBeenCalledWith('processed-tx-tx-test-123', 172800);
    });

    it('updates customer ref data on success', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined, ref: 'ref-customer-1' }));
      __setMockData('ref-customer-1', { adm_id: 1, company_id: 1, status: 'pending' });

      await processWebhookJob(createJobData());

      // Customer ref should also be updated
      expect(setRedisItem).toHaveBeenCalledWith(
        'ref-customer-1',
        expect.objectContaining({ status: 'successful', txId: 'tx-test-123' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 8b: Completion Payments
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 8b — Completion Payment (partial payment follow-up)', () => {
    it('processes completion payment with combined amount', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        status: 'underpaid',
        incomplete: 'true',
        txId: 'tx-first-part',
        previousAmount: '60',
        originalExpectedAmount: '100',
        amount: '40', // remaining expected
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ txId: 'tx-second-part', amount: '40' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful', txId: 'tx-second-part' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 9: Underpayment Logic
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 9 — Underpayment: Payment Link', () => {
    it('marks underpaid payment link and waits for remaining', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        link_id: 'link-001',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      // Send 70 out of 100 expected
      await processWebhookJob(createJobData({ amount: '70' }));

      // Should mark as underpaid and NOT call cryptoVerification
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({
          status: 'underpaid',
          incomplete: 'true',
          receivedAmount: 70,
          amount: 30, // remaining
        })
      );
      // CryptoVerification should NOT be called (waiting for remaining)
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('sends underpaid webhook to merchant for payment link', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        link_id: 'link-001',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event: 'payment.underpaid',
          payment_type: 'payment_link',
          amount_received: 70,
          amount_expected: 100,
          amount_remaining: 30,
        })
      );
    });

    it('sets grace period TTL on underpaid payment', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        link_id: 'link-001',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      await processWebhookJob(createJobData({ amount: '70' }));

      // Default grace period is 30 min = 1800 seconds
      expect(setRedisTTL).toHaveBeenCalledWith('crypto-0xTestAddress', 1800);
    });
  });

  describe('Stage 9 — Underpayment: Direct API', () => {
    it('processes underpaid direct API payment immediately', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        // No link_id → direct API
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      // Send 70 out of 100 expected
      await processWebhookJob(createJobData({ amount: '70' }));

      // Direct API: should process immediately (not wait)
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('sends underpaid webhook for direct API with correct type', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event: 'payment.underpaid',
          payment_type: 'direct_api',
        })
      );
    });
  });

  describe('Stage 9 — Minor Underpayment (within threshold)', () => {
    it('accepts minor underpayment within $1 threshold for payment links', async () => {
      // Payment of $99.50 for $100 expected (shortfall ~$0.50 < $1 threshold)
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',      // expected crypto
        base_amount: '100',  // $100 USD equivalent
        link_id: 'link-001',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      // Mock company with default threshold
      (companyModel.findOne as jest.Mock).mockResolvedValue(null);

      // Send 99.5 out of 100 expected (0.5% short → $0.50 in USD)
      await processWebhookJob(createJobData({ amount: '99.5' }));

      // Should accept and process (not wait for remaining)
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 10: Overpayment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 10 — Overpayment', () => {
    it('processes overpayment normally (no special handling needed)', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      // Send 150 when only 100 was expected → overpayment
      await processWebhookJob(createJobData({ amount: '150' }));

      // Should process normally with the actual received amount
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful', receivedAmount: 150 })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 11: CryptoVerification & Retries
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 11 — CryptoVerification', () => {
    it('succeeds on first attempt', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable error and succeeds', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      (paymentController.cryptoVerification as jest.Mock)
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({});

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(2);
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful' })
      );
    }, 15000);

    it('does NOT retry on non-retryable errors (e.g., invalid address)', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      (paymentController.cryptoVerification as jest.Mock)
        .mockRejectedValue(new Error('invalid address'));

      await expect(processWebhookJob(createJobData())).rejects.toThrow('invalid address');

      // Should only be called once (no retries for non-retryable)
      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(1);
    });

    it('marks payment as failed after all retries exhausted', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      (paymentController.cryptoVerification as jest.Mock)
        .mockRejectedValue(new Error('server error'));

      await expect(processWebhookJob(createJobData())).rejects.toThrow('server error');

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(3); // maxRetries = 3
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'failed' })
      );
    }, 30000);

    it('records failed payment in Redis', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      (paymentController.cryptoVerification as jest.Mock)
        .mockRejectedValue(new Error('server error'));

      await expect(processWebhookJob(createJobData())).rejects.toThrow();

      expect(setRedisItem).toHaveBeenCalledWith(
        'failed-payment-tx-test-123',
        expect.objectContaining({
          address: '0xTestAddress',
          txId: 'tx-test-123',
          error: 'server error',
        })
      );
    }, 30000);

    it('handles cryptoVerification returning error status (non-exception)', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      __setMockData('ref-001', { adm_id: 1, company_id: 1 });

      (paymentController.cryptoVerification as jest.Mock)
        .mockResolvedValue({ status: 500, message: 'Internal error' });

      await expect(processWebhookJob(createJobData())).rejects.toThrow('cryptoVerification error 500');
    }, 30000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 12: Query Param Enrichment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 12 — Query Param Enrichment', () => {
    it('enriches Redis items with company_id from query params', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        company_id: undefined, // No company_id in Redis
      }));
      __setMockData('ref-001', { adm_id: 1 });

      await processWebhookJob(createJobData({ company_id: 42 }));

      // The items object should be enriched with company_id from query params
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('does NOT override existing company_id from Redis', async () => {
      __setMockData('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        company_id: 99, // Already has company_id
      }));
      __setMockData('ref-001', { adm_id: 1, company_id: 99 });

      await processWebhookJob(createJobData({ company_id: 42 }));

      // Should preserve the original company_id (99), not override with 42
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration: Full Pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full Pipeline — Happy Path', () => {
    it('processes a standard ETH payment end-to-end', async () => {
      // Setup: pending payment in Redis
      __setMockData('crypto-0xPaymentAddr', createRedisPaymentData({
        txId: undefined,
        amount: '0.05',
        currency: 'ETH',
        payment_id: 'pay-full-001',
        ref: 'ref-full-001',
      }));
      __setMockData('ref-full-001', {
        adm_id: 1,
        company_id: 1,
        customer_name: 'Alice',
        email: 'alice@example.com',
      });

      const data = createJobData({
        address: '0xPaymentAddr',
        counterAddress: '0xCustomerWallet',
        amount: '0.05',
        txId: 'tx-eth-001',
        asset: 'ETH',
        company_id: 1,
      });

      await processWebhookJob(data);

      // 1. Lock was acquired
      expect(acquireLock).toHaveBeenCalledWith('tatum-webhook-tx-eth-001', 300, 1, 50);
      // 2. Pending notification was sent
      expect(sendPendingPaymentNotification).toHaveBeenCalled();
      // 3. Pending webhook was sent to merchant
      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'payment.pending' })
      );
      // 4. CryptoVerification was called
      expect(paymentController.cryptoVerification).toHaveBeenCalledWith('0xPaymentAddr', true, 'crypto-0xPaymentAddr');
      // 5. Payment marked successful
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xPaymentAddr',
        expect.objectContaining({ status: 'successful' })
      );
      // 6. Processed-tx key set
      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-eth-001',
        expect.objectContaining({ address: '0xPaymentAddr', payment_id: 'pay-full-001' })
      );
      // 7. Lock was released
      expect(releaseLock).toHaveBeenCalledWith('tatum-webhook-tx-eth-001');
    });
  });
});
