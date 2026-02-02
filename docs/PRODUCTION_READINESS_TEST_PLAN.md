# DynoPay Production Readiness Test Plan

## Test Credentials
- **Email**: nomadly@moxx.co
- **Password**: Katiekendra123@
- **Test Environment**: Development/Staging
- **Test Date**: 2025-01-25

---

## Test Execution Strategy

### Phase Approach:
1. **Authentication & Authorization** (Foundation)
2. **Core Account Setup** (Company, Wallets, API Keys)
3. **Payment Processing** (Payment Links, Transactions)
4. **Advanced Features** (Invoices, Notifications, KYC)
5. **Integration Testing** (End-to-End Flows)
6. **Performance & Security** (Load, Security, Edge Cases)

---

# PHASE 1: Authentication & Authorization ✅

## Priority: CRITICAL
**Dependencies**: None (Foundation for all other tests)

### 1.1 User Login
```bash
POST /api/user/login
Body: {
  "email": "nomadly@moxx.co",
  "password": "Katiekendra123@"
}
Expected: 200, JWT token, user_id
Store: JWT_TOKEN for subsequent requests
```

### 1.2 Get User Profile
```bash
GET /api/user/profile
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, user profile with name, email, user_id
Verify: Data matches logged-in user
```

### 1.3 Password Reset Flow
```bash
# Request reset
POST /api/user/forgot-password
Body: { "email": "nomadly@moxx.co" }
Expected: 200, success message

# Verify email sent (check logs or email service)
# Note: Don't complete reset to avoid changing test password
```

### 1.4 Token Validation
```bash
# Test with invalid token
GET /api/user/profile
Headers: Authorization: Bearer invalid_token
Expected: 401 Unauthorized

# Test without token
GET /api/user/profile
Expected: 401 Unauthorized
```

---

# PHASE 2: Core Account Setup 🏢

## Priority: CRITICAL
**Dependencies**: Phase 1 (JWT Token)

### 2.1 Company Management

#### 2.1.1 Get Existing Companies
```bash
GET /api/company/getCompany
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, list of companies
Store: COMPANY_ID from first company (if exists)
```

#### 2.1.2 Create Company (if none exists)
```bash
POST /api/company/addCompany
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  "company_name": "DynoPay Test Company",
  "address_line1": "123 Test Street",
  "city": "Lisbon",
  "country": "PT",
  "zip_code": "1000-001",
  "vat_number": "PT123456789",
  "vat_type": "VAT"
}
Expected: 201, company details with company_id
Store: COMPANY_ID
```

#### 2.1.3 Update Company VAT Info
```bash
PUT /api/company/updateCompany/{COMPANY_ID}
Body: {
  "vat_verified": true,
  "address_line2": "Suite 100"
}
Expected: 200, updated company info
```

### 2.2 Wallet Management

#### 2.2.1 Get Configured Currencies
```bash
GET /api/wallet/configured-currencies?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, list of configured wallet currencies
Verify: Returns wallet_count, configured_currencies array
```

#### 2.2.2 Get User Wallets
```bash
GET /api/wallet/getWallet?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, array of wallets
Store: Wallet IDs for BTC, ETH, USDT_TRC20
```

#### 2.2.3 Get Wallet Addresses
```bash
GET /api/wallet/getWalletAddresses?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, wallet addresses with wallet_type, wallet_address
Verify: Addresses are properly formatted for each crypto type
```

#### 2.2.4 Add New Wallet Address (Optional)
```bash
POST /api/wallet/addWalletAddress
Body: {
  "company_id": {COMPANY_ID},
  "wallet_name": "Test BTC Wallet",
  "wallet_type": "BTC",
  "wallet_address": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"
}
Expected: 200, success message
```

### 2.3 API Key Management

#### 2.3.1 List Existing API Keys
```bash
GET /api/userApi/getApi?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, grouped API keys (production/development)
Store: Existing API_KEY_ID (if any)
```

#### 2.3.2 Create Development API Key
```bash
POST /api/userApi/addApi
Body: {
  "company_id": {COMPANY_ID},
  "api_name": "Test Dev API Key",
  "base_currency": "USD",
  "environment": "development",
  "permissions": ["payments", "transactions"],
  "withdrawal_whitelist": false
}
Expected: 200, API key details with apiKey, adminToken
Store: DEV_API_KEY, DEV_ADMIN_TOKEN
Verify: Key starts with dpk_test_
```

