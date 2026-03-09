# Dynopay API - Developer Integration Guide

Welcome to the Dynopay API! This guide will help you integrate crypto payments and customer wallet management into your application.

## Table of Contents
- [Quick Start](#quick-start)
- [Common Integration Patterns](#common-integration-patterns)
- [Customer Wallet System](#customer-wallet-system)
- [Best Practices](#best-practices)
- [FAQ](#faq)

---

## Quick Start

### 1. Get Your API Key
1. Log in to your Dynopay dashboard
2. Navigate to the **API** section
3. Click **"Create New Key"**
4. Save your API key securely (it won't be shown again!)

### 2. Make Your First API Call
Create a customer and get their bearer token:

```bash
curl -X POST https://api.dynopay.com/api/user/createUser \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Registered Successful!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "customer_id": "a1b2c3d4-e5f6-..."
  }
}
```

### 3. Create a Payment
Use the customer token to create a checkout payment:

```bash
curl -X POST https://api.dynopay.com/api/user/createPayment \
  -H "x-api-key: your_api_key" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "redirect_uri": "https://yoursite.com/thank-you"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Link Generated!",
  "data": {
    "redirect_url": "https://checkout.dynopay.com/pay?d=abc123...",
    "fee_payer": "company",
    "available_currencies": ["BTC", "ETH", "USDT"]
  }
}
```

**Redirect your customer to `redirect_url`** to complete the payment!

---

## Common Integration Patterns

### Pattern 1: E-commerce Checkout
**Use Case**: Customer buys a product on your website

```javascript
// Node.js example
const axios = require('axios');

async function createCryptoCheckout(customerEmail, customerName, orderAmount, orderId) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  // Step 1: Create/get customer
  const customerRes = await axios.post(`${BASE_URL}/createUser`, {
    name: customerName,
    email: customerEmail
  }, {
    headers: { 'x-api-key': API_KEY }
  });

  const customerToken = customerRes.data.data.token;

  // Step 2: Create checkout payment
  const paymentRes = await axios.post(`${BASE_URL}/createPayment`, {
    amount: orderAmount,
    redirect_uri: `https://yoursite.com/orders/${orderId}/success`,
    webhook_url: 'https://yoursite.com/webhooks/dynopay',
    meta_data: { order_id: orderId }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  // Return checkout URL to redirect customer
  return paymentRes.data.data.redirect_url;
}
```

### Pattern 2: In-App Wallet Top-Up
**Use Case**: Customer adds funds to their wallet balance

```javascript
async function topUpWallet(customerToken, amount) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  const res = await axios.post(`${BASE_URL}/addFunds`, {
    amount: amount,
    redirect_uri: 'https://yourapp.com/wallet',
    fee_payer: 'company' // You pay the fees
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  return res.data.data.redirect_url; // Redirect customer here
}
```

### Pattern 3: Direct Crypto Payment (QR Code)
**Use Case**: Show QR code in your app for crypto payment

```javascript
async function createDirectPayment(customerToken, amount, crypto = 'BTC') {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  const res = await axios.post(`${BASE_URL}/cryptoPayment`, {
    amount: amount,
    currency: crypto, // BTC, ETH, USDT, etc.
    redirect_uri: 'https://yourapp.com/payment/success'
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  // Display QR code and address in your app
  return {
    qrCode: res.data.data.qr_code,        // Base64 image
    address: res.data.data.address,       // Crypto address
    amount: res.data.data.amount,         // Amount in crypto
    transactionId: res.data.data.transaction_id
  };
}
```

---

## Customer Wallet System

Dynopay provides a built-in wallet system where customers can store funds and you can programmatically manage their balances.

### Customer Wallet Flow
1. **Customer adds funds** → `POST /api/user/addFunds` (hosted checkout)
2. **Customer pays from wallet** → `POST /api/user/useWallet` (instant debit)
3. **Admin credits wallet** → `POST /api/admin/customers/:id/credit` (refunds, bonuses)
4. **Admin debits wallet** → `POST /api/admin/customers/:id/debit` (fees, subscriptions)

### Admin Wallet Management (Programmatic)

You can manage customer wallets via API for scenarios like:
- **Refunds**: Credit customer wallet when order is cancelled
- **Subscription fees**: Debit wallet monthly for recurring charges
- **Loyalty bonuses**: Credit wallet as rewards
- **Service fees**: Debit wallet for premium features

#### Credit Customer Wallet
```bash
curl -X POST https://api.dynopay.com/api/admin/customers/123/credit \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "description": "Refund for order #12345"
  }'
```

#### Debit Customer Wallet
```bash
curl -X POST https://api.dynopay.com/api/admin/customers/123/debit \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25.00,
    "description": "Monthly subscription fee"
  }'
```

### Example: Automated Refund System
```javascript
async function processRefund(customerId, orderAmount, orderNumber) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/admin';

  try {
    const res = await axios.post(
      `${BASE_URL}/customers/${customerId}/credit`,
      {
        amount: orderAmount,
        description: `Refund for order #${orderNumber}`
      },
      {
        headers: { 'x-api-key': API_KEY }
      }
    );

    console.log(`Refunded ${res.data.data.amount_credited} to customer ${customerId}`);
    console.log(`New balance: ${res.data.data.new_balance}`);
    
    return res.data.data;
  } catch (err) {
    console.error('Refund failed:', err.response.data.message);
    throw err;
  }
}
```

### Check Customer Balance
```javascript
async function getCustomerBalance(customerToken) {
  const API_KEY = process.env.DYNOPAY_API_KEY;
  const BASE_URL = 'https://api.dynopay.com/api/user';

  const res = await axios.get(`${BASE_URL}/getBalance`, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${customerToken}`
    }
  });

  return res.data.data; // [{ wallet_type: "USD", amount: 150.00 }]
}
```

---

## Best Practices

### 1. Store Customer Tokens Securely
- Store the customer bearer token in your database linked to your user
- Never expose tokens in client-side code
- Use tokens server-side to create payments on behalf of customers

### 2. Handle Webhooks for Payment Status
```javascript
// Express.js webhook handler
app.post('/webhooks/dynopay', (req, res) => {
  const { transaction_id, status, amount, customer_id } = req.body;
  
  if (status === 'completed') {
    // Update order status in your database
    // Credit user account, send confirmation email, etc.
  }
  
  res.status(200).send('OK');
});
```

### 3. Use Meta Data for Tracking
```javascript
// Attach order info to payments
const payment = await createPayment({
  amount: 100,
  meta_data: {
    order_id: 'ORD-123',
    customer_name: 'Jane Doe',
    items: ['Product A', 'Product B']
  }
});
```

### 4. Handle Errors Gracefully
```javascript
try {
  const payment = await createPayment(/* ... */);
} catch (err) {
  if (err.response?.status === 400) {
    // Validation error (e.g., invalid amount)
    console.error(err.response.data.message);
  } else if (err.response?.status === 403) {
    // Auth error (invalid API key or token expired)
    console.error('Authentication failed');
  } else {
    // Server error
    console.error('Payment system temporarily unavailable');
  }
}
```

### 5. Wallet Balance Checks
Before debiting a customer wallet, check balance first:

```javascript
async function chargeSubscription(customerId, subscriptionFee) {
  // Get customer details (includes wallet balance)
  const customer = await getCustomerDetail(customerId);
  const balance = customer.wallet.amount;

  if (balance < subscriptionFee) {
    // Send email asking customer to top up
    await sendTopUpReminder(customer.email);
    return { success: false, reason: 'insufficient_balance' };
  }

  // Debit wallet for subscription
  await debitWallet(customerId, subscriptionFee, 'Monthly subscription');
  return { success: true };
}
```

---

## FAQ

### Q: How do I test payments without real crypto?
**A**: Use the development API key (starts with `dpk_test_`). Development keys are limited to smaller amounts and sandbox mode.

### Q: Can I accept only specific cryptocurrencies?
**A**: Yes! Use the `accepted_currencies` parameter:
```javascript
{
  amount: 50,
  accepted_currencies: ["BTC", "ETH", "USDT"]
}
```

### Q: How long does it take for payments to confirm?
**A**: Crypto payments are forwarded instantly to your wallet. Blockchain confirmations vary by network (BTC ~10min, ETH ~1min, USDT-TRC20 ~3min).

### Q: Can I refund a customer?
**A**: Yes! Credit their wallet using the admin API:
```bash
POST /api/admin/customers/:id/credit
```

### Q: What currencies are supported for wallet balances?
**A**: Wallet balances are stored in your API key's base currency (USD, EUR, GBP, etc.). When customers pay in crypto, it's auto-converted to your base currency.

### Q: How do I get the customer_id for admin wallet operations?
**A**: 
1. Via dashboard: Navigate to Customers page and click on a customer to see their numeric `customer_id`
2. Via API: Use `GET /api/userApi/customers` to list all customers with their IDs
3. From transaction data: The `customer_id` is included in transaction responses

### Q: Can customers have negative wallet balances?
**A**: No. The debit endpoint validates sufficient balance before processing.

### Q: Are wallet operations atomic?
**A**: Yes. All wallet credit/debit operations use database transactions to ensure consistency.

---

## Need Help?

- **Full API Reference**: Visit your Dynopay dashboard → Documentation
- **Support**: Contact support@dynopay.com
- **Dashboard**: https://dashboard.dynopay.com

Happy integrating! 🚀
