# Comprehensive Edge Case Analysis - Merchant Pool System

## Analysis Date: 2026-01-28
## Status: DETAILED REVIEW IN PROGRESS

---

## 1. PAYMENT RECEPTION EDGE CASES

### Edge Case 1.1: Double Payment (Same Transaction ID)
**Scenario**: Webhook fires twice for same transaction
**Current Handling**: ?
**Risk Level**: HIGH
**Analysis Needed**: Check for duplicate transaction ID handling

### Edge Case 1.2: Payment Arrives After Reservation Expired
**Scenario**: 
- Address reserved at 12:00 PM (30 min timeout)
- Payment arrives at 12:35 PM (after expiry)
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 1.3: Overpayment
**Scenario**: Expected 0.001 BTC, received 0.0015 BTC
**Current Handling**: ?
**Options**:
- Accept extra as bonus
- Refund difference
- Send extra to admin
**Risk Level**: LOW

### Edge Case 1.4: Underpayment (Not Partial)
**Scenario**: Expected 0.001 BTC, received 0.0005 BTC (50%, marked complete)
**Current Handling**: Treated as partial?
**Risk Level**: MEDIUM

### Edge Case 1.5: Payment in Wrong Currency
**Scenario**: Expected BTC address receives LTC
**Current Handling**: ?
**Risk Level**: LOW (blockchain prevents this)

### Edge Case 1.6: Dust Payment (Below Sweep Threshold)
**Scenario**: Multiple tiny payments accumulate (each < $1)
**Current Handling**: ?
**Risk Level**: MEDIUM

---

## 2. PARTIAL PAYMENT EDGE CASES

### Edge Case 2.1: Multiple Small Partials
**Scenario**: 
- Expected: 0.001 BTC
- Payment 1: 0.0001 BTC (10%)
- Payment 2: 0.0001 BTC (20% total)
- Payment 3: 0.0001 BTC (30% total)
- ... (10 small partials)
**Current Handling**: Each extends grace period
**Risk Level**: LOW
**Concern**: Indefinite extension if partials keep coming?

### Edge Case 2.2: Partial Exceeds Expected
**Scenario**:
- Expected: 0.001 BTC
- Payment 1: 0.0005 BTC (50%)
- Payment 2: 0.001 BTC (total: 0.0015 BTC, 150%)
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 2.3: Grace Period Expired During Processing
**Scenario**:
- Partial payment at 12:00 PM
- Grace until 12:30 PM
- Final payment arrives at 12:29 PM
- Processing takes 3 minutes
- Complete at 12:32 PM (after grace expiry)
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 2.4: Partial Payment Race Condition
**Scenario**: Two partials arrive simultaneously
**Current Handling**: Database transaction handling?
**Risk Level**: HIGH

---

## 3. SWEEP OPERATION EDGE CASES

### Edge Case 3.1: Sweep During Active Payment
**Scenario**:
- Address status: PROCESSING
- Admin fee balance: $35 (above threshold)
- Sweep cron runs
**Current Handling**: Status check should prevent?
**Risk Level**: CRITICAL

### Edge Case 3.2: Sweep Fails (Network Error)
**Scenario**: Sweep transaction fails midway
**Current Handling**: ?
**Recovery**: Retry? Manual intervention?
**Risk Level**: HIGH

### Edge Case 3.3: Sweep Succeeds But Not Recorded
**Scenario**: 
- Sweep transaction completes on blockchain
- Database update fails
- admin_fee_balance not reset
**Current Handling**: ?
**Risk Level**: CRITICAL (double sweep!)