#### 2.3.3 Create Production API Key
```bash
POST /api/userApi/addApi
Body: {
  "company_id": {COMPANY_ID},
  "api_name": "Test Prod API Key",
  "base_currency": "BTC",
  "environment": "production",
  "permissions": ["payments", "transactions", "withdrawals"],
  "withdrawal_whitelist": true
}
Expected: 200, API key details
Store: PROD_API_KEY, PROD_ADMIN_TOKEN
Verify: Key starts with dpk_live_
```

#### 2.3.4 Toggle API Key Status
```bash
PUT /api/userApi/toggleStatus/{API_KEY_ID}
Body: { "status": "inactive" }
Expected: 200, updated status

# Toggle back
PUT /api/userApi/toggleStatus/{API_KEY_ID}
Body: { "status": "active" }
Expected: 200, status active
```

#### 2.3.5 Update API Key
```bash
PUT /api/userApi/updateApi/{API_KEY_ID}
Body: {
  "api_name": "Updated Test API Key",
  "permissions": ["payments", "transactions", "customers"]
}
Expected: 200, updated API key info
```

#### 2.3.6 Regenerate API Key
```bash
POST /api/userApi/regenerateKey/{API_KEY_ID}
Expected: 200, new apiKey
Verify: New key is different from original
Store: Updated API key
```

---

# PHASE 3: Payment Processing 💳

## Priority: CRITICAL
**Dependencies**: Phase 2 (Company, Wallets, API Keys)

### 3.1 Payment Links

#### 3.1.1 Create Payment Link
```bash
POST /api/pay/createPaymentLink
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  "company_id": {COMPANY_ID},
  "base_amount": 100.00,
  "base_currency": "USD",
  "description": "Test payment for production readiness",
  "expire": "24h",
  "callback_url": "https://example.com/callback",
  "redirect_url": "https://example.com/success",
  "webhook_url": "https://example.com/webhook"
}
Expected: 201, payment link details
Store: PAYMENT_LINK_ID, payment_link URL
Verify: expires_at calculated correctly (24h from now)
```

#### 3.1.2 List Payment Links
```bash
GET /api/pay/getPaymentLinks?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, array of payment links
Verify: 
  - Status computed correctly (Active/Expired/Completed)
  - Times formatted as DD/MM/YYYY HH:MM:SS
  - USD values formatted as $100
  - times_used counter present
```

#### 3.1.3 Get Payment Link by ID
```bash
GET /api/pay/links/{PAYMENT_LINK_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, payment link details
Verify: All fields present (description, expires, status, URLs)
```

#### 3.1.4 Update Payment Link
```bash
PUT /api/pay/links/{PAYMENT_LINK_ID}
Body: {
  "description": "Updated test payment",
  "expire": "7d",
  "callback_url": "https://example.com/new-callback"
}
Expected: 200, updated payment link
Verify: expires_at recalculated for 7 days
```

#### 3.1.5 Payment Link Expiry Test
```bash
# Create link with "No" expiry
POST /api/pay/createPaymentLink
Body: {
  "base_amount": 50,
  "base_currency": "USD",
  "expire": "No"
}
Expected: 201, expires_at should be null
Store: NO_EXPIRY_LINK_ID

# Verify never expires
GET /api/pay/links/{NO_EXPIRY_LINK_ID}
Verify: Status shows "Never" for expiry
```

### 3.2 Transaction Management

#### 3.2.1 Get All Transactions
```bash
POST /api/wallet/getAllTransactions
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  "page": 1,
  "rowsPerPage": 10,
  "company_id": {COMPANY_ID}
}
Expected: 200, transactions with pagination
Verify: Returns customers_transactions, self_transactions
```

#### 3.2.2 Filter Transactions by Status
```bash
POST /api/wallet/getAllTransactions
Body: {
  "status": "Done",
  "company_id": {COMPANY_ID},
  "page": 1,
  "rowsPerPage": 10
}
Expected: 200, only completed transactions
```

#### 3.2.3 Filter by Currency
```bash
POST /api/wallet/getAllTransactions
Body: {
  "currency": "BTC",
  "company_id": {COMPANY_ID}
}
Expected: 200, only BTC transactions
```

