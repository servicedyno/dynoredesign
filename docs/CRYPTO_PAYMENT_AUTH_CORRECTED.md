# 🔐 Crypto Payment API - CORRECTED Authentication Flow

## ⚠️ IMPORTANT CORRECTION

**I was wrong about authentication!** These endpoints are NOT public. They require proper authentication tokens.

---

## Authentication Flow Explained

### The Real Flow

1. **Merchant creates payment link** (requires User JWT)
2. **Customer visits payment link** (receives special payment token)
3. **Customer uses payment token** to interact with payment endpoints
4. **Payment token is scoped** to that specific transaction

---

## Complete Authenticated Flow

### Step 1: Merchant Creates Payment Link

**Requires:** User JWT token (merchant authentication)

```bash
POST /api/company/addPaymentLink
Authorization: Bearer {USER_JWT_TOKEN}

{
  "company_id": 1,
  "amount": 199.99,
  "currency": "USD",
  "description": "Premium Subscription",
  "customer_email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment link created successfully",
  "data": {
    "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "payment_url": "https://checkout.dynopay.com/pay/a1b2c3d4...",
    "status": "pending"
  }
}
```

---

### Step 2: Customer Opens Payment Link

When customer clicks the payment link, the checkout page calls:

```bash
POST /api/pay/getData

{
  "data": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response includes PAYMENT TOKEN:**
```json
{
  "success": true,
  "data": {
    "amount": 199.99,
    "base_currency": "USD",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  ← PAYMENT TOKEN!
    "payment_mode": "createLink",
    "allowedModes": ["crypto", "card"],
    "fee_payer": "company"
  }
}
```

**This token contains:**
```javascript
{
  email: "customer@example.com",
  ref: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  pathType: "createLink",
  transaction_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### Step 3: Create Crypto Payment (WITH TOKEN!)

**Requires:** Payment token from Step 2

```bash
POST /api/pay/createCryptoPayment
Authorization: Bearer {PAYMENT_TOKEN_FROM_STEP_2}

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "crypto_currency": "BTC",
  "customer_email": "customer@example.com"
}
```

**The middleware validates:**
- ✅ Token is valid JWT
- ✅ Token has `pathType: "createLink"`
- ✅ Token has valid `transaction_id`
- ✅ Payment link exists in database
- ✅ Payment link not expired/deleted

**Response:**
```json
{
  "success": true,
  "message": "Crypto payment initiated",
  "data": {
    "deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "crypto_amount": 0.00456789,
    "usd_amount": 199.99,
    "qr_code": "data:image/png;base64,...",
    "expires_at": "2024-01-15T11:30:00Z"
  }
}
```

---

### Step 4: Verify Payment (WITH TOKEN!)

```bash
POST /api/pay/verifyCryptoPayment
Authorization: Bearer {PAYMENT_TOKEN}

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### Step 5: Confirm Payment (WITH TOKEN!)

```bash
POST /api/pay/confirmPayment
Authorization: Bearer {PAYMENT_TOKEN}

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "crypto_currency": "BTC"
}
```

---

## Authentication Requirements - CORRECTED

| Endpoint | Auth Required | Token Type | Purpose |
|----------|---------------|------------|---------|
| **POST /api/company/addPaymentLink** | ✅ Yes | User JWT | Merchant creates link |
| **POST /api/pay/getData** | ❌ No | None | Gets payment data + token |
| **POST /api/pay/createCryptoPayment** | ✅ Yes | Payment Token | Customer creates payment |
| **POST /api/pay/verifyCryptoPayment** | ✅ Yes | Payment Token | Check payment status |
| **POST /api/pay/confirmPayment** | ✅ Yes | Payment Token | Finalize payment |

---

## Two Types of Tokens

### 1. User JWT Token (Merchant)
```json
{
  "user_id": 28,
  "name": "Merchant Name",
  "email": "merchant@company.com",
  "iat": 1737987654,
  "exp": 1738592454
}
```
**Used for:** Creating payment links, managing company

---

### 2. Payment Token (Customer)
```json
{
  "email": "customer@example.com",
  "ref": "transaction-id",
  "pathType": "createLink",
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "iat": 1737987654
}
```
**Used for:** Making the actual payment (scoped to that transaction)

---

## Security Features

### 1. Scoped Authorization
- Payment token only works for specific transaction
- Can't be used for other payments
- Automatically expires with payment link

### 2. Validation Chain
```
Token → Decode → Check pathType → Verify transaction_id → 
Check DB (link exists) → Allow payment
```

### 3. Prevention
- ❌ Can't create arbitrary payments
- ❌ Can't access other transactions
- ❌ Can't reuse expired tokens
- ❌ Can't bypass merchant's payment link

---

## For Custom UI Integration

### Option 1: Using Payment Links (Recommended)

**Flow:**
1. Merchant: Create payment link (your backend)
2. Customer: Visit link → Get payment token (your frontend)
3. Customer: Use payment token → Complete payment (your UI)

**Your custom UI would:**
```javascript
// 1. Customer arrives at payment page with transaction_id in URL
const txId = getUrlParameter('tx');

// 2. Get payment data and token (no auth needed)
const response = await fetch('/api/pay/getData', {
  method: 'POST',
  body: JSON.stringify({ data: txId })
});

const { token, amount, allowedModes } = response.data;

// 3. Now use this token for all subsequent calls
const cryptoPayment = await fetch('/api/pay/createCryptoPayment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`  // ← Payment token
  },
  body: JSON.stringify({
    transaction_id: txId,
    crypto_currency: 'BTC'
  })
});
```

---

### Option 2: Using API Keys (Direct Integration)

**For direct merchant-to-merchant integrations:**

You would need to check if there's an API key authentication option. Let me verify...

Actually, looking at the routes, the payment endpoints use `customerAuthMiddleware`, not `apiMiddleware`. So API key integration for payments would need to be added if not present.

---

## What About API Keys?

You mentioned API keys - let me check if there's an alternative flow using API keys:

**Current Flow:** Payment Link → Payment Token
**Possible Flow:** API Key → Direct Payment Creation

This would require:
1. Creating a separate route with `apiMiddleware`
2. API key tied to company
3. Direct payment creation without payment link

**This might not be implemented yet!**

---

## Why This Design?

### Security Benefits:
1. **Separation of Concerns:** Merchant auth vs customer payment
2. **Limited Scope:** Token only works for one transaction
3. **Time-Limited:** Expires with payment link
4. **Auditable:** Clear trail of who created what

### Trade-offs:
- More complex flow
- Requires payment link creation first
- Can't create arbitrary payments via API

---

## Common Misunderstanding

### What I Said (WRONG):
> "These are public endpoints, no authentication needed"

### Reality:
> "These require payment tokens that are generated when customer opens a payment link created by authenticated merchant"

---

## Summary

✅ **Merchant Auth:** User JWT → Create payment link
✅ **Customer Auth:** Payment token (from link) → Make payment
✅ **Scoped Security:** Token only valid for specific transaction
✅ **Two-Step Flow:** Merchant creates, customer pays
❌ **Not Public:** All payment endpoints require authentication
❌ **Not API Key:** (at least for current implementation)

**You were absolutely right to question this - proper authentication is critical for payment APIs!**

---

## Next Steps

If you want **direct API key integration** (without payment links):

1. Check if `/api/api/addPayment` endpoint exists with API key auth
2. Or request addition of API key authentication for direct payments
3. This would allow server-to-server payment creation

Let me know if you want me to check for API key payment options!
