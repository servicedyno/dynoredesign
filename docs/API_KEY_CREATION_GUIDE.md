# 🔑 API Keys & Admin Tokens - Complete Guide

## Quick Answer

**NO, they are NOT created automatically when you add a company.**

You must **manually call the endpoint** to create them **AFTER** creating a company.

---

## The Complete Flow

### Step 1: Create a Company (Required First)

**Endpoint:** `POST /api/company/addCompany`

```json
{
  "company_name": "Johnny LTD",
  "email": "contact@johnny.pt",
  "mobile": "+351912345678",
  "address_line1": "Rua Principal 123",
  "city": "Lisbon",
  "country": "PT",
  "zip_code": "1000-001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Company added successfully!",
  "data": {
    "company_id": 1,    ← Save this!
    "company_name": "Johnny LTD",
    ...
  }
}
```

✅ **Company created, but NO API key yet!**

---

### Step 2: Create API Key & Tokens (Separate Call)

**Endpoint:** `POST /api/api/addApi`

**Request Body:**
```json
{
  "company_id": 1,
  "base_currency": "USD",
  "api_name": "Johnny LTD Production API",
  "environment": "production",
  "withdrawal_whitelist": [],
  "permissions": ["payments", "transactions", "webhooks", "wallets"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "API generated successfully!",
  "data": {
    "api_id": 1,
    "apiKey": "U2FsdGVkX18Y1r7820X9rwDR1ENhHV...",    ← Encrypted API Key
    "adminToken": "eyJhbGciOiJIUzI1NiIsInR5cCI...",    ← Customer Token (legacy)
    "admin_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...", ← New Admin Token
    "environment": "production",
    "permissions": ["payments", "transactions", "webhooks", "wallets"],
    "company_name": "Johnny LTD",
    ...
  }
}
```

✅ **Now you have:**
- ✅ API Key (encrypted)
- ✅ Admin Token (JWT)
- ✅ Customer Admin account (auto-created)
- ✅ Customer wallet (auto-created)

---

## What Gets Created Together?

When you call `POST /api/api/addApi`, the following are **automatically created together**:

### 1. API Key
- **Format:** Encrypted string
- **Example:** `U2FsdGVkX18Y1r7820X9rwDR1ENhHV...`
- **Stored in:** `tbl_api` table
- **Used for:** External merchant API calls

### 2. Admin Token (New)
- **Format:** JWT token
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Stored in:** `tbl_api.admin_token` column
- **Used for:** Admin operations
- **Expires:** 365 days

### 3. Customer Admin Account
- **Format:** UUID
- **Stored in:** `tbl_customer` table
- **Name:** `{company_name} admin`
- **Example:** `Johnny LTD admin`
- **Used for:** Customer management

### 4. Customer Wallet
- **Format:** UUID
- **Stored in:** `tbl_customer_wallet` table
- **Currency:** Based on `base_currency` parameter
- **Used for:** Payment processing

### 5. Customer Token (Legacy, still included)
- **Format:** JWT token
- **Stored in:** `tbl_api.adminToken` column (legacy field name)
- **Used for:** Customer authentication (backward compatibility)

---

## Important Details

### API Key Generation Logic

```javascript
// Environment-based prefix
const keyPrefix = environment === 'production' ? 'dpk_live_' : 'dpk_test_';

// Key structure
const keyString = keyPrefix + "DYNOPAY_USER_API-" + JSON.stringify({
  base_currency: "USD",
  company_id: 1,
  adm_id: 28,
  env: "production"
});

// Encryption
const apiKey = encrypt(keyString, process.env.API_SECRET);
```

### Admin Token Generation

```javascript
const adminTokenPayload = {
  api_id: 1,
  company_id: 1,
  user_id: 28,
  type: 'admin_token',
  environment: 'production'
};

const adminToken = jwt.sign(
  adminTokenPayload, 
  process.env.ACCESS_TOKEN_SECRET, 
  { expiresIn: '365d' }
);
```

---

## Environment Types

### Production Environment
```json
{
  "environment": "production",
  "base_currency": "USD"
}
```

**Characteristics:**
- Prefix: `dpk_live_`
- **Requires:** At least 1 wallet address configured
- Real transactions
- No amount limits
- Full functionality

---

### Development Environment (Test Mode)
```json
{
  "environment": "development",
  "base_currency": "USD"
}
```

**Characteristics:**
- Prefix: `dpk_test_`
- **No wallet required**
- Test transactions only
- Restrictions:
  ```json
  {
    "max_amount": 100,
    "allowed_currencies": ["BTC", "ETH", "USDT-TRC20", "TRX", "LTC"],
    "sandbox_mode": true
  }
  ```

---

## Requirements & Validations

