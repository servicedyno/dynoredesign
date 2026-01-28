# Complete Payment API Endpoints Documentation

## Base URL Structure

```
Development: https://dotenvfix.preview.emergentagent.com/api
Production: [Your production URL]/api
```

---

## 1. PAYMENT LINK ENDPOINTS

### 1.1 Create Payment Link
**Endpoint**: `POST /api/pay/createPaymentLink`

**Authentication**: Required (authMiddleware)

**Description**: Creates a new payment link for customers to make payments

**Request Body**:
```json
{
  "amount": 100,
  "currency": "USD",
  "description": "Payment for services",
  "customer_email": "customer@example.com",
  "customer_name": "John Doe",
  "redirect_url": "https://yoursite.com/success",
  "mode": "CRYPTO" | "FIAT" | "BOTH",
  "metadata": {
    "order_id": "ORD-12345",
    "custom_field": "value"
  }
}
```

**Response**:
```json
{
  "success": true,
  "payment_link": "https://checkout-url.com/pay/abc123",
  "payment_id": "pay_abc123def456",
  "qr_code": "data:image/png;base64,..."
}
```

---

### 1.2 Get Payment Links
**Endpoint**: `GET /api/pay/getPaymentLinks`

**Authentication**: Required

**Description**: Retrieve all payment links for the authenticated user/company

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (active, expired, paid)

**Response**:
```json
{
  "success": true,
  "payment_links": [
    {
      "id": "link_123",
      "amount": 100,
      "currency": "USD",
      "status": "active",
      "created_at": "2026-01-28T10:00:00Z",
      "expires_at": "2026-02-28T10:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10
}
```

---

### 1.3 Get Single Payment Link
**Endpoint**: `GET /api/pay/getPaymentLink/:id`

**Authentication**: Required

**Description**: Get details of a specific payment link

**Response**:
```json
{
  "success": true,
  "payment_link": {
    "id": "link_123",
    "amount": 100,
    "currency": "USD",
    "status": "active",
    "payment_url": "https://checkout.com/pay/abc123",
    "qr_code": "data:image/png;base64,..."
  }
}
```

---

### 1.4 Update Payment Link
**Endpoint**: `PUT /api/pay/updatePaymentLink/:id`

**Authentication**: Required

**Description**: Update an existing payment link

**Request Body**:
```json
{
  "amount": 150,
  "description": "Updated description",
  "status": "active" | "inactive"
}
```

---

### 1.5 Delete Payment Link
**Endpoint**: `DELETE /api/pay/deletePaymentLink/:id`

**Authentication**: Required

**Description**: Delete a payment link

---

## 2. DIRECT PAYMENT ENDPOINTS (API Integration)

### 2.1 Create Payment (Fiat/Crypto)
**Endpoint**: `POST /api/pay/user/createPayment`

**Authentication**: Required (API Key via authMiddleware)

**Middleware**: paymentMiddleware

**Description**: Create a direct payment request via API

**Request Body**:
```json
{
  "customer_email": "customer@example.com",
  "customer_name": "John Doe",
  "amount": 100,
  "currency": "USD",
  "description": "Payment for order #12345",
  "payment_method": "card" | "bank_transfer" | "crypto",
  "redirect_url": "https://yoursite.com/callback",
  "metadata": {
    "order_id": "12345"
  }
}
```

**Response**:
```json
{
  "success": true,
  "transaction_id": "txn_abc123",
  "payment_url": "https://checkout.com/pay/xyz789",
  "status": "pending",
  "amount": 100,
  "currency": "USD"
}
```

---

### 2.2 Create Crypto Payment
**Endpoint**: `POST /api/pay/user/cryptoPayment`

**Authentication**: Required (API Key)

**Middleware**: paymentMiddleware

**Description**: Create a crypto-specific payment

**Request Body**:
```json
{
  "customer_email": "customer@example.com",
  "amount": 0.001,
  "currency": "BTC" | "ETH" | "USDT" | "TRX" | etc.,
  "description": "Crypto payment",
  "callback_url": "https://yoursite.com/webhook",
  "metadata": {}
}
```

**Response**:
```json
{
  "success": true,
  "payment_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "amount": 0.001,
  "currency": "BTC",
  "qr_code": "data:image/png;base64,...",
  "expires_at": "2026-01-28T11:00:00Z"
}
```

---

### 2.3 Add Funds (Top-up)
**Endpoint**: `POST /api/pay/user/addFunds`

**Authentication**: Required

**Middleware**: paymentMiddleware

**Description**: Add funds to user wallet

**Request Body**:
```json
{
  "amount": 100,
  "currency": "USD",
  "payment_method": "card" | "bank_transfer" | "crypto"
}
```

---

### 2.4 Use Wallet Payment
**Endpoint**: `POST /api/pay/user/useWallet`

**Authentication**: Required

