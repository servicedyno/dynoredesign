Subject: Missing UI/UX Designs for Backend-Ready Features (All Verified ✅)

Hi UI/UX Team,

We need designs for several features that are fully implemented in the backend with complete API documentation. All endpoints have been verified and are production-ready.

---

## 🚨 MISSING DESIGNS - FULLY IMPLEMENTED & DOCUMENTED

### 1. **Tax Settings (Two Locations)** 🔴 CRITICAL
**Priority: #1** - Required in BOTH company settings AND payment link forms

#### **Company-Level Tax Configuration**
**Location:** Company Settings → Tax Configuration Tab

**Backend Status:** ✅ Implemented  
**API Endpoints:** ✅ Documented in Swagger  
- `GET /api/tax/rate/:countryCode` - Get tax rate by country
- `GET /api/tax/acronyms` - Get tax acronyms (VAT, GST, etc.)
- `GET /api/tax/lookup?country=Portugal` - Lookup by country name

**Fields Needed:**
- Tax applicable toggle (default: OFF)
- Country-based automatic tax detection
- Tax rate display (percentage)
- Tax acronym display (VAT, GST, Sales Tax, IVA, MwSt, etc.)
- Tax calculator preview

**Database Fields:** 
- Company inherits tax from `country` field
- Tax rate auto-fetched from external API
- Cached for 24 hours

#### **Payment Link-Level Tax Override**
**Location:** Payment Link Creation & Edit Forms

**Backend Status:** ✅ Implemented  
**Database Field:** `apply_tax` (boolean)

**Fields Needed:**
- "Apply Tax" toggle per link
- Tax preview before creating link
- Real-time tax calculation (shows: Amount + Tax = Total)
- Override indicator if company default is different

**Tax Calculation Example:**
```
Payment Amount: $100.00
Tax Rate (23% VAT): $23.00
Total: $123.00
```

**Implementation Details:**
- Tax is calculated at checkout based on payment amount
- Applied only if `apply_tax: true` in payment link
- Tax rate determined by company's country
- Supports all international tax types

---

### 2. **Payment Link Editing Screen** 🔴 CRITICAL  
**Priority: #2** - Merchants need to update existing links

**Backend Status:** ✅ Fully Implemented  
**API Endpoint:** ✅ Documented in Swagger
- `PUT /api/pay/links/:id` - Update payment link
- `GET /api/pay/links/:id` - Get payment link details

**All Editable Fields:**
- **Description** (text area)
- **Customer Email** (email input with validation)
- **Base Amount** (number input with currency symbol)
- **Base Currency** (dropdown: USD, EUR, GBP, INR, etc.)
- **Payment Modes** (checkboxes: exact_amount, min_amount, custom_amount)
- **Fee Payer** (radio buttons: customer or company)
- **Apply Tax** (toggle switch) ← NEW!
- **Expiration** (dropdown: 24h, 7d, 30d, Never)
- **Callback URL** (URL input)
- **Redirect URL** (URL input)  
- **Webhook URL** (URL input)

**UI Requirements:**
1. **Pre-filled Form** - Load current values from GET endpoint
2. **Changed Field Indicators** - Highlight modified fields
3. **Read-Only Mode** - Disable editing for completed links (status: paid/expired)
4. **Validation** - All fields validated before save
5. **Confirmation Modal** - "Are you sure you want to update this active payment link?"
6. **Success Message** - Toast notification after successful update
7. **View Link Button** - Quick access to updated payment link

**Restrictions:**
- Cannot edit: `link_id`, `user_id`, `company_id`, `status`
- Show warning if link has partial payments
- Completed links: Read-only view only

---

### 3. **Currency Selection in Payment Link Forms** 🔴 CRITICAL
**Priority: #3** - Better UX for payment link creation

**Backend Status:** ✅ Implemented  
**API Endpoint:** ✅ Working
- Returns available currencies based on company's configured wallets
- Validates selected currencies exist in company's wallet pool

**All Supported Cryptocurrencies:**
- Bitcoin (BTC)
- Ethereum (ETH)
- Tron (TRX)
- Litecoin (LTC)
- Dogecoin (DOGE)
- Bitcoin Cash (BCH)
- USDT-TRC20 (Tether on Tron)
- USDT-ERC20 (Tether on Ethereum)
- USDC-ERC20 (USD Coin on Ethereum)