#### 3.2.4 Date Range Filter
```bash
POST /api/wallet/getAllTransactions
Body: {
  "date_from": "2025-01-01",
  "date_to": "2025-01-31",
  "company_id": {COMPANY_ID}
}
Expected: 200, transactions within date range
```

#### 3.2.5 Search Transactions
```bash
POST /api/wallet/getAllTransactions
Body: {
  "search": "test",
  "company_id": {COMPANY_ID}
}
Expected: 200, transactions matching search term
```

#### 3.2.6 Get Transaction Details
```bash
GET /api/wallet/transaction/{TRANSACTION_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, detailed transaction info
Verify: All fields present (status, amount, fees, confirmations, etc.)
```

#### 3.2.7 Export Transactions
```bash
POST /api/wallet/transactions/export
Body: {
  "company_id": {COMPANY_ID},
  "status": "Done"
}
Expected: 200, CSV file
Headers: Content-Type: text/csv
Verify: CSV contains all expected columns
```

---

# PHASE 4: Dashboard & Analytics 📊

## Priority: HIGH
**Dependencies**: Phase 3 (Transaction data)

### 4.1 Dashboard Statistics

#### 4.1.1 Main Dashboard Stats
```bash
GET /api/dashboard
Headers: Authorization: Bearer {JWT_TOKEN}
Query: ?company_id={COMPANY_ID}
Expected: 200
Verify:
  - total_transactions (count, change_percent)
  - total_volume (amount, currency, change_percent)
  - pending_transactions
  - active_wallets
  - fee_tier (current_tier, tier_description, monthly_volume)
```

#### 4.1.2 Volume Chart Data
```bash
# 7 days
GET /api/dashboard/chart?period=7d&company_id={COMPANY_ID}
Expected: 200, daily aggregated data

# 30 days
GET /api/dashboard/chart?period=30d&company_id={COMPANY_ID}
Expected: 200, daily aggregated data

# 90 days
GET /api/dashboard/chart?period=90d&company_id={COMPANY_ID}
Expected: 200, weekly aggregated data

# 1 year
GET /api/dashboard/chart?period=1y&company_id={COMPANY_ID}
Expected: 200, monthly aggregated data

Verify for all:
  - chart_data array with proper grouping
  - currency_breakdown
  - status_breakdown
```

#### 4.1.3 Fee Tiers Information
```bash
GET /api/dashboard/fee-tiers
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, array of 5 tiers
Verify:
  - Starter ($0-$10K)
  - Standard ($10K-$50K)
  - Pro ($50K-$250K)
  - Business ($250K-$1M)
  - Enterprise ($1M+)
```

#### 4.1.4 Recent Transactions
```bash
# Default limit
GET /api/dashboard/recent-transactions?company_id={COMPANY_ID}
Expected: 200, up to 10 recent transactions

# Custom limit
GET /api/dashboard/recent-transactions?limit=5&company_id={COMPANY_ID}
Expected: 200, up to 5 recent transactions

Verify: Transactions sorted by date descending
```

---

# PHASE 5: Tax & Compliance 🧾

## Priority: HIGH
**Dependencies**: Phase 2 (Company setup)

### 5.1 Tax Rate Lookups

#### 5.1.1 Get Tax Rate by Country Code
```bash
GET /api/tax/rate/PT
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200
Verify:
  - standard_rate: 23
  - cached: false (first call), true (second call)
  - country_name: Portugal
```

#### 5.1.2 Get Multiple Country Rates
```bash
GET /api/tax/rate/DE
GET /api/tax/rate/US
GET /api/tax/rate/GB
GET /api/tax/rate/FR

Verify each returns correct standard_rate and caches properly
```

#### 5.1.3 Validate Tax ID/VAT
```bash
POST /api/tax/validate
Body: {
  "tax_id": "PT123456789",
  "country_code": "PT"
}
Expected: 200, validation result
Verify: Handles rate limiting gracefully
```

#### 5.1.4 Get Tax Acronyms
```bash
GET /api/tax/acronyms
Expected: 200
Verify:
  - Returns 102 countries
  - Grouped into EU (27) and Rest of World (75)
  - Each has country_code, country_name, tax_acronym
```

#### 5.1.5 Country Name Lookup
```bash
GET /api/tax/lookup?country=Portugal
Expected: 200, redirects to PT with 23% rate

GET /api/tax/lookup?country=Germany
Expected: 200, redirects to DE with 19% rate
```

### 5.2 Invoice Generation

