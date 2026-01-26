# 🚀 Crypto Payment API - Custom UI Integration Guide

## Overview

DynoPay provides API endpoints to create crypto payments with your own custom UI, without using the hosted checkout page. This allows you to fully customize the payment experience in your app.

---

## Available Endpoints in Swagger UI

### 📍 Where to Find Them

Open Swagger UI: https://secure-wallet-api.preview.emergentagent.com/api/docs

Look for the **"Payment Processing"** section. You should see:

1. **POST /api/pay/getData** - Get payment link data
2. **POST /api/pay/createCryptoPayment** - Create crypto payment (YOUR CUSTOM UI)
3. **POST /api/pay/verifyCryptoPayment** - Verify crypto payment status
4. **POST /api/pay/addPayment** - Create fiat payment
5. **POST /api/pay/verifyPayment** - Verify fiat payment
6. **POST /api/pay/confirmPayment** - Confirm payment
7. **POST /api/pay/getCurrencyRates** - Get exchange rates
8. **GET /api/pay/network-fees** - Get blockchain network fees
9. **POST /api/pay/calculate-payment** - Calculate payment with fees

---

## Complete Flow for Custom Crypto Payments

### Step 1: Create a Payment Link (Optional)

If you want to use payment links, create one first:

```bash
POST /api/company/addPaymentLink
Authorization: Bearer {your_user_jwt_token}

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

### Step 2: Get Payment Data

Get the payment details to show in your UI:

```bash
POST /api/pay/getData

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "amount": 199.99,
    "currency": "USD",
    "description": "Premium Subscription",
    "company_name": "Your Company",
    "supported_currencies": ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20", "TRX", "LTC", "DOGE"],
    "status": "pending"
  }
}
```

### Step 3: Customer Selects Cryptocurrency

In your custom UI, show the available cryptocurrencies and let the customer choose.

### Step 4: Create Crypto Payment (KEY ENDPOINT!)

**This is the main endpoint for custom UI integration:**

```bash
POST /api/pay/createCryptoPayment

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "crypto_currency": "BTC",
  "customer_email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Crypto payment initiated",
  "data": {
    "deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "crypto_currency": "BTC",
    "crypto_amount": 0.00456789,
    "usd_amount": 199.99,
    "exchange_rate": 43750.00,
    "qr_code": "data:image/png;base64,iVBORw0KGgo...",
    "expires_at": "2024-01-15T11:30:00Z",
    "confirmations_required": 1,
    "network": "Bitcoin Mainnet",
    "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### Step 5: Display Payment Info in Your UI

Show the customer:
- Deposit address (with copy button)
- QR code for easy mobile payment
- Crypto amount to send
- USD equivalent
- Expiration time
- Required confirmations

### Step 6: Monitor Payment Status

Poll this endpoint to check if payment has been received:

```bash
POST /api/pay/verifyCryptoPayment

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "confirmations": 0,
    "confirmations_required": 1,
    "transaction_hash": null,
    "message": "Waiting for payment..."
  }
}
```

**Response (Confirmed):**
```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "confirmations": 3,
    "confirmations_required": 1,
    "transaction_hash": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
    "amount_received": 0.00456789,
    "message": "Payment confirmed!"
  }
}
```

### Step 7: Confirm Payment

Once verified, confirm the payment:

```bash
POST /api/pay/confirmPayment

{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "crypto_currency": "BTC"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "amount": 199.99,
    "crypto_amount": 0.00456789,
    "crypto_currency": "BTC"
  }
}
```

---

## Supported Cryptocurrencies

| Currency | Code | Network | Confirmations Required |
|----------|------|---------|----------------------|
| Bitcoin | BTC | Bitcoin Mainnet | 1 |
| Ethereum | ETH | Ethereum Mainnet | 12 |
| USDT (Tron) | USDT-TRC20 | Tron (TRC20) | 20 |
| USDT (Ethereum) | USDT-ERC20 | Ethereum (ERC20) | 12 |
| Tron | TRX | Tron Mainnet | 20 |
| Litecoin | LTC | Litecoin Mainnet | 6 |
| Dogecoin | DOGE | Dogecoin Mainnet | 6 |

---

## Additional Endpoints

### Get Exchange Rates

```bash
POST /api/pay/getCurrencyRates

{
  "base_currency": "USD",
  "crypto_currency": "BTC"
}
```

### Get Network Fees

```bash
GET /api/pay/network-fees?currency=BTC
```

### Calculate Payment Amount

```bash
POST /api/pay/calculate-payment

{
  "amount": 199.99,
  "currency": "USD",
  "crypto_currency": "BTC",
  "include_fees": true
}
```

---

## Sample Custom UI Flow

```javascript
// 1. Customer arrives at your payment page
const paymentData = await fetch('/api/pay/getData', {
  method: 'POST',
  body: JSON.stringify({ transaction_id: txId })
});

// 2. Show crypto selection UI
const selectedCrypto = await showCryptoSelection(['BTC', 'ETH', 'USDT-TRC20']);

// 3. Create crypto payment
const cryptoPayment = await fetch('/api/pay/createCryptoPayment', {
  method: 'POST',
  body: JSON.stringify({
    transaction_id: txId,
    crypto_currency: selectedCrypto,
    customer_email: 'customer@example.com'
  })
});

// 4. Display deposit address & QR code
showDepositInfo({
  address: cryptoPayment.deposit_address,
  qrCode: cryptoPayment.qr_code,
  amount: cryptoPayment.crypto_amount,
  expires: cryptoPayment.expires_at
});

// 5. Poll for payment
const interval = setInterval(async () => {
  const status = await fetch('/api/pay/verifyCryptoPayment', {
    method: 'POST',
    body: JSON.stringify({ transaction_id: txId })
  });
  
  if (status.data.status === 'confirmed') {
    clearInterval(interval);
    
    // 6. Confirm payment
    await fetch('/api/pay/confirmPayment', {
      method: 'POST',
      body: JSON.stringify({
        transaction_id: txId,
        crypto_currency: selectedCrypto
      })
    });
    
    // 7. Show success & redirect
    showSuccess();
    redirectToThankYouPage();
  }
}, 5000); // Check every 5 seconds
```

---

## Using in Swagger UI

### Step 1: Find the Endpoints

1. Open Swagger: https://secure-wallet-api.preview.emergentagent.com/api/docs
2. Scroll to **"Payment Processing"** section
3. You'll see all these endpoints listed

### Step 2: Test the Flow

**Test Endpoint:** `POST /api/pay/createCryptoPayment`

1. Click "Try it out"
2. Enter request body:
```json
{
  "transaction_id": "test-123-456-789",
  "crypto_currency": "BTC",
  "customer_email": "test@example.com"
}
```
3. Click "Execute"

**Note:** Most of these endpoints do NOT require authentication (they're public payment endpoints). Only the payment link management endpoints require user JWT tokens.

---

## Key Differences: Hosted Checkout vs Custom UI

### Hosted Checkout Page
- **URL:** `https://checkout.dynopay.com/pay/{transaction_id}`
- **Use Case:** Quick integration, no custom UI needed
- **Branding:** Limited customization
- **Flow:** Customer redirected to DynoPay's page

### Custom UI Integration (These APIs)
- **Use Case:** Full control over payment experience
- **Branding:** 100% your design
- **Flow:** Customer stays on your website/app
- **Implementation:** Use these API endpoints

---

## Authentication Requirements

| Endpoint | Requires Auth? | Token Type |
|----------|---------------|------------|
| GET /api/company/addPaymentLink | ✅ Yes | User JWT |
| POST /api/pay/getData | ❌ No | Public |
| POST /api/pay/createCryptoPayment | ❌ No | Public |
| POST /api/pay/verifyCryptoPayment | ❌ No | Public |
| POST /api/pay/confirmPayment | ❌ No | Public |
| POST /api/pay/getCurrencyRates | ❌ No | Public |

**Note:** Payment processing endpoints are public because they're used by customers (who don't have JWT tokens).

---

## Why You Might Not See Them

If you don't see these endpoints in Swagger UI:

1. **Scroll Down:** They're in the "Payment Processing" section
2. **Refresh Page:** Try refreshing Swagger UI
3. **Clear Cache:** Clear browser cache and reload
4. **Check URL:** Make sure you're on `/api/docs` not `/docs`

---

## Testing Tips

### Test Payment Flow

1. Create a test payment link first
2. Get the `transaction_id`
3. Call `createCryptoPayment` with that ID
4. You'll get a real deposit address
5. Use a testnet faucet to send test crypto
6. Monitor with `verifyCryptoPayment`

### Development vs Production

**Development Mode:**
- Use test cryptocurrencies
- Lower amounts for testing
- Faster confirmations (sometimes 0 required)

**Production Mode:**
- Real cryptocurrencies
- Real deposit addresses
- Standard confirmation requirements

---

## Common Issues

### "Transaction not found"
- Make sure the transaction_id exists
- Create payment link first

### "Currency not supported"
- Check spelling: "BTC" not "bitcoin"
- Use exact codes from supported list

### "Payment expired"
- Payments expire after 30 minutes
- Create new payment if expired

---

## Summary

✅ **Endpoint:** `POST /api/pay/createCryptoPayment`
✅ **Location:** Swagger UI → "Payment Processing" section
✅ **No Auth Required:** Public payment endpoint
✅ **Purpose:** Custom UI crypto payments
✅ **Response:** Deposit address + QR code
✅ **Flow:** Create → Display → Monitor → Confirm

**These endpoints allow you to build a fully custom payment experience in your app!** 🚀