**UI Requirements:**
1. **Multi-Select Checkbox Group** with crypto logos
2. **Visual Cards** - Each currency in a card with logo + name
3. **Disabled State** - Gray out currencies without configured wallets
4. **"Configure Wallet" Link** - For disabled currencies
5. **Validation** - At least 1 currency must be selected
6. **Default Selection** - Pre-select all available currencies

**Design Suggestion:**
```
[✓] BTC - Bitcoin           [✓] ETH - Ethereum
[✓] TRX - Tron             [✓] LTC - Litecoin
[✓] DOGE - Dogecoin        [ ] BCH - Bitcoin Cash (Configure wallet →)
[✓] USDT-TRC20             [✓] USDT-ERC20
[✓] USDC-ERC20
```

---

### 4. **Company Webhook Settings** 🟡 HIGH PRIORITY
**Priority: #4** - Merchant requests

**Backend Status:** ✅ Fully Implemented  
**API Endpoints:** ✅ Documented in Swagger
- `PUT /api/company/webhook-settings/:id` - Update settings
- `GET /api/company/webhook-settings/:id` - Get settings
- `POST /api/company/webhook-test/:id` - Test webhook
- `GET /api/company/webhook-history/:id` - Get webhook delivery log
- `GET /api/company/webhook-stats/:id` - Get delivery stats

**Fields Needed:**
1. **Webhook URL** (text input with URL validation)
2. **Webhook Secret** (masked display with reveal button)
3. **Generate New Secret** (button with confirmation)
4. **Test Webhook** (button to send test payload)
5. **Copy to Clipboard** (for both URL and secret)

**Additional Features (Bonus):**
- Webhook event log viewer
- Delivery success/failure statistics
- Retry failed webhooks button

**Security:**
- Secret is never shown in full (only preview: `wh_sec_***xyz123`)
- Warning modal when regenerating secret
- Signature verification documentation link

---

### 5. **Underpayment & Overpayment Thresholds** 🟢 MEDIUM PRIORITY
**Priority: #5** - Using defaults currently

**Backend Status:** ✅ Implemented  
**Database Fields:** 
- `underpayment_threshold_usd` (default: $1)
- `overpayment_threshold_usd` (default: $5)
- `grace_period_minutes` (default: 30)

**Fields Needed:**
1. **Underpayment Threshold** 
   - Number input with USD prefix
   - Default: $1.00
   - Help text: "Accept payments within this amount below total as complete"
   - Example: "If customer pays $99 on a $100 invoice, accept it"

2. **Overpayment Threshold**
   - Number input with USD prefix
   - Default: $5.00
   - Help text: "Trigger special handling for overpayments above this amount"
   - Example: "If customer pays $110 on a $100 invoice, handle the $10 overage"

3. **Grace Period**
   - Number input with "minutes" suffix
   - Default: 30 minutes
   - Help text: "Time allowed to complete partial payments"

---

## ✅ VERIFICATION STATUS

### Backend Implementation ✅
- All endpoints functional and tested
- All database fields created and indexed
- All business logic implemented
- Error handling complete
- Validation rules in place

### API Documentation ✅
**Swagger UI:** Available at `/api/docs`

**Documented Endpoints:**
- ✅ Tax: `/api/tax/rate/:countryCode` (GET)
- ✅ Tax: `/api/tax/acronyms` (GET)
- ✅ Payment Link Edit: `/api/pay/links/:id` (PUT, GET)
- ✅ Webhook Settings: `/api/company/webhook-settings/:id` (PUT, GET)
- ✅ Webhook Test: `/api/company/webhook-test/:id` (POST)
- ✅ Webhook History: `/api/company/webhook-history/:id` (GET)
- ✅ Payment Link Create: `/api/pay/createPaymentLink` (POST)

**Documentation Includes:**
- Request/response examples
- Parameter descriptions
- Authentication requirements
- Error codes and messages
- Field validations

---

## 📋 DESIGN GUIDELINES

### General Form Layout
- Group related settings in tabs/sections
- Use tooltips for technical terms
- Add "What's this?" help icons next to complex fields
- Include validation messages inline
- Show example values in placeholders
- Standard "Save Changes" and "Cancel" buttons
- Loading states for async operations