**Description**: Pay using wallet balance

**Request Body**:
```json
{
  "amount": 50,
  "currency": "USD",
  "description": "Payment using wallet",
  "recipient_id": "user_123"
}
```

---

## 3. USER MANAGEMENT ENDPOINTS

### 3.1 Create Customer
**Endpoint**: `POST /api/pay/user/createUser`

**Middleware**: userMiddleware

**Description**: Create a customer account via API

**Request Body**:
```json
{
  "email": "customer@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "metadata": {}
}
```

---

## 4. TRANSACTION QUERY ENDPOINTS

### 4.1 Get Transactions
**Endpoint**: `GET /api/pay/user/getTransactions`

**Authentication**: Required

**Description**: Get all transactions for authenticated user

**Query Parameters**:
- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status
- `currency`: Filter by currency
- `from_date`: Start date
- `to_date`: End date

---

### 4.2 Get Single Transaction
**Endpoint**: `GET /api/pay/user/getSingleTransaction/:id`

**Authentication**: Required

**Description**: Get details of specific transaction

---

### 4.3 Get Crypto Transaction
**Endpoint**: `GET /api/pay/user/getCryptoTransaction/:address`

**Authentication**: Required

**Description**: Get crypto transaction by address

---

### 4.4 Get Supported Currencies
**Endpoint**: `GET /api/pay/getSupportedCurrency`

**Authentication**: Required

**Description**: Get list of supported payment currencies

**Response**:
```json
{
  "success": true,
  "currencies": {
    "fiat": ["USD", "EUR", "GBP", "NGN"],
    "crypto": ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20", "TRX", "LTC", "DOGE", "BCH", "USDC-ERC20"]
  }
}
```

---

### 4.5 Get Balance
**Endpoint**: `GET /api/pay/user/getBalance`

**Authentication**: Required

**Description**: Get wallet balance

**Response**:
```json
{
  "success": true,
  "balances": [
    {
      "currency": "USD",
      "available": 1000.50,
      "pending": 50.00
    },
    {
      "currency": "BTC",
      "available": 0.001,
      "pending": 0
    }
  ]
}
```

---

## 5. CHECKOUT ENDPOINTS (Customer-Facing)

These endpoints are used by the checkout page for customer payment flows. They use `customerAuthMiddleware` which validates a customer session token.

### 5.1 Get Payment Data
**Endpoint**: `POST /api/pay/getData`

**Authentication**: None (public, but requires valid payment reference)

**Description**: Retrieves payment session data from Redis to initialize the checkout page. Called when customer lands on a payment link.

**Request Body**:
```json
{
  "data": "abc123xyz"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "amount": 100,
    "base_currency": "USD",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "payment_mode": "createLink",
    "allowedModes": ["CRYPTO", "FIAT"],
    "fee_payer": "company" | "customer"
  }
}
```

---

### 5.2 Add Payment (Initiate Fiat Payment)
**Endpoint**: `POST /api/pay/addPayment`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Initiates a fiat payment (card, bank transfer, mobile money) from the checkout page.

**Request Body**:
```json
{
  "uniqueRef": "customer-abc123xyz",
  "currency": "NGN",
  "amount": 50000,
  "payment_type": "CARD" | "BANK_TRANSFER" | "MOBILE_MONEY",
  "mobile": "+2341234567890",
  "network": "MTN"
}
```

---

### 5.3 Create Crypto Payment (Checkout Address Generation)
**Endpoint**: `POST /api/pay/createCryptoPayment`

**Authentication**: Required (customerAuthMiddleware - customer session token)

**Description**: **This is the primary endpoint used by the checkout page to generate a cryptocurrency address when a customer selects crypto as their payment method.** It reserves an address from the merchant's pool, calculates the required crypto amount based on current exchange rates, and returns the payment address with QR code.

**Request Body**:
```json
{
  "uniqueRef": "customer-abc123xyz",
  "currency": "BTC" | "ETH" | "TRX" | "USDT-TRC20" | "USDT-ERC20" | "LTC" | "DOGE" | "BCH" | "USDC-ERC20",
  "amount": 0.0015
}
```

**Request Fields**:
- `uniqueRef`: The unique reference from the payment session (stored in Redis)
- `currency`: The cryptocurrency selected by the customer
- `amount`: The calculated crypto amount (including fees if customer pays)

**Response**:
```json
{
  "success": true,
  "data": {
    "qr_code": "data:image/png;base64,...",
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
    "temp_id": 12345,
    "is_merchant_pool": true,
    "crypto_amount": 0.0015,
    "merchant_amount_crypto": 0.00145,
    "total_fees_crypto": 0.00005,
    "exchange_rate": 65234.50,
    "fee_payer": "customer" | "company"
  }
}
```

