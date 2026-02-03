Subject: Missing UI/UX Designs for Implemented Backend Features

Hi UI/UX Team,

I hope this message finds you well! We've implemented several backend features that currently lack frontend designs. Could you please help us create designs for the following?

---

## 🚨 Missing Designs (High Priority)

### 1. **Company Webhook Settings**
**Location:** Company Settings / Integrations Tab

**Fields to design:**
- Webhook URL (text input with URL validation)
- Webhook Secret (with "Generate New Secret" button)
- "Test Webhook" button to send test payload
- Secret display (masked with option to reveal: `***abc12345`)

**Endpoints implemented:**
- `PUT /api/company/webhook-settings/:id` (Update)
- `GET /api/company/webhook-settings/:id` (Get current settings)

---

### 2. **Underpayment & Overpayment Settings**
**Location:** Company Settings / Payment Handling Tab

**Fields to design:**
- **Underpayment Threshold** (USD amount, default: $1)
  - Description: "Maximum underpayment to accept as full payment"
  - Example: "If customer pays $99 instead of $100, accept payment"
  
- **Overpayment Threshold** (USD amount, default: $5)
  - Description: "Minimum overpayment to trigger special handling"
  - Example: "If customer pays $110 instead of $100, handle overage"

- **Grace Period** (minutes, default: 30)
  - Description: "Time allowed for partial payment completion"

**Database fields:** `underpayment_threshold_usd`, `overpayment_threshold_usd`, `grace_period_minutes`

---

### 3. **Currency Selection in Payment Link Creation**
**Location:** Create Payment Link Form

**UI Requirements:**
- Multi-select or checkbox group for available cryptocurrencies
- Options: BTC, ETH, TRX, LTC, DOGE, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20
- Show only currencies where company has configured wallets
- Visual: Cryptocurrency logos with names
- Validation: At least one currency must be selected

**Current behavior:** Backend returns available currencies based on company's wallet configuration

---

## ✅ Other Implemented Settings (FYI - Already Have UI)

These are already implemented in the backend and should have existing UI:

1. **Company Profile Settings**
   - Basic info: Name, Email, Phone, Website
   - Logo upload
   - VAT Number with verification status
   
2. **Address Information**
   - Address Line 1 & 2, City, State, Country, Zip Code
   
3. **Payment Link Modes**
   - Exact Amount, Minimum Amount, Custom Amount
   - Fee payment option: Customer pays or Company pays
   
4. **Tax Settings**
   - Tax applicable toggle
   - Tax rate selection by country
   
5. **Backend URL Configuration** (Advanced)
   - Multi-tenant webhook delivery URL

---

## 📋 Design Guidelines

**Form Layout Suggestions:**
- Group related settings in tabs/sections
- Use tooltips for technical terms
- Add "What's this?" help icons
- Include validation messages
- Show example values
- Add "Save Changes" and "Cancel" buttons

**Webhook Settings Specific:**
- Security warning when regenerating secret
- Copy-to-clipboard for webhook URL and secret
- Webhook event log viewer (bonus feature)

**Currency Selection Specific:**
- Visual currency cards with logos
- Disabled state for unconfigured wallets
- "Configure wallet" link for disabled currencies

---

## 🎯 Priority Order

1. **Currency Selection** (blocking payment link creation UX)
2. **Webhook Settings** (merchants asking for this feature)
3. **Underpayment/Overpayment** (nice to have, using defaults currently)

---

## 📌 Additional Context

- All backend endpoints are functional and tested
- Webhook signature verification is implemented
- Currency validation is working correctly
- Settings have sensible defaults if not configured

Please let me know if you need any clarification on functionality, user flows, or technical details. Happy to jump on a quick call to walk through the features!

Thanks for your help! 🙏

Best regards,
Development Team

---

**Reference Documentation:**
- Webhook implementation: `/app/backend/controller/companyController.ts` (lines 757-860)
- Company model: `/app/backend/models/companyModels/companyModel.ts` (lines 70-105)
- Payment link creation: `/app/backend/controller/paymentController.ts`
