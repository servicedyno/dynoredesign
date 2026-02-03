# Design Request for UI/UX Team

Hi Team,

We need your help designing some new screens and features for DynoPay. Below is everything you need to know - no technical stuff, just clear descriptions with examples of how things should look.

---

## Screen 1: Company Settings Page (New Sections Needed)

The current company page only has basic info (name, email, mobile, website, logo). We need to add **3 new sections** to this page.

### Section A: Webhook Settings

**What is it?** 
A webhook is like an automatic notification. When a customer pays, we can send a message to the merchant's system automatically.

**What we need designed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK SETTINGS                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Webhook URL                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ https://mystore.com/payment-notifications              [📋]││
│  └─────────────────────────────────────────────────────────────┘│
│  ⓘ We'll send payment updates to this address                  │
│                                                                 │
│  Webhook Secret                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ wh_sec_****************************xyz123    [👁] [📋] [🔄]││
│  └─────────────────────────────────────────────────────────────┘│
│  ⓘ Use this secret to verify messages are really from us       │
│                                                                 │
│          [Test Webhook]                    [Save Changes]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements:**
- Text input for URL
- Secret key shown as masked (hidden) with reveal button (eye icon)
- Copy to clipboard buttons
- "Regenerate Secret" button (🔄) - should show warning before regenerating
- "Test Webhook" button to verify it works
- Success/error feedback after testing

---

### Section B: Tax Settings

**What is it?**
Merchants in Europe and other regions need to charge tax (VAT, GST, etc.) on payments.

**What we need designed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  TAX SETTINGS                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Enable Tax                                                     │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Charge tax on payments          [======○    ] OFF    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  When toggled ON, show:                                         │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                                                      │       │
│  │   🇵🇹 Portugal                                       │       │
│  │                                                      │       │
│  │   Tax Type: IVA (VAT)                               │       │
│  │   Tax Rate: 23%                                     │       │
│  │                                                      │       │
│  │   ┌────────────────────────────────┐                │       │
│  │   │  Example Calculation:          │                │       │
│  │   │  Payment: €100.00              │                │       │
│  │   │  Tax (23%): €23.00             │                │       │
│  │   │  ─────────────────             │                │       │
│  │   │  Total: €123.00                │                │       │
│  │   └────────────────────────────────┘                │       │
│  │                                                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│                                          [Save Changes]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements:**
- Toggle switch (ON/OFF)
- Country flag next to country name
- Tax type shown (VAT, GST, IVA, MwSt, Sales Tax, etc.)
- Tax rate displayed as percentage
- Live preview calculator showing example
- Read-only - tax rate is auto-detected from company's country

---

### Section C: Payment Threshold Settings

**What is it?**
Sometimes customers pay slightly more or less than the exact amount. These settings let merchants control what's acceptable.

**What we need designed:**

```
┌─────────────────────────────────────────────────────────────────┐
│  PAYMENT TOLERANCE SETTINGS                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Underpayment Tolerance                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ $  │ 1.00                                               │ ││
│  └─────────────────────────────────────────────────────────────┘│
│  ⓘ Accept payments this much below the total as complete       │
│  Example: If invoice is $100 and customer pays $99,             │
│  the payment will be marked as complete                         │
│                                                                 │
│  Overpayment Tolerance                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ $  │ 5.00                                               │ ││
│  └─────────────────────────────────────────────────────────────┘│
│  ⓘ Flag payments this much over the total for review           │
│  Example: If invoice is $100 and customer pays $110,            │
│  you'll get a notification about the $10 extra                  │
│                                                                 │
│  Grace Period for Partial Payments                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 30                                                │ minutes ││
│  └─────────────────────────────────────────────────────────────┘│
│  ⓘ How long to wait for remaining payment before expiring      │
│                                                                 │
│                                          [Save Changes]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements:**
- Number inputs with currency prefix ($)
- Clear help text with real examples
- Minutes suffix for grace period
- Default values pre-filled (1, 5, 30)

---

## Screen 2: Create Payment Link Page (Missing Fields)

The current "Create Payment Link" form needs additional fields.

### What's Missing:

```
┌─────────────────────────────────────────────────────────────────┐
│  CREATE PAYMENT LINK                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Existing fields: Description, Amount, Customer Email, etc.]   │
│                                                                 │
│  ─────────────── NEW FIELDS NEEDED BELOW ──────────────────     │
│                                                                 │
│  ACCEPTED CRYPTOCURRENCIES                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  [✓] ₿  Bitcoin (BTC)        [✓] Ξ  Ethereum (ETH)      │   │
│  │                                                          │   │
│  │  [✓] ◎  Tron (TRX)           [✓] Ł  Litecoin (LTC)      │   │
│  │                                                          │   │
│  │  [✓] Ð  Dogecoin (DOGE)      [ ] ₿  Bitcoin Cash        │   │
│  │                                   ↳ Configure wallet →    │   │
│  │                                                          │   │
│  │  [✓] ₮  USDT (TRC20)         [✓] ₮  USDT (ERC20)        │   │
│  │                                                          │   │
│  │  [✓] $  USDC (ERC20)                                    │   │
│  │                                                          │   │
│  │  ────────────────────────────────────────────────────    │   │
│  │  ✓ 8 of 9 currencies selected    [Select All] [Clear]   │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ⓘ Customer will choose their preferred crypto at checkout     │
│                                                                 │
│                                                                 │
│  TAX OPTIONS                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Apply tax to this payment link    [○======    ] OFF      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  When toggled ON, show tax preview:                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Using company tax rate: 23% IVA (Portugal)             │   │
│  │                                                          │   │
│  │   Payment Amount: $100.00                                │   │
│  │   Tax (23%):      $23.00                                 │   │
│  │   ────────────────────────                               │   │
│  │   Customer Pays:  $123.00                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [Create Payment Link]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements for Currency Selection:**
- Visual cards/chips with crypto logos
- Checkboxes for multi-select
- Disabled state for wallets not configured (grayed out with "Configure wallet" link)
- Counter showing "X of Y selected"
- Quick actions: Select All / Clear All
- At least 1 currency must be selected (validation)

