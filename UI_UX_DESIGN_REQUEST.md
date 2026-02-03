# Design Request for UI/UX Team

Hi Team,

We need your help designing some new screens and features for DynoPay. Below is everything you need to know, written in plain language with clear visual examples.

---

## Quick Summary

| Screen | What's Needed | Priority |
|--------|---------------|----------|
| Company Settings | Add Webhook, Thresholds sections | HIGH |
| Create Payment Link | Add crypto selector + tax toggle | HIGH |
| Edit Payment Link | New screen (similar to Create) | HIGH |
| Payment Links List | Add Edit button | MEDIUM |
| Checkout Page | Show tax breakdown (already exists, just verify) | LOW |

---

## Screen 1: Company Settings Page

**Current state:** Only has basic info (Company Name, Email, Mobile, Website, Logo)

**What to add:** Two new sections in the settings

---

### Section A: Webhook Settings

**What is this?**  
When a customer pays, DynoPay can automatically notify the merchant's system. This section lets merchants set up that notification.

**Design needed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK NOTIFICATIONS                                          │
│  Receive automatic notifications when payments are made         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Notification URL                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ https://mystore.com/dynopay-webhook                    [📋] ││
│  └─────────────────────────────────────────────────────────────┘│
│  Where should we send payment notifications?                    │
│                                                                 │
│  Secret Key                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ wh_sec_••••••••••••••••••••••xyz123       [👁] [📋] [🔄]   ││
│  └─────────────────────────────────────────────────────────────┘│
│  Use this to verify notifications are really from DynoPay       │
│                                                                 │
│          [Send Test]                       [Save Changes]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Buttons explained:**
- 📋 = Copy to clipboard
- 👁 = Show/hide secret (toggle)
- 🔄 = Generate new secret key

**Important behaviors:**
1. Secret key is always hidden by default (shown as dots)
2. "Generate new secret" (🔄) should show a warning popup:
   ```
   ┌────────────────────────────────────────────┐
   │  ⚠️ Generate New Secret Key?              │
   │                                            │
   │  Your current secret will stop working     │
   │  immediately. Make sure to update your     │
   │  integration before generating a new one.  │
   │                                            │
   │        [Cancel]    [Generate New]          │
   └────────────────────────────────────────────┘
   ```
3. "Send Test" button sends a test notification and shows result:
   - Success: Green message "✓ Test notification sent successfully!"
   - Failure: Red message "✗ Could not reach your URL. Please check and try again."

---

### Section B: Payment Tolerance Settings

**What is this?**  
Cryptocurrency payments can sometimes be slightly off due to network fees or price changes. These settings let merchants control what difference is acceptable.

**Design needed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  PAYMENT TOLERANCE                                              │
│  Control how much variance to accept in payments                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Accept Underpayments Up To                                     │
│  ┌──────────────────────────────────────────────────┐           │
│  │  $  │ 1.00                                   │   │           │
│  └──────────────────────────────────────────────────┘           │
│  If a $100 payment comes in as $99, it will still be marked     │
│  as complete                                                    │
│                                                                 │
│  Flag Overpayments Above                                        │
│  ┌──────────────────────────────────────────────────┐           │
│  │  $  │ 5.00                                   │   │           │
│  └──────────────────────────────────────────────────┘           │
│  You'll get a notification when someone pays more than this     │
│  amount over the total                                          │
│                                                                 │
│  Time for Partial Payments                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │  30                                      │ minutes │         │
│  └──────────────────────────────────────────────────┘           │
│  How long to wait for a customer to complete a partial payment  │
│                                                                 │
│                                          [Save Changes]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Default values (pre-filled):**
- Underpayment: $1.00
- Overpayment: $5.00
- Partial payment time: 30 minutes

---

## Screen 2: Create Payment Link Page

**Current state:** Has basic fields (description, amount, customer email)

**What to add:** Two new sections

---

### Section A: Choose Accepted Cryptocurrencies

**What is this?**  
Merchants can pick which cryptocurrencies they want to accept for this specific payment link.