### Edge Case 3.4: Multiple Sweeps Trigger Simultaneously
**Scenario**: 
- Address meets both time and threshold criteria
- Both sweep functions try to sweep same address
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 3.5: Sweep Amount Less Than Gas Fee
**Scenario**: 
- Admin fee: 0.00001 ETH (~$0.30)
- Gas fee: 0.0005 ETH (~$1.50)
- Sweep costs more than it collects
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 3.6: Gas Funding Fails During Sweep
**Scenario**:
- Time to sweep USDT-TRC20
- TRX_FEE_WALLET is empty
- Can't fund gas
**Current Handling**: ?
**Recovery**: Alert? Retry?
**Risk Level**: HIGH

### Edge Case 3.7: Sweep to Wrong Admin Wallet
**Scenario**: Configuration error - wrong admin address
**Current Handling**: No validation?
**Risk Level**: CRITICAL

---

## 4. UTXO BATCH TRANSFER EDGE CASES

### Edge Case 4.1: Batch Transfer with Insufficient Funds
**Scenario**:
- Received: 0.001 BTC
- Merchant: 0.00098 BTC
- Admin: 0.00002 BTC
- Fee: 0.00002 BTC
- Total needed: 0.001 + 0.00002 = 0.00102 BTC (more than available!)
**Current Handling**: ?
**Risk Level**: CRITICAL

