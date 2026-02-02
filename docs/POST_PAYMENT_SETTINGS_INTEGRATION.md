# Post-Payment Settings Integration Guide

## Overview

This document describes how the post-payment settings (callback_url, redirect_url, webhook_url) work in the DynoPay payment flow.

## URL Types and Their Purpose

| URL | Type | Purpose | Exposed to Checkout? |
|-----|------|---------|---------------------|
| **redirect_url** | Customer-facing | Redirect customer to merchant's site after payment success | ✅ YES |
| **callback_url** | Server-to-server | Instant payment notification (synchronous) | ❌ NO (security) |
| **webhook_url** | Server-to-server | Transaction status updates (async) | ❌ NO (security) |

## Backend API Changes

### 1. Payment Link Creation (`POST /api/pay/createPaymentLink`)

The payment link creation endpoint accepts all 3 URL fields:

```json
{
  "amount": 25,
  "currency": "USD",
  "modes": ["CRYPTO"],
  "company_id": 38,
  "description": "Product purchase",
  "callback_url": "https://merchant.com/api/callback",
  "redirect_url": "https://merchant.com/payment-success",
  "webhook_url": "https://merchant.com/api/webhook"
}
```

### 2. getData Endpoint (`POST /api/pay/getData`)

The getData endpoint now returns `redirect_url` in the response:

```json
{
  "amount": 25,
  "base_currency": "USD",
  "token": "...",
  "payment_mode": "createLink",
  "allowedModes": "CRYPTO",
  "fee_payer": "company",
  "transaction_id": "...",
  "redirect_url": "https://merchant.com/payment-success",
  "merchant": {
    "company_name": "Test Company",
    "company_logo": null
  },
  "fee_info": { ... },
  "expiry": { ... }
}
```

**Security Note:** `callback_url` and `webhook_url` are NOT returned for security reasons.

### 3. Webhook/Callback Delivery

When a payment is confirmed, the backend automatically:

1. Calls `callback_url` (if configured) - instant notification
2. Calls `webhook_url` (if configured and different from callback_url) - transaction updates

Both receive the same payload with HMAC-SHA256 signature (if webhook_secret is configured).

## Checkout Page Integration (DynocheckoutDarkMode)

### Reading redirect_url from getData

The checkout page should read `redirect_url` from the getData response:

```typescript
// In your Redux slice or API handler
interface PaymentData {
  amount: number;
  base_currency: string;
  token: string;
  redirect_url?: string; // Optional - only present if configured
  // ... other fields
}

const getData = async (reference: string): Promise<PaymentData> => {
  const response = await axiosBaseApi.post('/pay/getData', { data: reference });
  return response.data.data;
};
```

### Handling Payment Success

After a successful payment, check if `redirect_url` exists and redirect:

```typescript
// After payment success
const handlePaymentSuccess = (paymentData: PaymentData, transactionId: string) => {
  if (paymentData.redirect_url) {
    // Redirect to merchant's success page with transaction details
    const redirectUrl = new URL(paymentData.redirect_url);
    redirectUrl.searchParams.set('transaction_id', transactionId);
    redirectUrl.searchParams.set('status', 'success');
    
    window.location.href = redirectUrl.toString();
  } else {
    // Show default success page
    router.push('/pay/success');
  }
};
```

### Example Implementation in Success Page

```tsx
// pages/pay/success.tsx
import { useEffect } from 'react';
import { useSelector } from 'react-redux';

const PaymentSuccess = () => {
  const paymentData = useSelector((state) => state.payment.data);
  const transactionId = useSelector((state) => state.payment.transactionId);

  useEffect(() => {
    // Auto-redirect if redirect_url is configured
    if (paymentData?.redirect_url && transactionId) {
      const timer = setTimeout(() => {
        const redirectUrl = new URL(paymentData.redirect_url);
        redirectUrl.searchParams.set('transaction_id', transactionId);
        redirectUrl.searchParams.set('status', 'success');
        window.location.href = redirectUrl.toString();
      }, 3000); // 3 second delay to show success message
      
      return () => clearTimeout(timer);
    }
  }, [paymentData, transactionId]);

  return (
    <div>
      <h1>Payment Successful!</h1>
      {paymentData?.redirect_url && (
        <p>Redirecting to merchant in 3 seconds...</p>
      )}
    </div>
  );
};
```

## Webhook Payload Format

When the backend calls `callback_url` or `webhook_url`, it sends:

```json
{
  "event": "payment.confirmed",
  "payment_id": "uuid-here",
  "transaction_reference": "tx-ref-here",
  "status": "successful",
  "amount": 25.00,
  "currency": "USD",
  "base_amount": 25,
  "base_currency": "USD",
  "meta_data": null,
  "completed_at": "2026-01-31T15:00:00.000Z",
  "webhook_id": "uuid-here",
  "sent_at": "2026-01-31T15:00:01.000Z"
}
```

### Webhook Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | application/json |
| `X-DynoPay-Event` | payment.pending / payment.confirmed |
| `X-DynoPay-Timestamp` | Unix timestamp |
| `X-DynoPay-Webhook-Id` | Unique webhook ID |
| `X-DynoPay-Type` | 'webhook' or 'callback' |
| `X-DynoPay-Signature` | HMAC-SHA256 signature (only if webhook_secret configured) |

## Testing

To test post-payment settings:

1. Create a payment link with URLs configured
2. Visit the payment link in checkout
3. Verify getData returns redirect_url
4. Complete payment
5. Verify redirect happens (or webhooks are called)

## Security Considerations

1. **Never expose** `callback_url` or `webhook_url` to frontend
2. **Always validate** webhook signatures on merchant side
3. **Use HTTPS** for all webhook/callback URLs
4. **Implement idempotency** - webhooks may be retried
