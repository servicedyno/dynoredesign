Subject: Missing UI/UX Designs for Implemented Backend Features

Hi UI/UX Team,

I hope this message finds you well! We've implemented several backend features that currently lack frontend designs. Could you please help us create designs for the following?

---

## 🚨 Missing Designs (High Priority)

### 1. **Tax Settings (Company-Level & Payment Link-Level)**
**Location:** Company Settings / Tax Configuration Tab + Payment Link Creation/Edit Forms

**Company-Level Tax Settings (Default for all links):**
- Tax applicable toggle (default: OFF)
- Country-based automatic tax rate detection
- Manual tax rate override option (percentage input)
- Tax display name/acronym (e.g., "VAT", "GST", "Sales Tax")

**Payment Link-Level Tax Settings (Override per link):**
- "Apply Tax" toggle on payment link creation form
- Tax rate display/preview before creating link
- Tax amount calculation preview
- Option to override company default tax setting

**Fields to design:**
- Tax applicable toggle with clear ON/OFF states
- Tax rate input (percentage, 0-100%)
- Tax preview calculator
- Country selector for auto-tax detection
- Info tooltip: "Tax is calculated based on payment amount and applied at checkout"

**Database fields:** 
- Company: Tax settings (inherited from country)
- Payment Link: `apply_tax` (boolean)
- Calculated: `tax_rate`, `tax_amount`, `tax_acronym`

**Endpoints implemented:**
- Tax rate lookup: `GET /api/tax/rate/:countryCode`
- Company tax defaults (uses country-based detection)
- Payment link tax: Set via `apply_tax` field in create/update

---

### 2. **Payment Link Editing Screen**
**Location:** Payment Links Management / Edit Payment Link

**Endpoint:** `PUT /api/payment/update/:id`

**Editable Fields:**
- Description (text area)
- Customer Email (email input)
- Base Amount (number input with currency)
- Base Currency (dropdown: USD, EUR, GBP, etc.)
- Payment Modes (checkbox: exact_amount, min_amount, custom_amount)
- Fee Payer (radio: customer or company)
- **Apply Tax** (toggle)
- Expiration (dropdown: 24h, 7d, 30d, Never)
- Callback URL (URL input)
- Redirect URL (URL input)
- Webhook URL (URL input)

**Restrictions:**
- Cannot edit completed payment links (show read-only view)
- Show warning if link has partial payments
- Confirm before updating live payment links

**UI Requirements:**
- Form pre-filled with current values
- Visual diff indicator for changed fields
- "Save Changes" and "Cancel" buttons
- Success message after update
- Validation for all fields
- "View Payment Link" button to see updated link

---

### 3. **Company Webhook Settings**
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

### 4. **Underpayment & Overpayment Settings**
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

### 5. **Currency Selection in Payment Link Creation**
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
   
4. **Backend URL Configuration** (Advanced)
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

**Tax Settings Specific:**
- Visual tax calculator/preview
- Show tax amount in real-time as user types amount
- Clear indication of company default vs. link override
- Info box: "Tax rates are automatically detected based on company country"

**Payment Link Editing Specific:**
- Highlight changed fields with visual indicator
- Show current vs. new values
- Disable editing for completed links
- Confirm modal before saving changes
- Success toast notification after update

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

1. **Tax Settings** (needed for both company profile AND payment links)
2. **Payment Link Editing** (merchants need to update existing links)
3. **Currency Selection** (blocking payment link creation UX)
4. **Webhook Settings** (merchants asking for this feature)
5. **Underpayment/Overpayment** (nice to have, using defaults currently)

---

## 📌 Additional Context

**Tax Implementation Details:**
- Tax is calculated based on company's country
- Can be toggled ON/OFF at company level (default for all links)
- Can be overridden per payment link with `apply_tax` field
- Tax rates fetched from external API based on country
- Supports VAT, GST, Sales Tax, and other regional tax types

**Payment Link Editing:**
- All fields except `link_id`, `user_id`, and `company_id` are editable
- Cannot edit completed payment links
- Updates sync to Redis cache for real-time checkout experience
- Changes are logged for audit trail

**Backend Status:**
- All endpoints functional and tested
- Webhook signature verification implemented
- Currency validation working correctly
- Tax calculation tested across multiple countries
- Settings have sensible defaults if not configured

Please let me know if you need any clarification on functionality, user flows, or technical details. Happy to jump on a quick call to walk through the features!

Thanks for your help! 🙏

Best regards,
Development Team

---

**Reference Documentation:**
- Tax implementation: `/app/backend/controller/paymentController.ts` (lines 270-340)
- Payment link editing: `/app/backend/controller/paymentController.ts` (lines 4738-4930)
- Webhook implementation: `/app/backend/controller/companyController.ts` (lines 757-860)
- Company model: `/app/backend/models/companyModels/companyModel.ts` (lines 70-105)
