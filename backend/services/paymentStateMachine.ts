/**
 * Payment State Machine
 *
 * Formalizes the payment lifecycle into a strict state machine with validated
 * transitions. Every status change in the system MUST go through this service
 * to ensure consistency and auditability.
 *
 * States:
 *   PENDING          – Payment created, awaiting blockchain transaction
 *   DETECTED         – Transaction seen on-chain (unconfirmed)
 *   CONFIRMING       – Blockchain confirmations in progress
 *   CONFIRMED        – Required confirmations reached
 *   UNDERPAID        – Partial payment received, waiting for remainder
 *   PROCESSING       – Settlement / forwarding in progress
 *   CONVERTED        – Auto-converted to stablecoin (optional path)
 *   PAYOUT_COMPLETE  – Funds delivered to merchant wallet
 *   FAILED           – Permanent failure after all retries
 *   EXPIRED          – Payment timed out or grace period lapsed
 *   REFUNDED         – Payment refunded to sender
 */

import { webhookLogs } from "../utils/loggers";

// ── State Enum ───────────────────────────────────────────────────────────────

export enum PaymentState {
  PENDING         = "pending",
  DETECTED        = "detected",
  CONFIRMING      = "confirming",
  CONFIRMED       = "confirmed",
  UNDERPAID       = "underpaid",
  PROCESSING      = "processing",
  CONVERTED       = "converted",
  PAYOUT_COMPLETE = "payout_complete",
  FAILED          = "failed",
  EXPIRED         = "expired",
  REFUNDED        = "refunded",
}

// ── Transition Map ───────────────────────────────────────────────────────────
// Key = current state, Value = set of states it can transition TO

const VALID_TRANSITIONS: Record<PaymentState, Set<PaymentState>> = {
  [PaymentState.PENDING]: new Set([
    PaymentState.DETECTED,
    PaymentState.EXPIRED,
    PaymentState.FAILED,
  ]),
  [PaymentState.DETECTED]: new Set([
    PaymentState.CONFIRMING,
    PaymentState.CONFIRMED,
    PaymentState.PROCESSING,  // fast-confirm chains skip CONFIRMING
    PaymentState.UNDERPAID,
    PaymentState.FAILED,
  ]),
  [PaymentState.CONFIRMING]: new Set([
    PaymentState.CONFIRMED,
    PaymentState.FAILED,
  ]),
  [PaymentState.CONFIRMED]: new Set([
    PaymentState.PROCESSING,
    PaymentState.CONVERTED,
    PaymentState.FAILED,
  ]),
  [PaymentState.UNDERPAID]: new Set([
    PaymentState.DETECTED,   // completion payment arrives
    PaymentState.PROCESSING, // direct-API: process with partial amount
    PaymentState.EXPIRED,    // grace period lapsed
    PaymentState.FAILED,
  ]),
  [PaymentState.PROCESSING]: new Set([
    PaymentState.PAYOUT_COMPLETE,
    PaymentState.CONVERTED,
    PaymentState.FAILED,
  ]),
  [PaymentState.CONVERTED]: new Set([
    PaymentState.PAYOUT_COMPLETE,
    PaymentState.FAILED,
  ]),
  // Terminal states — no outgoing transitions (except refund from payout_complete)
  [PaymentState.PAYOUT_COMPLETE]: new Set([
    PaymentState.REFUNDED,
  ]),
  [PaymentState.FAILED]:   new Set(),
  [PaymentState.EXPIRED]:  new Set(),
  [PaymentState.REFUNDED]: new Set(),
};

// ── Terminal helpers ─────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set<PaymentState>([
  PaymentState.PAYOUT_COMPLETE,
  PaymentState.FAILED,
  PaymentState.EXPIRED,
  PaymentState.REFUNDED,
]);

// ── Transition record ────────────────────────────────────────────────────────

export interface TransitionRecord {
  from: PaymentState;
  to: PaymentState;
  timestamp: string;       // ISO-8601
  paymentId: string;       // unique identifier for this payment
  reason?: string;         // human-readable reason
  metadata?: Record<string, unknown>;
}

// ── Error class ──────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  public readonly from: PaymentState;
  public readonly to: PaymentState;
  public readonly paymentId: string;

  constructor(from: PaymentState, to: PaymentState, paymentId: string) {
    super(
      `Invalid state transition: ${from} → ${to} for payment ${paymentId}. ` +
      `Allowed transitions from '${from}': [${[...(VALID_TRANSITIONS[from] || [])].join(", ")}]`
    );
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
    this.paymentId = paymentId;
  }
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Validate whether a transition from `currentState` to `nextState` is allowed.
 * Returns true if valid, false otherwise.
 */
export function canTransition(currentState: PaymentState, nextState: PaymentState): boolean {
  const allowed = VALID_TRANSITIONS[currentState];
  if (!allowed) return false;
  return allowed.has(nextState);
}

/**
 * Attempt a state transition. Throws `InvalidTransitionError` if the
 * transition is not allowed by the state machine.
 *
 * Returns a `TransitionRecord` for audit logging.
 */
export function transition(
  currentState: PaymentState,
  nextState: PaymentState,
  paymentId: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): TransitionRecord {
  if (!canTransition(currentState, nextState)) {
    throw new InvalidTransitionError(currentState, nextState, paymentId);
  }

  const record: TransitionRecord = {
    from: currentState,
    to: nextState,
    timestamp: new Date().toISOString(),
    paymentId,
    reason,
    metadata,
  };

  webhookLogs.info(
    `[StateMachine] ${paymentId}: ${currentState} → ${nextState}` +
    (reason ? ` (${reason})` : "")
  );

  return record;
}

/**
 * Returns all states reachable from the given state.
 */
export function getAllowedTransitions(state: PaymentState): PaymentState[] {
  const allowed = VALID_TRANSITIONS[state];
  return allowed ? [...allowed] : [];
}

/**
 * Returns true if the state is terminal (no outgoing transitions, or only
 * refund from payout_complete).
 */
export function isTerminal(state: PaymentState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Parse a raw status string (from Redis or DB) into a PaymentState enum value.
 * Returns undefined if the string is not a recognized state.
 */
export function parseState(raw: string | undefined | null): PaymentState | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().trim();

  // Direct match
  const values = Object.values(PaymentState) as string[];
  if (values.includes(normalized)) {
    return normalized as PaymentState;
  }

  // Legacy aliases (map old ad-hoc statuses to formal states)
  const LEGACY_MAP: Record<string, PaymentState> = {
    successful:       PaymentState.PAYOUT_COMPLETE,
    completed:        PaymentState.PAYOUT_COMPLETE,
    recovered:        PaymentState.PAYOUT_COMPLETE,
    done:             PaymentState.PAYOUT_COMPLETE,
    retrying:         PaymentState.PROCESSING,
    pending_deposit:  PaymentState.PENDING,
    paid:             PaymentState.DETECTED,
    incomplete:       PaymentState.UNDERPAID,
  };

  return LEGACY_MAP[normalized];
}

/**
 * Get the full transition map (for diagnostics / admin endpoints).
 */
export function getTransitionMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [state, targets] of Object.entries(VALID_TRANSITIONS)) {
    map[state] = [...targets];
  }
  return map;
}

/**
 * All defined payment states.
 */
export const ALL_STATES = Object.values(PaymentState);