### To Create Production API Key:
✅ Company must exist
✅ **At least 1 wallet address must be configured**
✅ Base currency must be specified
✅ Cannot have duplicate (same company + currency + environment)

### To Create Development API Key:
✅ Company must exist
✅ Base currency must be specified
✅ No wallet required (for testing)
✅ Cannot have duplicate (same company + currency + environment)

---

## Use Cases

### API Key (Encrypted String)
```
U2FsdGVkX18Y1r7820X9rwDR1ENhHV...
```

**Used in:**
- External merchant integrations
- Server-to-server API calls
- Header: `x-api-key: {apiKey}`

**Endpoints:**
- POST /api/external/payment
- GET /api/external/transactions
- POST /api/external/webhook

---

### Admin Token (JWT)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Used in:**
- Admin operations
- Company management
- Header: `Authorization: Bearer {admin_token}`

**Endpoints:**
- Admin-specific endpoints
- Management operations

---

### Customer Token (Legacy)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Used in:**
- Customer authentication
- Payment processing
- Backward compatibility

---

## Complete Workflow Example

### 1. Create User Account
```bash
POST /api/user/registerUser
{
  "name": "Johnny",
  "email": "johnny@example.com",
  "password": "SecurePass123"
}
```
Response: JWT token → Use for authorization

---

### 2. Create Company
```bash
POST /api/company/addCompany
Authorization: Bearer {user_jwt_token}
{
  "company_name": "Johnny LTD",
  "email": "contact@johnny.pt",
  ...
}
```
Response: `company_id: 1`

---

### 3. Add Wallet Address (Required for Production)
```bash
POST /api/wallet/addWalletAddress
Authorization: Bearer {user_jwt_token}
{
  "company_id": 1,
  "wallet_type": "BTC",
  "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
}
```

---

### 4. Create API Key & Tokens
```bash
POST /api/api/addApi
Authorization: Bearer {user_jwt_token}
{
  "company_id": 1,
  "base_currency": "USD",
  "environment": "production",
  "api_name": "Johnny LTD Production API",
  "permissions": ["payments", "transactions", "webhooks", "wallets"]
}
```

**Response - All Created Together:**
```json
{
  "apiKey": "U2FsdGVkX...",           ← API Key
  "admin_token": "eyJhbGci...",       ← Admin Token (new)
  "adminToken": "eyJhbGci...",        ← Customer Token (legacy)
  "company_id": 1,
  "api_id": 1,
  "environment": "production",
  "permissions": ["payments", "transactions", "webhooks", "wallets"]
}
```

---

## Managing API Keys

### Get All API Keys
```bash
GET /api/api/getApi
Authorization: Bearer {user_jwt_token}
```

Optional filters:
- `?environment=production`
- `?company_id=1`
- `?status=active`

---

### Get Specific API Key
```bash
GET /api/api/getApi/{api_id}
Authorization: Bearer {user_jwt_token}
```

---

### Regenerate API Key
```bash
POST /api/api/regenerateKey/{api_id}
Authorization: Bearer {user_jwt_token}
```

---

### Toggle API Key Status
```bash
PUT /api/api/toggleStatus/{api_id}
Authorization: Bearer {user_jwt_token}
```

---

### Revoke API Key
```bash
POST /api/api/revoke/{api_id}
Authorization: Bearer {user_jwt_token}
```

---

### Delete API Key
```bash
DELETE /api/api/deleteApi/{api_id}
Authorization: Bearer {user_jwt_token}
```

---

## Summary

| Step | Action | Result |
|------|--------|--------|
| 1️⃣ | Create User | JWT token for authorization |
| 2️⃣ | Create Company | `company_id` |
| 3️⃣ | Add Wallet (if production) | Wallet address configured |
| 4️⃣ | **Call `POST /api/api/addApi`** | **Everything created together:** |
|  |  | ✅ API Key (encrypted) |
|  |  | ✅ Admin Token (JWT) |
|  |  | ✅ Customer Admin Account |
|  |  | ✅ Customer Wallet |
|  |  | ✅ Customer Token (legacy) |

---

## Key Takeaways

❌ **NOT automatic** when company is created
✅ **Manual call** to `POST /api/api/addApi` required
✅ **All tokens created together** in one call
✅ **One API key per** company + currency + environment combo
✅ **Production keys require** wallet addresses
✅ **Development keys** work without wallets (for testing)

---

## Testing in Swagger

1. Create company
2. Get `company_id` from response
3. Find `POST /api/api/addApi`
4. Use this body:
```json
{
  "company_id": 1,
  "base_currency": "USD",
  "environment": "development",
  "api_name": "My Test API"
}
```
5. Execute
6. Get all tokens in response!

🎉 **All created in one call!**
