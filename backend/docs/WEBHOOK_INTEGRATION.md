# DynoPay Webhook Integration Guide

## Overview

DynoPay sends webhook notifications for payment events to your configured webhook URL. This allows your application to react in real-time to payment status changes.

## Events

| Event | Description |
|-------|-------------|
| `payment.pending` | Payment detected on blockchain, waiting for confirmations |
| `payment.confirmed` | Payment fully confirmed and processed |
| `webhook.test` | Test webhook sent via the API |

## Webhook Payload

```json
{
  "event": "payment.confirmed",
  "webhook_id": "550e8400-e29b-41d4-a716-446655440000",
  "sent_at": "2024-01-15T10:30:00.000Z",
  "address": "0x1234...5678",
  "txId": "0xabc...def",
  "amount": "0.00517",
  "currency": "ETH",
  "payment_id": "5d582d6d-8693-42b2-8117-5c236db4a861",
  "merchant_amount": "0.00341297",
  "fees": "0.00175703",
  "fee_payer": "customer",
  "status": "confirmed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-DynoPay-Event` | Event type (e.g., `payment.confirmed`) |
| `X-DynoPay-Signature` | HMAC-SHA256 signature (only if `webhook_secret` configured) |
| `X-DynoPay-Timestamp` | Unix timestamp when webhook was sent |
| `X-DynoPay-Webhook-Id` | Unique ID for this webhook delivery |
| `User-Agent` | `DynoPay-Webhook/1.0` |

## Signature Verification (Optional)

The `webhook_secret` is **optional**. If you don't configure a secret, webhooks will still be sent but without the `X-DynoPay-Signature` header.

To verify webhook authenticity when a secret is configured, compute the HMAC-SHA256 signature and compare it with the `X-DynoPay-Signature` header.

### Node.js Example

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, timestamp, secret) {
  // Reconstruct the signature payload (includes timestamp for replay protection)
  const payloadObj = JSON.parse(payload);
  const signaturePayload = {
    ...payloadObj,
    timestamp: parseInt(timestamp)
  };
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(signaturePayload))
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// Express.js middleware example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-dynopay-signature'];
  const timestamp = req.headers['x-dynopay-timestamp'];
  const payload = req.body.toString();
  
  // Only verify if signature header is present
  if (signature && !verifyWebhookSignature(payload, signature, timestamp, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process the webhook
  const event = JSON.parse(payload);
  console.log('Received event:', event.event);
  
  res.status(200).send('OK');
});
```

## API Endpoints

### Set Webhook URL

```bash
# With signature verification (recommended)
curl -X PUT "https://api.dynopay.com/api/company/webhook-settings/{company_id}" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://your-domain.com/webhook",
    "webhook_secret": "generate"
  }'

# Without signature verification
curl -X PUT "https://api.dynopay.com/api/company/webhook-settings/{company_id}" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://your-domain.com/webhook"
  }'
```

### Get Webhook Settings

```bash
curl -X GET "https://api.dynopay.com/api/company/webhook-settings/{company_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Webhook

```bash
curl -X POST "https://api.dynopay.com/api/company/webhook-test/{company_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Webhook History

```bash
# Get all webhooks (paginated)
curl -X GET "https://api.dynopay.com/api/company/webhook-history/{company_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by status
curl -X GET "https://api.dynopay.com/api/company/webhook-history/{company_id}?status=failed" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by event type
curl -X GET "https://api.dynopay.com/api/company/webhook-history/{company_id}?event_type=payment.confirmed" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Webhook Detail

```bash
curl -X GET "https://api.dynopay.com/api/company/webhook-history/{company_id}/detail/{log_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Webhook Statistics

```bash
# Last 7 days (default)
curl -X GET "https://api.dynopay.com/api/company/webhook-stats/{company_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Custom period (up to 30 days)
curl -X GET "https://api.dynopay.com/api/company/webhook-stats/{company_id}?days=14" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Best Practices

1. **Verify signatures (if configured)** - When using webhook secrets, always verify the signature
2. **Respond quickly** - Return 200 OK within 10 seconds; process asynchronously if needed
3. **Handle duplicates** - Use `webhook_id` for idempotency
4. **Check timestamps** - Reject webhooks with timestamps older than 5 minutes to prevent replay attacks
5. **Use HTTPS** - Only configure HTTPS webhook URLs in production
6. **Monitor delivery** - Use the webhook history and stats APIs to monitor delivery success rates

## Retry Policy

DynoPay will retry failed webhook deliveries up to 3 times with exponential backoff:
- 1st retry: 1 second delay
- 2nd retry: 2 seconds delay
- 3rd retry: 4 seconds delay

Webhooks are considered failed if:
- Connection timeout (10 seconds)
- HTTP 5xx response
- Network errors

Webhooks are NOT retried for:
- HTTP 4xx responses (except 429 Rate Limit)