### Edge Case 4.2: UTXO Input Already Spent
**Scenario**: Using UTXO that was already spent in another transaction
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 4.3: Fee Estimation Changes
**Scenario**:
- Estimate fee: 0.00001 BTC
- Create transaction
- Network congested, actual fee: 0.00003 BTC
- Transaction stuck or fails
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 4.4: Below Threshold on UTXO (Can't Batch)
**Scenario**: 
- Payment: 0.00002 BTC (~$2, below threshold)
- 100% to admin
- No merchant payment to batch with
- Admin fee must accumulate
**Current Handling**: Should accumulate
**Risk Level**: LOW (edge case of batch rule)

### Edge Case 4.5: Multiple Payments Same Block
**Scenario**: Two payments to same UTXO address in same block
**Current Handling**: ?
**Risk Level**: MEDIUM

---

## 5. TOKEN PAYMENT EDGE CASES

### Edge Case 5.1: Gas Funded But Token Transfer Fails
**Scenario**:
- Fund 30 TRX for gas
- USDT transfer fails
- 30 TRX stuck in temp address
**Current Handling**: ?
**Recovery**: ?
**Risk Level**: HIGH

### Edge Case 5.2: Insufficient Token Balance (Partial Received)
**Scenario**:
- Expected: 100 USDT
- Temp address has: 60 USDT
- Try to send merchant: 98 USDT (after fees)
- Insufficient balance!
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 5.3: Token Contract Paused/Frozen
**Scenario**: USDT contract frozen by issuer
**Current Handling**: Transaction will fail
**Recovery**: ?
**Risk Level**: LOW (rare)

### Edge Case 5.4: Gas Price Spike During Token Transfer
**Scenario**:
- Estimated gas: 30 TRX
- Funded: 30 TRX
- Network spike, actual: 50 TRX
- Insufficient gas!
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 5.5: Double Gas Funding
**Scenario**:
- Gas funding in progress
- Webhook fires again
- Attempts to fund gas twice
**Current Handling**: ?
**Risk Level**: MEDIUM

---

## 6. CONCURRENCY & RACE CONDITION EDGE CASES

### Edge Case 6.1: Address Reserved Twice
**Scenario**: Two payment links request address simultaneously
**Current Handling**: Database transaction?
**Risk Level**: CRITICAL

### Edge Case 6.2: Release and Reserve Race
**Scenario**:
- Thread A: Releasing address (status → AVAILABLE)
- Thread B: Reserving address (query for AVAILABLE)
- Both execute simultaneously
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 6.3: Sweep and Payment Race
**Scenario**:
- Cron: Sweeping address (reading admin_fee_balance)
- Payment: Updating address (adding to admin_fee_balance)
- Read-modify-write conflict
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 6.4: Multiple Cron Jobs Running
**Scenario**: Cron job doesn't finish before next one starts
**Current Handling**: ?
**Risk Level**: MEDIUM

---

## 7. CONFIGURATION & VALIDATION EDGE CASES

### Edge Case 7.1: Invalid Sweep Configuration
**Scenario**: `USDT_TRC20_SWEEP=invalid:abc`
**Current Handling**: Fallback to default?
**Risk Level**: LOW

### Edge Case 7.2: Token with Time Mode (Invalid)
**Scenario**: `USDT_TRC20_SWEEP=time:10` (should be threshold only)
**Current Handling**: Validation and fallback
**Risk Level**: LOW

### Edge Case 7.3: Negative or Zero Threshold
**Scenario**: `ETH_SWEEP=threshold:0` or `threshold:-10`
**Current Handling**: ?
**Risk Level**: LOW

### Edge Case 7.4: Missing Admin Wallet Address
**Scenario**: Admin wallet for chain not configured in .env
**Current Handling**: ?
**Risk Level**: CRITICAL

### Edge Case 7.5: Invalid Private Key Encryption
**Scenario**: Can't decrypt private key from database
**Current Handling**: ?
**Risk Level**: CRITICAL

---

## 8. NETWORK & API FAILURE EDGE CASES

### Edge Case 8.1: Currency Conversion API Down
**Scenario**: Can't convert crypto to USD for threshold check
**Current Handling**: ?
**Fallback**: Skip sweep? Use cached rate?
**Risk Level**: HIGH

### Edge Case 8.2: Tatum API Rate Limit
**Scenario**: Too many requests, API throttles
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 8.3: Blockchain Node Unavailable
**Scenario**: Can't broadcast transaction
**Current Handling**: ?
**Retry**: How many times?
**Risk Level**: HIGH

### Edge Case 8.4: Webhook Delivery Failure
**Scenario**: Blockchain transaction confirmed but webhook never arrives
**Current Handling**: Manual checking?
**Risk Level**: HIGH

### Edge Case 8.5: Database Connection Lost
**Scenario**: Mid-transaction database disconnect
**Current Handling**: Transaction rollback?
**Risk Level**: CRITICAL

---

## 9. TIME & TIMESTAMP EDGE CASES

### Edge Case 9.1: Server Clock Drift
**Scenario**: Server time is off by 10 minutes
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 9.2: Timezone Issues
**Scenario**: Timestamps in different timezones
**Current Handling**: Using UTC?
**Risk Level**: LOW

### Edge Case 9.3: Daylight Saving Time
**Scenario**: Time jumps forward/backward
**Current Handling**: ?
**Risk Level**: LOW

### Edge Case 9.4: Time-Based Sweep Exactly at Threshold
**Scenario**: Last payout at 12:00:00.000, check at 12:10:00.000
**Current Handling**: >= or > comparison?
**Risk Level**: LOW

---

## 10. AMOUNT & CALCULATION EDGE CASES

### Edge Case 10.1: Floating Point Precision Error
**Scenario**: 
- Calculate: 0.1 + 0.2 = 0.30000000000000004
- Comparison fails
**Current Handling**: Using Decimal type?
**Risk Level**: MEDIUM

### Edge Case 10.2: Amount Rounding Issues
**Scenario**: 
- Admin fee: 0.0000012345678 BTC (9 decimals)
- BTC supports 8 decimals
- Rounding error
**Current Handling**: ?
**Risk Level**: LOW

### Edge Case 10.3: Zero or Negative Admin Fee
**Scenario**: Calculation results in 0 or negative admin fee
**Current Handling**: ?
**Risk Level**: LOW

### Edge Case 10.4: Admin Fee Equals Total (100%)
**Scenario**: Below threshold - admin gets 100%
**Current Handling**: Working
**Risk Level**: LOW

---

## 11. BLOCKCHAIN-SPECIFIC EDGE CASES

### Edge Case 11.1: Bitcoin Mempool Congestion
**Scenario**: Transaction stuck for days
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 11.2: Ethereum Nonce Issues
**Scenario**: Two transactions with same nonce
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 11.3: Transaction Replaced (RBF)
**Scenario**: Transaction replaced with higher fee
**Current Handling**: ?
**Risk Level**: MEDIUM

### Edge Case 11.4: Chain Reorganization
**Scenario**: Confirmed transaction becomes unconfirmed
**Current Handling**: ?
**Risk Level**: LOW (rare)

### Edge Case 11.5: Hard Fork
**Scenario**: Blockchain splits into two chains
**Current Handling**: ?
**Risk Level**: LOW (rare)

---

## 12. ADDRESS MANAGEMENT EDGE CASES

### Edge Case 12.1: Address Pool Exhaustion
**Scenario**: All addresses in use, none AVAILABLE
**Current Handling**: Create new address?
**Risk Level**: MEDIUM

### Edge Case 12.2: Address Generation Fails
**Scenario**: Can't derive new address from xpub
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 12.3: Address Already Exists in Database
**Scenario**: Trying to create duplicate address
**Current Handling**: Unique constraint?
**Risk Level**: LOW

### Edge Case 12.4: Address Never Released
**Scenario**: Status stuck in PROCESSING forever
**Current Handling**: Cleanup cron (stale timeout)
**Risk Level**: MEDIUM (handled)

### Edge Case 12.5: Merchant Wallet Not Initialized
**Scenario**: Try to reserve address but no xpub exists
**Current Handling**: Lazy initialization?
**Risk Level**: LOW

---

## 13. FEE & THRESHOLD EDGE CASES

### Edge Case 13.1: Payment Exactly at Threshold
**Scenario**: Payment is exactly $3.00 (threshold)
**Current Handling**: >= or > comparison?
**Risk Level**: LOW

### Edge Case 13.2: Accumulated Fees Exactly at Sweep Threshold
**Scenario**: Admin balance exactly $30.00
**Current Handling**: >= or > comparison?
**Risk Level**: LOW

### Edge Case 13.3: Fee Calculation Exceeds Payment
**Scenario**: 
- Payment: 0.001 BTC
- Gas fee: 0.002 BTC
- Fee > Payment!
**Current Handling**: ?
**Risk Level**: HIGH

### Edge Case 13.4: Dynamic Fee Changes Mid-Transaction
**Scenario**: Fee estimate at start, but increases by completion
**Current Handling**: ?
**Risk Level**: MEDIUM

---

## ANALYSIS PRIORITY MATRIX

### CRITICAL (Must Fix Immediately):
1. ❌ **Sweep during active payment** (Edge Case 3.1)
2. ❌ **Sweep succeeds but not recorded** (Edge Case 3.3)
3. ❌ **Address reserved twice** (Edge Case 6.1)
4. ❌ **UTXO insufficient funds for batch** (Edge Case 4.1)
5. ❌ **Missing admin wallet address** (Edge Case 7.4)
6. ❌ **Invalid private key encryption** (Edge Case 7.5)

### HIGH (Fix Soon):
7. ⚠️ **Double payment webhook** (Edge Case 1.1)
8. ⚠️ **Grace period expired during processing** (Edge Case 2.3)
9. ⚠️ **Sweep fails network error** (Edge Case 3.2)
10. ⚠️ **Gas funding fails during sweep** (Edge Case 3.6)
11. ⚠️ **Currency conversion API down** (Edge Case 8.1)
12. ⚠️ **Address generation fails** (Edge Case 12.2)

### MEDIUM (Review & Handle):
13. 🔶 Many others in the list above

### LOW (Monitor):
14. 🟢 Most validation and edge cases with fallbacks

---

## NEXT STEPS

I need to analyze the actual code to determine:
1. Which edge cases are already handled
2. Which need additional handling
3. What the actual behavior is for each scenario

Let me proceed with code analysis...