**Design needed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ACCEPTED CRYPTOCURRENCIES                                      │
│  Which crypto can customers use to pay?                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     ₿       │  │     Ξ       │  │     ◎       │              │
│  │   Bitcoin   │  │  Ethereum   │  │    Tron     │              │
│  │    (BTC)    │  │    (ETH)    │  │    (TRX)    │              │
│  │     [✓]     │  │     [✓]     │  │     [✓]     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     Ł       │  │     Ð       │  │     ₿       │              │
│  │  Litecoin   │  │  Dogecoin   │  │ Bitcoin Cash│              │
│  │    (LTC)    │  │   (DOGE)    │  │    (BCH)    │              │
│  │     [✓]     │  │     [✓]     │  │     [ ]     │              │
│  └─────────────┘  └─────────────┘  └─────ˍˍˍˍˍˍˍˍ┘              │
│                                    ↳ Set up wallet first        │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     ₮       │  │     ₮       │  │     $       │              │
│  │    USDT     │  │    USDT     │  │    USDC     │              │
│  │  (TRC-20)   │  │  (ERC-20)   │  │  (ERC-20)   │              │
│  │     [✓]     │  │     [✓]     │  │     [✓]     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│  ✓ 8 of 9 currencies selected        [Select All]  [Clear All] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Important behaviors:**
1. **Cards style:** Each crypto shown as a clickable card with logo, name, and ticker
2. **Selected state:** Checkbox checked, card has colored border
3. **Disabled state:** If merchant hasn't set up a wallet for that crypto:
   - Card is grayed out
   - Checkbox is disabled
   - Shows "Set up wallet first" link (goes to Wallet page)
4. **Validation:** At least 1 currency must be selected
5. **Counter:** Shows "X of Y currencies selected"
6. **Quick actions:** "Select All" and "Clear All" buttons

---

### Section B: Tax Toggle

**What is this?**  
Merchants can choose whether to add tax to this payment. If enabled, tax is calculated automatically at checkout based on where the customer is located (their country), not where the merchant is.

**Important:** The merchant only toggles ON or OFF. They don't set the tax rate - it's automatic based on customer location.

**Design needed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  TAX                                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Add tax to this payment                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Include tax in total              [○          ] OFF      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⓘ When enabled, tax will be calculated automatically based    │
│    on your customer's location at checkout                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**When toggle is OFF:**
- Simple help text explaining the feature

**When toggle is ON:**
- Show explanation that tax will be calculated based on customer location:

```
┌─────────────────────────────────────────────────────────────────┐
│  TAX                                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Add tax to this payment                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Include tax in total              [          ○] ON       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ✓ Tax enabled                                           │   │
│  │                                                          │   │
│  │  Tax will be calculated at checkout based on where your  │   │
│  │  customer is located.                                    │   │
│  │                                                          │   │
│  │  Examples:                                               │   │
│  │  • Customer in Portugal → 23% IVA added                  │   │
│  │  • Customer in Germany → 19% MwSt added                  │   │
│  │  • Customer in UK → 20% VAT added                        │   │
│  │  • Customer in USA → No tax (0%)                         │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen 3: Edit Payment Link Page (NEW)

**Current state:** This screen doesn't exist yet

**What's needed:** A screen to edit existing payment links

**Design approach:** Copy the Create Payment Link form, but:
1. Pre-fill all fields with current values
2. Show the Link ID and status at the top
3. Show warning for active links
4. Disable editing for completed/expired links

**Design needed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Payment Links                                        │
│                                                                 │
│  Edit Payment Link                                              │
│  Link ID: #12345                              Status: 🟢 Active │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Same fields as Create form, pre-filled with current values]   │
│                                                                 │
│  • Description                                                  │
│  • Amount & Currency                                            │
│  • Customer Email                                               │
│  • Accepted Cryptocurrencies (selector from Create form)        │
│  • Tax toggle                                                   │
│  • Who pays fees (Customer or Merchant)                         │
│  • Expiration                                                   │
│  • Callback URL                                                 │
│  • Redirect URL                                                 │
│  • Webhook URL                                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ⚠️ This payment link is active. Customers may have already     │
│     received it. Changes will apply immediately.                │
│                                                                 │
│          [Cancel]                         [Save Changes]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Confirmation popup when saving:**
```
┌────────────────────────────────────────────────┐
│  Save Changes?                                 │
│                                                │
│  This payment link is active and may have      │
│  been shared with customers. Changes will      │
│  apply immediately.                            │
│                                                │
│        [Cancel]         [Save Changes]         │
└────────────────────────────────────────────────┘
```

**For PAID or EXPIRED links - Read Only View:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Payment Links                                        │
│                                                                 │
│  Payment Link Details                                           │
│  Link ID: #12345                               Status: 🔵 Paid  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ⓘ This payment has been completed and cannot be edited │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [All fields shown but grayed out / not editable]               │
│                                                                 │
│                                               [Back to List]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen 4: Payment Links List Page

**Current state:** Shows list with View, Copy, Delete actions

**What to add:** Edit button for active links

```
┌─────────────────────────────────────────────────────────────────┐
│  PAYMENT LINKS                                  [+ Create New]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Description           Amount     Status      Actions           │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Annual subscription   $299.00    🟢 Active   [Edit] [Copy]     │
│                                               [View] [Delete]   │
│                                                                 │
│  One-time purchase     $49.99     🔵 Paid     [Copy] [View]     │
│                                                                 │
│  Consultation fee      $150.00    🔴 Expired  [View]            │
│                                                                 │
│  Pending order         $75.00     🟡 Pending  [Edit] [Copy]     │
│                                               [View] [Delete]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Action buttons by status:**