**Response Fields**:
- `qr_code`: Base64 encoded QR code image for the payment address
- `address`: The cryptocurrency address for the customer to send funds to
- `transaction_id`: Unique identifier for tracking this payment
- `temp_id`: Internal ID of the reserved pool address
- `is_merchant_pool`: Flag indicating this is a merchant pool address
- `crypto_amount`: Total crypto amount for the payment
- `merchant_amount_crypto`: Amount the merchant will receive
- `total_fees_crypto`: Fee amount in crypto
- `exchange_rate`: Current exchange rate used for conversion
- `fee_payer`: Who pays the transaction fees

**Flow**:
1. Customer session token is validated via `customerAuthMiddleware`
2. Payment session data is retrieved from Redis using `uniqueRef`
3. Requested currency is validated against merchant's configured wallets
4. An address is reserved from the merchant's pool (`merchantPoolService.reserveAddress`)
5. Crypto amount is calculated using current exchange rates
6. QR code is generated for the address
7. Transaction record is created in the database

**Error Responses**:
- `400`: Currency not available for this payment
- `400`: No wallet address configured for the requested currency
- `401`: Invalid or expired customer session token
- `500`: Internal server error

---

### 5.4 Verify Payment
**Endpoint**: `POST /api/pay/verifyPayment`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Verifies the status of a fiat payment after redirect from payment provider.

---

### 5.5 Verify Crypto Payment
**Endpoint**: `POST /api/pay/verifyCryptoPayment`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Checks the status of a crypto payment by querying the blockchain.

---

### 5.6 Confirm Payment
**Endpoint**: `POST /api/pay/confirmPayment`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Finalizes a payment after successful verification. Updates transaction status.

---

### 5.7 Auth Step
**Endpoint**: `POST /api/pay/authStep`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Handles additional authentication steps (OTP, PIN) for certain payment methods.

---

### 5.8 Get Currency Rates
**Endpoint**: `POST /api/pay/getCurrencyRates`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Gets real-time exchange rates for crypto currencies. Used to display conversion rates on checkout page.

**Request Body**:
```json
{
  "sourceCurrency": "USD",
  "currencies": ["BTC", "ETH", "TRX", "USDT-TRC20"],
  "amount": 100
}
```

**Response**:
```json
{
  "success": true,
  "rates": [
    { "currency": "BTC", "amount": 0.00154, "transferRate": 64935.06 },
    { "currency": "ETH", "amount": 0.0312, "transferRate": 3205.12 }
  ]
}
```

---

### 5.9 Get Network Fees (Public)
**Endpoint**: `GET /api/pay/network-fees`

**Authentication**: None (public)

**Description**: Returns current blockchain network fees for supported cryptocurrencies. Used by checkout page to display expected fees.

---

### 5.10 Calculate Payment Amount
**Endpoint**: `POST /api/pay/calculate-payment`

**Authentication**: None (public)

**Description**: Calculates the total payment amount including fees based on fee_payer mode.

---

### 5.11 Get Balance
**Endpoint**: `GET /api/pay/getBalance`

**Authentication**: Required (customerAuthMiddleware)

**Description**: Gets the customer's wallet balance for use in checkout.

---

## 6. WEBHOOK ENDPOINTS (System Use)

### 5.1 Flutterwave Webhook
**Endpoint**: `POST /api/webhook`

**Description**: Receives payment notifications from Flutterwave

**Authentication**: None (verified via signature)

---

### 5.2 Flutterwave Failed Webhook
**Endpoint**: `POST /api/failed_webhook`

**Description**: Receives failed payment notifications

---

### 5.3 Tatum Webhook
**Endpoint**: `POST /api/tatum-webhook`

**Description**: Receives blockchain notifications from Tatum

---

### 5.4 Tatum Crypto Webhook
**Endpoint**: `POST /api/tatum-crypto-webhook`

**Description**: Receives crypto-specific notifications

---

## 6. INVOICE ENDPOINTS

### 6.1 Get Transaction Invoice
**Endpoint**: `GET /api/transactions/:id/invoice`

**Authentication**: Required

**Description**: Get invoice for a specific transaction

---

### 6.2 Get All Invoices
**Endpoint**: `GET /api/invoices`

**Authentication**: Required

**Description**: Get all invoices for user

---

### 6.3 Get Invoice by ID
**Endpoint**: `GET /api/invoices/:id`

**Authentication**: Required

**Description**: Get specific invoice

---

### 6.4 Download Invoice PDF
**Endpoint**: `GET /api/invoices/:id/pdf`

**Authentication**: Required

**Description**: Download invoice as PDF

---

## 7. PAYMENT METHODS SUMMARY

### Supported Payment Modes:

#### 7.1 CRYPTO Payments
- **BTC** (Bitcoin) - UTXO, batch transfer
- **ETH** (Ethereum) - Account-based
- **LTC** (Litecoin) - UTXO, batch transfer
- **DOGE** (Dogecoin) - UTXO, batch transfer
- **TRX** (Tron) - Account-based
- **BCH** (Bitcoin Cash) - UTXO, batch transfer
- **USDT-TRC20** (Tether on Tron) - Token
- **USDT-ERC20** (Tether on Ethereum) - Token
- **USDC-ERC20** (USD Coin on Ethereum) - Token

#### 7.2 FIAT Payments
- **Card Payments** (Visa, Mastercard)
- **Bank Transfers**
- **Mobile Money** (NGN support)

---

## 8. AUTHENTICATION METHODS

### 8.1 User Authentication (Dashboard)
**Header**: `Authorization: Bearer <user_token>`

**Used for**: Payment links, user transactions, wallet operations

---

### 8.2 API Key Authentication (API Integration)
**Header**: `X-API-Key: <your_api_key>`

**Used for**: Direct API integrations, automated payments

---

## 10. COMPLETE ENDPOINT LIST (Summary)

### Checkout Endpoints (11 endpoints):
1. `POST /api/pay/getData` - Get payment session data
2. `POST /api/pay/addPayment` - Initiate fiat payment
3. `POST /api/pay/createCryptoPayment` - **Generate crypto address** ⭐
4. `POST /api/pay/verifyPayment` - Verify fiat payment
5. `POST /api/pay/verifyCryptoPayment` - Verify crypto payment
6. `POST /api/pay/confirmPayment` - Confirm payment
7. `POST /api/pay/authStep` - Additional auth steps
8. `POST /api/pay/getCurrencyRates` - Get exchange rates
9. `GET /api/pay/network-fees` - Get network fees (public)
10. `POST /api/pay/calculate-payment` - Calculate payment amount
11. `GET /api/pay/getBalance` - Get customer balance

### Payment Creation (4 endpoints):
12. `POST /api/pay/createPaymentLink` - Create payment link
13. `POST /api/pay/user/createPayment` - Direct payment (API)
14. `POST /api/pay/user/cryptoPayment` - Crypto payment (API)
15. `POST /api/pay/user/addFunds` - Add funds

### Payment Management (4 endpoints):
16. `GET /api/pay/getPaymentLinks` - List payment links
17. `GET /api/pay/getPaymentLink/:id` - Get single link
18. `PUT /api/pay/updatePaymentLink/:id` - Update link
19. `DELETE /api/pay/deletePaymentLink/:id` - Delete link

### Transaction Queries (5 endpoints):
20. `GET /api/pay/user/getTransactions` - List transactions
21. `GET /api/pay/user/getSingleTransaction/:id` - Get transaction
22. `GET /api/pay/user/getCryptoTransaction/:address` - Crypto tx
23. `GET /api/pay/getSupportedCurrency` - Supported currencies
24. `GET /api/pay/user/getBalance` - Get balance

### Wallet Operations (1 endpoint):
25. `POST /api/pay/user/useWallet` - Wallet payment

### Invoices (4 endpoints):
26. `GET /api/transactions/:id/invoice` - Get invoice
27. `GET /api/invoices` - List invoices
28. `GET /api/invoices/:id` - Get invoice
29. `GET /api/invoices/:id/pdf` - Download PDF

### User Management (1 endpoint):
30. `POST /api/pay/user/createUser` - Create customer

### Webhooks (4 endpoints - system):
31. `POST /api/webhook` - Flutterwave webhook
32. `POST /api/failed_webhook` - Failed webhook
33. `POST /api/tatum-webhook` - Tatum webhook
34. `POST /api/tatum-crypto-webhook` - Crypto webhook

---

## 10. INTEGRATION EXAMPLES

### Example 1: Create Payment Link
```bash
curl -X POST https://your-api.com/api/pay/createPaymentLink \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "mode": "CRYPTO",
    "description": "Test payment",
    "customer_email": "test@example.com"
  }'
```

### Example 2: Create Crypto Payment
```bash
curl -X POST https://your-api.com/api/pay/user/cryptoPayment \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.001,
    "currency": "BTC",
    "customer_email": "test@example.com",
    "description": "Bitcoin payment"
  }'
```

### Example 3: Get Transactions
```bash
curl -X GET "https://your-api.com/api/pay/user/getTransactions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 11. RESPONSE CODES

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## 12. RATE LIMITS

Default rate limits (configurable per API key):
- **Standard**: 100 requests/minute
- **Premium**: 1000 requests/minute
- **Enterprise**: Custom limits

---

## 13. TESTING

### Test Endpoints:
- `POST /api/test/test-webhook` - Test webhook delivery

### Test Cards (for Fiat payments):
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002

### Test Crypto Addresses:
Available on request for development environment

---

**Total Payment Endpoints**: 30 main endpoints + 4 webhooks = 34 endpoints

**Documentation Version**: 1.0
**Last Updated**: 2026-01-28