#### 5.2.1 Get Invoice for Transaction
```bash
GET /api/transactions/{TRANSACTION_ID}/invoice
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200 or 201 (if auto-generated)
Verify:
  - invoice_number format: INV-YYYYMMDD-XXXXX
  - All provider details present
  - Customer details present
  - VAT calculations correct
  - Fee breakdown included
```

#### 5.2.2 List All Invoices
```bash
# Default pagination
GET /api/invoices
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, invoices array with pagination

# Custom pagination
GET /api/invoices?page=1&limit=5&company_id={COMPANY_ID}
Expected: 200, up to 5 invoices
```

#### 5.2.3 Get Specific Invoice
```bash
GET /api/invoices/{INVOICE_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, invoice details
Verify: All 24 fields present
```

---

# PHASE 6: Notifications & Preferences 🔔

## Priority: MEDIUM
**Dependencies**: Phase 1 (Authentication)

### 6.1 Notification Preferences

#### 6.1.1 Get Preferences
```bash
GET /api/notifications/preferences
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200
Verify:
  - transaction_updates
  - payment_received
  - weekly_summary
  - security_alerts
  - email_notifications
  - sms_notifications
  - browser_notifications
  - is_default flag
```

#### 6.1.2 Update Preferences
```bash
PUT /api/notifications/preferences
Body: {
  "transaction_updates": true,
  "payment_received": true,
  "weekly_summary": false,
  "email_notifications": true
}
Expected: 200, updated preferences
Verify: is_default changes to false
```

### 6.2 Notification Management

#### 6.2.1 Get Notification Types
```bash
GET /api/notifications/types
Expected: 200, array of 11+ notification types
Verify includes:
  - transaction_confirmed
  - payment_received
  - payment_pending
  - payment_confirming
  - weekly_summary
  - security_alert
  - kyc_required
  - kyc_approved
  - kyc_rejected
```

#### 6.2.2 List Notifications
```bash
# All notifications
GET /api/notifications?page=1&limit=10
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, notifications array with pagination

# Filter by type
GET /api/notifications?type=payment_received
Expected: 200, filtered notifications

# Filter by read status
GET /api/notifications?is_read=false
Expected: 200, unread notifications only
```

#### 6.2.3 Get Unread Count
```bash
GET /api/notifications/unread-count
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, { unread_count: N }
```

#### 6.2.4 Mark as Read
```bash
# Single notification
PUT /api/notifications/{NOTIFICATION_ID}/read
Expected: 200, { notification_id, is_read: true }

# All notifications
PUT /api/notifications/read-all
Expected: 200, { updated_count: N }
```

#### 6.2.5 Delete Notification
```bash
DELETE /api/notifications/{NOTIFICATION_ID}
Expected: 200, { notification_id, deleted: true }
```

#### 6.2.6 Trigger Weekly Summary (Test)
```bash
POST /api/notifications/trigger-weekly-summary
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, created notification with summary data
Verify: Contains transaction statistics for past 7 days
```

---

# PHASE 7: KYC & Identity Verification 🆔

## Priority: MEDIUM
**Dependencies**: Phase 2 (Company setup)

### 7.1 KYC Status Check
```bash
GET /api/kyc/status
Headers: Authorization: Bearer {JWT_TOKEN}
Query: ?company_id={COMPANY_ID}
Expected: 200, KYC status information
```

### 7.2 KYC History
```bash
GET /api/kyc/history?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, array of KYC submission history
Note: May return empty if no KYC submissions exist
```

### 7.3 Resubmit KYC (if needed)
```bash
POST /api/kyc/resubmit
Body: {
  "company_id": {COMPANY_ID},
  "documents": ["passport", "address_proof"]
}
Expected: 200 or 500 (if veriff_session_id column missing)
Note: Known issue with missing DB column
```

---

# PHASE 8: Customer & Subscription Management 👥

## Priority: MEDIUM
**Dependencies**: Phase 2 (Company, API Keys)

### 8.1 Customer Management

#### 8.1.1 List Customers
```bash
GET /api/customers?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, customers array
```

#### 8.1.2 Create Customer (via API)
```bash
POST /api/customers
Body: {
  "company_id": {COMPANY_ID},
  "customer_name": "Test Customer",
  "email": "testcustomer@example.com",
  "mobile": "+351912345678"
}
Expected: 201, customer details
Store: CUSTOMER_ID
```