**Key elements for Tax Toggle:**
- Simple ON/OFF switch
- Shows company's tax rate when enabled
- Real-time calculation preview
- Badge showing this is using company default

---

## Screen 3: Edit Payment Link Page (NEW SCREEN NEEDED)

**What is it?**
Merchants need to edit payment links they've already created.

**Current situation:** No edit screen exists. Merchants can only view or delete.

### Design needed:

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Payment Links                                        │
│                                                                 │
│  EDIT PAYMENT LINK                                              │
│  Link ID: PAY-2024-001234                        Status: ACTIVE │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Description                          ← (Changed)               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Website subscription - Annual plan                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Amount                                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ $  │ 299.00                                             │ ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Customer Email                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ customer@example.com                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [All the same fields as Create form...]                        │
│                                                                 │
│  Apply Tax                             ← (Changed)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Include tax in total            [======○    ] ON         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ⚠️  This is an active payment link. Changes may affect         │
│     customers who have received this link.                      │
│                                                                 │
│          [Cancel]                        [Save Changes]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements:**
- Pre-fill all fields with current values
- Highlight changed fields (yellow background or "Changed" badge)
- Show Link ID and Status (Active/Expired/Paid)
- Warning message for active links
- "Cancel" and "Save Changes" buttons
- Confirmation popup before saving: "Are you sure you want to update this active payment link?"

**Special states:**

For PAID or EXPIRED links, show read-only view:
```
┌─────────────────────────────────────────────────────────────────┐
│  VIEW PAYMENT LINK (Read Only)                                  │
│  Link ID: PAY-2024-001234                         Status: PAID  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⓘ This payment link has been completed and cannot be edited   │
│                                                                 │
│  [All fields shown but grayed out and not editable]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen 4: Pay Links List Page (Add Edit Button)

The current payment links table needs an "Edit" button.

```
┌─────────────────────────────────────────────────────────────────┐
│  PAYMENT LINKS                                 [+ Create New]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  #   Description          Amount    Status    Created    Action │
│  ─── ──────────────────── ──────── ───────── ────────── ─────── │
│  1   Annual subscription  $299.00  🟢 Active  Jan 15    [Edit]  │
│                                                         [View]  │
│                                                         [Copy]  │
│                                                         [Delete]│
│                                                                 │
│  2   One-time purchase    $49.99   🔵 Paid   Jan 10    [View]  │
│                                                         [Copy]  │
│                                                                 │
│  3   Consultation fee     $150.00  🔴 Expired Jan 5    [View]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rules:**
- ACTIVE links: Show Edit, View, Copy Link, Delete buttons
- PAID links: Show View, Copy Link only (no Edit or Delete)
- EXPIRED links: Show View only

---

## Summary of What's Needed

| Screen | Priority | What to Design |
|--------|----------|----------------|
| Company Settings | HIGH | Add 3 new sections: Webhooks, Tax, Thresholds |
| Create Payment Link | HIGH | Add currency selector + tax toggle |
| Edit Payment Link | HIGH | New screen (copy Create form, add edit features) |
| Payment Links List | MEDIUM | Add Edit button with proper states |

---

## Questions?

Let me know if you need:
- More details on any screen
- User flow diagrams
- Examples from similar apps
- Clarification on any feature

Thanks!
Development Team
