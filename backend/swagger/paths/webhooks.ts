export const webhookPaths = {
  '/api/webhooks': {
    get: {
      tags: ['📡 Webhooks'],
      summary: 'Webhook Documentation',
      description: `# Webhook Events & Payloads

DynoPay sends webhook notifications to your configured URL when payment events occur.

---

## 📌 How to Configure Webhooks

### Option 1: Per-Payment Link
Set \`webhook_url\` when creating a payment link:
\`\`\`json
POST /api/pay/createPaymentLink
{
  "amount": 100,
  "currency": "USD",
  "modes": ["CRYPTO"],
  "webhook_url": "https://yourapp.com/webhooks/dynopay"
}
\`\`\`

### Option 2: Company Default
Set default webhook URL for all payments:
\`\`\`json
PUT /api/company/webhook-settings/{company_id}
{
  "webhook_url": "https://yourapp.com/webhooks/dynopay",
  "webhook_secret": "generate"
}
\`\`\`

---

## 🔒 Webhook Security

All webhooks include these headers for verification:

| Header | Description |
|--------|-------------|
| \`X-DynoPay-Event\` | Event type (e.g., \`payment.confirmed\`) |
| \`X-DynoPay-Signature\` | HMAC-SHA256 signature (if webhook_secret configured) |
| \`X-DynoPay-Timestamp\` | Unix timestamp of the request |
| \`X-DynoPay-Webhook-Id\` | Unique delivery ID for idempotency |

### Verifying Signatures
\`\`\`javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
\`\`\`

---

## 📨 Webhook Events

DynoPay sends these webhook events:

| Event | Description |
|-------|-------------|
| \`payment.pending\` | Payment detected on blockchain, awaiting confirmations |
| \`payment.confirmed\` | Payment fully confirmed and processed |
| \`payment.underpaid\` | Partial payment received, awaiting remainder |

---

## 📦 Webhook Payloads

See the response examples below for detailed payload structures.`,
      responses: {
        200: {
          description: 'Webhook payload examples',
          content: {
            'application/json': {
              examples: {
                'payment.pending': {
                  summary: '🟡 payment.pending - Transaction Detected',
                  description: 'Sent when a crypto transaction is detected on the blockchain but not yet confirmed',
                  value: {
                    event: 'payment.pending',
                    address: '0x1234567890abcdef1234567890abcdef12345678',
                    txId: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
                    amount: 0.042,
                    currency: 'ETH',
                    payment_id: 'pay_7668e15b-7f61-4bab-b123-abc123def456',
                    status: 'pending',
                    base_amount: 100,
                    base_currency: 'USD',
                    customer_name: 'John Doe',
                    customer_email: 'john@example.com',
                    description: 'Order #12345 - Premium Subscription',
                    link_id: 411,
                    fee_payer: 'company',
                    timestamp: '2026-02-04T13:02:27.843Z'
                  }
                },
                'payment.confirmed': {
                  summary: '✅ payment.confirmed - Payment Completed',
                  description: 'Sent when payment is fully confirmed and processed. This is the most important webhook for fulfilling orders.',
                  value: {
                    event: 'payment.confirmed',
                    payment_id: 'pay_7668e15b-7f61-4bab-b123-abc123def456',
                    transaction_reference: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
                    status: 'processing',
                    amount: 0.042,
                    currency: 'ETH',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 0.0399,
                    total_fee: 0.0021,
                    total_fee_usd: 5.00,
                    fee_payer: 'company',
                    customer_name: 'John Doe',
                    customer_email: 'john@example.com',
                    description: 'Order #12345 - Premium Subscription',
                    link_id: 411,
                    tax_info: null,
                    overpayment: null,
                    meta_data: {
                      order_id: '12345',
                      customer_ref: 'CUST-001'
                    },
                    completed_at: '2026-02-04T13:02:37.960Z'
                  }
                },
                'payment.confirmed_with_tax': {
                  summary: '✅ payment.confirmed - With Tax Applied',
                  description: 'Example when tax was applied to the payment (e.g., EU VAT)',
                  value: {
                    event: 'payment.confirmed',
                    payment_id: 'pay_8899aabb-ccdd-eeff-0011-223344556677',
                    transaction_reference: '0xdef789...',
                    status: 'processing',
                    amount: 0.052,
                    currency: 'ETH',
                    base_amount: 100,
                    base_currency: 'EUR',
                    merchant_amount: 0.0399,
                    total_fee: 0.0021,
                    total_fee_usd: 5.00,
                    fee_payer: 'customer',
                    customer_name: 'Maria Silva',
                    customer_email: 'maria@example.pt',
                    description: 'Subscription Payment',
                    link_id: 422,
                    tax_info: {
                      tax_amount_usd: 23.00,
                      tax_amount_crypto: 0.0097,
                      tax_rate: 23,
                      tax_country_code: 'PT'
                    },
                    overpayment: null,
                    meta_data: null,
                    completed_at: '2026-02-04T14:15:00.000Z'
                  }
                },
                'payment.confirmed_with_overpayment': {
                  summary: '✅ payment.confirmed - Customer Overpaid',
                  description: 'Example when customer sent more crypto than required',
                  value: {
                    event: 'payment.confirmed',
                    payment_id: 'pay_1122aabb-ccdd-eeff-0011-223344556677',
                    transaction_reference: '0xghi012...',
                    status: 'processing',
                    amount: 0.055,
                    currency: 'ETH',
                    base_amount: 100,
                    base_currency: 'USD',
                    merchant_amount: 0.0499,
                    total_fee: 0.0021,
                    total_fee_usd: 5.00,
                    fee_payer: 'company',
                    customer_name: 'Bob Wilson',
                    customer_email: 'bob@example.com',
                    description: 'One-time Purchase',
                    link_id: 433,
                    tax_info: null,
                    overpayment: {
                      amount_crypto: 0.003,
                      amount_usd: 7.50
                    },
                    meta_data: null,
                    completed_at: '2026-02-04T15:30:00.000Z'
                  }
                },
                'payment.underpaid': {
                  summary: '⚠️ payment.underpaid - Partial Payment',
                  description: 'Sent when customer sends less than the required amount. A 30-minute grace period is given to complete the payment.',
                  value: {
                    event: 'payment.underpaid',
                    address: '0x1234567890abcdef1234567890abcdef12345678',
                    txId: '0xpartial123...',
                    amount_received: 0.030,
                    amount_expected: 0.042,
                    amount_remaining: 0.012,
                    currency: 'ETH',
                    payment_id: 'pay_underpaid-1234-5678-abcd-ef0123456789',
                    status: 'underpaid',
                    base_amount: 100,
                    base_currency: 'USD',
                    customer_name: 'Jane Smith',
                    customer_email: 'jane@example.com',
                    description: 'Monthly Plan',
                    link_id: 444,
                    fee_payer: 'company',
                    grace_period_minutes: 30,
                    timestamp: '2026-02-04T16:00:00.000Z'
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/webhooks/fields': {
    get: {
      tags: ['📡 Webhooks'],
      summary: 'Webhook Field Reference',
      description: `# Webhook Field Reference

Complete reference of all fields included in webhook payloads.

---

## Core Fields (All Events)

| Field | Type | Description |
|-------|------|-------------|
| \`event\` | string | Event type: \`payment.pending\`, \`payment.confirmed\`, \`payment.underpaid\` |
| \`payment_id\` | string | Unique payment identifier |
| \`status\` | string | Current payment status |
| \`amount\` | number | Amount in cryptocurrency |
| \`currency\` | string | Cryptocurrency code (ETH, BTC, etc.) |
| \`timestamp\` / \`completed_at\` | string | ISO 8601 timestamp |

---

## Enhanced Fields (Added Feb 2026)

These fields provide complete transaction visibility for accounting and reconciliation:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| \`merchant_amount\` | number | Net amount merchant receives (crypto) | \`0.0399\` |
| \`total_fee\` | number | Total fees deducted (crypto) | \`0.0021\` |
| \`total_fee_usd\` | number | Total fees in USD | \`5.00\` |
| \`fee_payer\` | string | Who paid fees: \`"customer"\` or \`"company"\` | \`"company"\` |
| \`customer_name\` | string\\|null | Customer name (if provided) | \`"John Doe"\` |
| \`customer_email\` | string\\|null | Customer email | \`"john@example.com"\` |
| \`description\` | string\\|null | Payment description | \`"Order #12345"\` |
| \`link_id\` | number\\|null | Payment link ID | \`411\` |
| \`base_amount\` | number | Original amount in fiat | \`100\` |
| \`base_currency\` | string | Fiat currency code | \`"USD"\` |

---

## Conditional Fields

### tax_info (object | null)
Present when tax was applied to the payment:

| Field | Type | Description |
|-------|------|-------------|
| \`tax_amount_usd\` | number | Tax amount in USD |
| \`tax_amount_crypto\` | number | Tax amount in cryptocurrency |
| \`tax_rate\` | number | Tax percentage (e.g., 23 for 23%) |
| \`tax_country_code\` | string | ISO country code (e.g., "PT") |

### overpayment (object | null)
Present when customer sent more than required:

| Field | Type | Description |
|-------|------|-------------|
| \`amount_crypto\` | number | Overpayment amount in crypto |
| \`amount_usd\` | number | Overpayment amount in USD |

### meta_data (object | null)
Custom metadata passed when creating the payment link.

---

## Underpaid-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| \`amount_received\` | number | Amount received so far (crypto) |
| \`amount_expected\` | number | Total amount expected (crypto) |
| \`amount_remaining\` | number | Remaining amount needed (crypto) |
| \`grace_period_minutes\` | number | Minutes left to complete payment |`,
      responses: {
        200: {
          description: 'Field reference documentation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'See description for field reference' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/webhooks/integration-guide': {
    get: {
      tags: ['📡 Webhooks'],
      summary: 'Webhook Integration Guide',
      description: `# Webhook Integration Guide

Step-by-step guide to integrate DynoPay webhooks into your application.

---

## 1️⃣ Create a Webhook Endpoint

\`\`\`javascript
// Express.js example
app.post('/webhooks/dynopay', express.json(), (req, res) => {
  const event = req.headers['x-dynopay-event'];
  const signature = req.headers['x-dynopay-signature'];
  const payload = req.body;

  // Verify signature (recommended)
  if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Handle events
  switch (event) {
    case 'payment.pending':
      console.log('Payment pending:', payload.payment_id);
      // Update order status to "processing"
      break;

    case 'payment.confirmed':
      console.log('Payment confirmed:', payload.payment_id);
      console.log('Merchant receives:', payload.merchant_amount, payload.currency);
      console.log('Fee charged:', payload.total_fee_usd, 'USD');
      // Fulfill order, send confirmation email
      break;

    case 'payment.underpaid':
      console.log('Underpaid:', payload.amount_remaining, 'remaining');
      // Notify customer to send remaining amount
      break;
  }

  // Always respond 200 to acknowledge receipt
  res.status(200).send('OK');
});
\`\`\`

---

## 2️⃣ Configure Your Webhook URL

### Via API (Recommended for automation)
\`\`\`bash
curl -X PUT "https://api.dynopay.com/api/company/webhook-settings/YOUR_COMPANY_ID" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "webhook_url": "https://yourapp.com/webhooks/dynopay",
    "webhook_secret": "generate"
  }'
\`\`\`

### Via Dashboard
1. Go to Settings → Webhooks
2. Enter your webhook URL
3. Click "Generate Secret" for signature verification
4. Save settings

---

## 3️⃣ Handle Order Fulfillment

\`\`\`javascript
async function handlePaymentConfirmed(payload) {
  const {
    payment_id,
    merchant_amount,
    total_fee_usd,
    customer_name,
    customer_email,
    description,
    link_id,
    meta_data
  } = payload;

  // 1. Find the order using link_id or meta_data
  const order = await Order.findOne({
    where: { payment_link_id: link_id }
  });

  // 2. Update order with payment details
  await order.update({
    status: 'paid',
    payment_id: payment_id,
    amount_received: merchant_amount,
    fee_charged: total_fee_usd,
    paid_at: new Date()
  });

  // 3. Send confirmation email
  await sendEmail({
    to: customer_email,
    subject: 'Payment Confirmed',
    body: \`Hi \${customer_name}, your payment for \${description} is confirmed!\`
  });

  // 4. Trigger fulfillment
  await fulfillOrder(order.id);
}
\`\`\`

---

## 4️⃣ Best Practices

### Idempotency
Use \`X-DynoPay-Webhook-Id\` to prevent duplicate processing:

\`\`\`javascript
const processedWebhooks = new Set();

app.post('/webhooks/dynopay', (req, res) => {
  const webhookId = req.headers['x-dynopay-webhook-id'];
  
  if (processedWebhooks.has(webhookId)) {
    return res.status(200).send('Already processed');
  }
  
  processedWebhooks.add(webhookId);
  // Process webhook...
});
\`\`\`

### Async Processing
For long operations, respond quickly and process async:

\`\`\`javascript
app.post('/webhooks/dynopay', (req, res) => {
  // Respond immediately
  res.status(200).send('OK');
  
  // Process in background
  processWebhookAsync(req.body).catch(console.error);
});
\`\`\`

### Retry Handling
DynoPay retries failed webhooks with exponential backoff:
- Retry 1: 1 minute
- Retry 2: 5 minutes  
- Retry 3: 30 minutes
- Retry 4: 2 hours
- Retry 5: 24 hours

Always respond with 2xx status to acknowledge receipt.`,
      responses: {
        200: {
          description: 'Integration guide',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'See description for integration guide' }
                }
              }
            }
          }
        }
      }
    }
  }
};