### Tax Settings Specific
- **Visual Calculator** - Show tax calculation in real-time
- **Amount → Tax → Total** - Clear breakdown
- **Company Default Badge** - Show "Using company default: 23% VAT"
- **Override Indicator** - Highlight when link overrides company default
- **Country Flag** - Show flag next to country name

### Payment Link Editing Specific
- **Diff Indicators** - Yellow highlight for changed fields
- **Current vs New** - Side-by-side comparison for major changes
- **Disable Mode** - Clear visual for read-only completed links
- **Confirmation Modal** - Required before saving changes to live links
- **Auto-save Draft** - Optional: Save changes without publishing

### Currency Selection Specific
- **Logo + Name Cards** - Visual cryptocurrency cards
- **Hover Effects** - Interactive feedback
- **Disabled State** - Grayed out with "Configure wallet" CTA
- **Selected Count** - "5 of 9 currencies selected"
- **Select All/None** - Quick action buttons

### Webhook Settings Specific
- **Masked Secret** - `wh_sec_***abc123` with reveal eye icon
- **Copy Button** - One-click copy for URL and secret
- **Test Webhook Success** - Green toast with delivery confirmation
- **Regenerate Warning** - Red modal: "This will invalidate your current secret"
- **Event Log Table** - Recent webhook deliveries with status badges

---

## 🎯 PRIORITY SUMMARY

| Priority | Feature | Status | Impact | Urgency |
|----------|---------|--------|--------|---------|
| 🔴 #1 | Tax Settings (2 locations) | Backend ✅ API ✅ UI ❌ | HIGH | CRITICAL |
| 🔴 #2 | Payment Link Editing | Backend ✅ API ✅ UI ❌ | HIGH | CRITICAL |
| 🔴 #3 | Currency Selection | Backend ✅ API ✅ UI ❌ | MEDIUM | HIGH |
| 🟡 #4 | Webhook Settings | Backend ✅ API ✅ UI ❌ | MEDIUM | HIGH |
| 🟢 #5 | Underpayment/Overpayment | Backend ✅ API ✅ UI ❌ | LOW | MEDIUM |

---

## 📌 NEXT STEPS

1. **Review this document** - Any questions or clarifications?
2. **Design mockups** - Focus on Priority #1-3 first
3. **Design review meeting** - Walk through flows together
4. **Handoff to frontend** - Designs → Implementation
5. **API integration** - Frontend connects to ready endpoints

---

## 🔗 REFERENCE LINKS

**API Documentation (Swagger):**
- Live URL: `https://your-domain.com/api/docs`
- Tax endpoints: `/api/tax/*`
- Payment endpoints: `/api/pay/*`
- Company endpoints: `/api/company/*`

**Backend Implementation:**
- Tax controller: `/app/backend/controller/taxController.ts`
- Payment controller: `/app/backend/controller/paymentController.ts` (lines 4738-4930 for edit)
- Company controller: `/app/backend/controller/companyController.ts` (lines 757-860 for webhooks)
- Company model: `/app/backend/models/companyModels/companyModel.ts` (lines 70-105)

**Swagger Documentation:**
- Tax paths: `/app/backend/swagger/paths/tax.ts`
- Payment paths: `/app/backend/swagger/paths/payment.ts`
- Company paths: `/app/backend/swagger/paths/company.ts`

---

## ✨ WHY THIS IS URGENT

1. **Tax Settings** - Merchants in EU/UK legally require VAT display
2. **Payment Link Editing** - Merchants frustrated they can't update links
3. **Currency Selection** - Currently shows all 9 cryptos regardless of config
4. **Webhook Settings** - Integration customers asking for this feature
5. **Payment Thresholds** - Nice to have, defaults work fine

---

## 💬 QUESTIONS?

I'm available for:
- Quick design review call
- Clarification on any functionality
- Backend API demonstrations
- Technical implementation details
- User flow walkthroughs

**Let's get these designs done!** The backend is ready and waiting. 🚀

Best regards,  
Development Team

---

**Document Version:** 2.0  
**Date:** 2026-02-03  
**Status:** All features verified and documented ✅