| Status | Available Actions |
|--------|-------------------|
| 🟢 Active | Edit, Copy Link, View, Delete |
| 🟡 Pending | Edit, Copy Link, View, Delete |
| 🔵 Paid | Copy Link, View |
| 🔴 Expired | View |

---

## Screen 5: Checkout Page (Customer-Facing)

**Current state:** Exists but needs tax display when enabled

**What to verify/add:** When merchant has enabled tax for the payment link, show the tax breakdown to the customer based on their detected location.

```
┌─────────────────────────────────────────────────────────────────┐
│                         DynoPay                                 │
│                                                                 │
│  Pay to: Acme Corp                                              │
│  For: Annual subscription                                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Order Summary                                                  │
│  ──────────────────────────────────────────────────────────────│
│  Subtotal                                           $299.00     │
│  VAT (23%) - Portugal                                $68.77     │
│  ──────────────────────────────────────────────────────────────│
│  Total                                              $367.77     │
│                                                                 │
│  📍 Tax calculated based on your location: Portugal 🇵🇹         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select payment method:                                         │
│                                                                 │
│  [Bitcoin]  [Ethereum]  [USDT]  [More...]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Important notes:**
- Tax type name changes by country (VAT, IVA, GST, MwSt, etc.)
- Show country flag next to location
- Small text explaining tax is based on customer location

**If tax is NOT enabled** (toggle was OFF when creating link):
- Don't show any tax breakdown
- Just show "Total: $299.00"

**If customer location can't be detected:**
- Don't add tax (show 0% tax)
- Don't show the tax line at all

---

## Existing Screens - NO CHANGES NEEDED

These screens already exist and don't need redesign:

1. **Dashboard** - ✅ Complete
2. **Transactions** - ✅ Complete  
3. **Wallet** - ✅ Complete
4. **APIs** - ✅ Complete
5. **Profile** - ✅ Complete (personal user info)
6. **Notifications** - ✅ Complete

---

## Summary Checklist

| # | Screen | Section | What to Design |
|---|--------|---------|----------------|
| 1 | Company Settings | Webhooks | URL input, masked secret, test button |
| 2 | Company Settings | Tolerances | Under/over payment thresholds |
| 3 | Create Payment Link | Crypto selector | Multi-select cards with logos |
| 4 | Create Payment Link | Tax toggle | Simple ON/OFF with explanation |
| 5 | Edit Payment Link | Full page | Copy of Create + edit behaviors |
| 6 | Payment Links List | Actions | Add Edit button by status |
| 7 | Checkout | Tax display | Show tax breakdown to customer |

---

## Key Things to Remember

1. **Tax is automatic** - Merchant only turns it ON or OFF. The actual rate is detected from customer's location at checkout, not set by merchant.

2. **Crypto availability** - If merchant hasn't set up a wallet for a crypto, that option should be disabled with "Set up wallet" link.

3. **Edit restrictions** - Paid and Expired payment links are read-only. Only Active and Pending links can be edited.

4. **Webhook security** - Secret key should always be hidden by default. Warning before regenerating.

5. **All currencies supported**: BTC, ETH, LTC, DOGE, TRX, BCH, USDT (TRC-20), USDT (ERC-20), USDC (ERC-20)

---

## Questions?

Let me know if you need:
- More details on any screen
- User flow diagrams  
- Examples from similar payment apps
- Technical clarification

Thanks!  
Development Team

---

**Document Version:** 3.0  
**Last Updated:** February 2026