#### 8.1.3 Update Customer
```bash
PUT /api/userApi/updateCustomer/{CUSTOMER_ID}
Body: {
  "customer_name": "Updated Test Customer"
}
Expected: 200 or 404 (if customer doesn't exist)
```

#### 8.1.4 Delete Customer
```bash
DELETE /api/userApi/deleteCustomer/{CUSTOMER_ID}
Expected: 200 or 404
```

### 8.2 Subscription Management

#### 8.2.1 List Plans
```bash
GET /api/plans?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, plans array
```

#### 8.2.2 List Subscriptions
```bash
GET /api/subscriptions?company_id={COMPANY_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 200, subscriptions array (may be empty)
```

#### 8.2.3 Get Subscription Details
```bash
GET /api/subscriptions/{SUBSCRIPTION_ID}
Expected: 200 or 404
```

---

# PHASE 9: Swagger Documentation 📚

## Priority: LOW
**Dependencies**: None

### 9.1 Swagger UI Access
```bash
GET /api/docs
Expected: 200, HTML Swagger UI page
```

### 9.2 OpenAPI Spec
```bash
GET /api/docs.json
Expected: 200, JSON OpenAPI specification
Verify: Contains openapi version, paths, components
```

---

# PHASE 10: Edge Cases & Error Handling 🚨

## Priority: HIGH
**Dependencies**: All previous phases

### 10.1 Authentication Edge Cases

#### Invalid Credentials
```bash
POST /api/user/login
Body: { "email": "nomadly@moxx.co", "password": "wrongpassword" }
Expected: 401, error message
```

#### Missing Required Fields
```bash
POST /api/user/login
Body: { "email": "nomadly@moxx.co" }
Expected: 400, validation error
```

#### Expired Token (if applicable)
```bash
GET /api/user/profile
Headers: Authorization: Bearer {EXPIRED_TOKEN}
Expected: 401, token expired message
```

### 10.2 API Key Edge Cases

#### Create API Key Without Wallet
```bash
# If user has no wallet addresses configured
POST /api/userApi/addApi
Body: { "company_id": {COMPANY_ID_NO_WALLETS} }
Expected: 400, "At least one wallet address is required"
```

#### Duplicate API Key Name
```bash
POST /api/userApi/addApi
Body: { "api_name": "Existing API Key Name" }
Expected: 400 or prevents duplicate
```

### 10.3 Payment Link Edge Cases

#### Invalid Currency
```bash
POST /api/pay/createPaymentLink
Body: { "base_currency": "INVALID" }
Expected: 400, validation error
```

#### Negative Amount
```bash
POST /api/pay/createPaymentLink
Body: { "base_amount": -100 }
Expected: 400, validation error
```

#### Access Another Company's Link
```bash
GET /api/pay/links/{OTHER_COMPANY_LINK_ID}
Headers: Authorization: Bearer {JWT_TOKEN}
Expected: 403 or 404, unauthorized access
```

### 10.4 Transaction Edge Cases

#### Invalid Transaction ID
```bash
GET /api/wallet/transaction/invalid-id-12345
Expected: 404, transaction not found
```

#### Export with No Data
```bash
POST /api/wallet/transactions/export
Body: { "date_from": "2099-01-01", "date_to": "2099-12-31" }
Expected: 200, empty CSV or message
```

---

# PHASE 11: Integration & End-to-End Flows 🔄

## Priority: CRITICAL
**Dependencies**: All phases

### 11.1 Complete Payment Flow
```
1. Create payment link
2. (Simulate) Customer visits link
3. (Simulate) Payment initiated
4. Check transaction created
5. Verify webhook called (if configured)
6. Check notification created
7. Verify invoice auto-generated
8. Check dashboard stats updated
```

### 11.2 API Key Lifecycle
```
1. Create development API key
2. Test API key with payment creation
3. Toggle status to inactive
4. Verify API calls fail
5. Toggle back to active
6. Regenerate key
7. Verify old key no longer works
8. Test with new key
9. Delete API key
10. Verify complete removal
```

### 11.3 Company Setup Flow
```
1. Create new company
2. Add VAT information
3. Validate VAT number
4. Create wallet addresses
5. Create API keys
6. Create first payment link
7. Verify everything appears in dashboard
```

---

# PHASE 12: Performance & Load Testing ⚡

## Priority: MEDIUM
**Dependencies**: All functional tests pass

### 12.1 Concurrent Requests
```bash
# Use testing tool to simulate
- 10 concurrent API key creations
- 50 concurrent payment link retrievals
- 100 concurrent dashboard stat requests

Verify:
- No rate limiting issues
- Consistent response times
- No data corruption
```

### 12.2 Pagination Performance
```bash
# Test large result sets
GET /api/wallet/getAllTransactions?rowsPerPage=100
GET /api/notifications?limit=100

Verify:
- Reasonable response time (<2s)
- Correct pagination metadata
```

### 12.3 Cache Effectiveness
```bash
# Tax rate caching
GET /api/tax/rate/PT (first call - not cached)
GET /api/tax/rate/PT (second call - should be cached)

Verify: Second call is significantly faster
```

---

# Test Execution Checklist

## Pre-Test Setup
- [ ] Backend services running (ports 8001, 3300, 3301)
- [ ] Database accessible
- [ ] Redis accessible
- [ ] Test user exists (nomadly@moxx.co)
- [ ] Environment variables configured
- [ ] All dependencies installed

## Test Execution
- [ ] Phase 1: Authentication ✅
- [ ] Phase 2: Account Setup ✅
- [ ] Phase 3: Payment Processing ✅
- [ ] Phase 4: Dashboard ✅
- [ ] Phase 5: Tax & Compliance ✅
- [ ] Phase 6: Notifications ✅
- [ ] Phase 7: KYC ✅
- [ ] Phase 8: Customers & Subscriptions ✅
- [ ] Phase 9: Documentation ✅
- [ ] Phase 10: Edge Cases ✅
- [ ] Phase 11: Integration Flows ✅
- [ ] Phase 12: Performance ✅

## Success Criteria

### Must Pass (Production Blocker)
- ✅ All Phase 1 tests (Authentication)
- ✅ All Phase 2 tests (Account Setup)
- ✅ All Phase 3 tests (Payment Processing)
- ✅ All Phase 10 tests (Error Handling)
- ✅ Phase 11 complete payment flow

### Should Pass (High Priority)
- ✅ Phase 4: Dashboard statistics
- ✅ Phase 5: Tax calculations
- ✅ Phase 6: Notifications
- ✅ Phase 11: API key lifecycle

### Nice to Have (Medium Priority)
- ⚠️ Phase 7: KYC (known DB issue)
- ⚠️ Phase 8: Subscriptions (optional feature)
- ✅ Phase 9: Documentation
- ✅ Phase 12: Performance tests

---

# Known Issues to Monitor

## Critical Bugs
1. **Overpayment Conversion Bug** (Line 1841, paymentController.ts)
   - Hardcoded to USD instead of using base_currency
   - Test: Create payment with BTC base_currency, verify conversion

## Database Issues
2. **KYC veriff_session_id Column Missing**
   - POST /api/kyc/resubmit returns 500
   - GET /api/kyc/history returns 500
   - Action: Add column or skip KYC tests

## Endpoint Issues
3. **Plan Management** - No test data available
4. **Customer Management** - Need to create test customers first

---

# Test Reporting Format

For each test, record:
```
✅ PASS: [Endpoint] - [Test Description]
   Response: [Status Code]
   Time: [Response Time]
   Notes: [Any observations]

❌ FAIL: [Endpoint] - [Test Description]
   Expected: [What should happen]
   Actual: [What happened]
   Error: [Error message]
   Action Required: [Fix needed]

⚠️ SKIP: [Endpoint] - [Test Description]
   Reason: [Why skipped]
```

---

# Post-Test Actions

## If All Critical Tests Pass:
1. ✅ System is production-ready
2. Document any workarounds for known issues
3. Create monitoring plan
4. Set up alerting
5. Plan gradual rollout

## If Critical Tests Fail:
1. ❌ DO NOT deploy to production
2. Document all failures
3. Prioritize fixes
4. Re-run test plan after fixes
5. Consider rollback plan

---

# Automated Test Script Recommendation

Create automated test script using the testing agent:
```bash
# Call testing agent with comprehensive test plan
testing_agent --mode=production-readiness \
  --user=nomadly@moxx.co \
  --phases=1,2,3,10,11 \
  --report=json
```

This test plan should take approximately **2-3 hours to execute manually** or **30-45 minutes with automation**.
