# DynoPay API - Quick Start Guide

## 🚀 Getting Started with the API

### Important: Authentication Required

Most DynoPay API endpoints require authentication using JWT (JSON Web Token). Follow these steps to use the API successfully.

---

## 📋 Step-by-Step Guide

### Step 1: Register or Login

#### Option A: Register a New Account
**Endpoint:** `POST /api/user/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "yourSecurePassword123",
  "mobile": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Option B: Login with Existing Account
**Endpoint:** `POST /api/user/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "yourSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Step 2: Save Your JWT Token

Copy the `token` value from the response. You'll need this for all authenticated requests.

**Example Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE2Nzg5ODc2NTR9.abc123def456
```

---

## 🔐 Using Swagger UI (Interactive API Docs)

### Accessing Swagger UI

Open your browser and navigate to:
```
https://paycycle-2.preview.emergentagent.com/api/docs
```

### Step 1: Authorize in Swagger

1. **Click the "Authorize" button** at the top-right of the Swagger page (it looks like a lock icon 🔓)

2. **Enter your JWT token** in the "BearerAuth" field:
   - **Format:** Just paste the token directly (no "Bearer" prefix needed)
   - **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **Click "Authorize"** button

4. **Click "Close"** to return to the API documentation

### Step 2: Use Any Endpoint

Now all authenticated endpoints will automatically include your JWT token in the Authorization header!

---

## 🏢 Creating a Company Profile

### Endpoint: `POST /api/company/addCompany`

**Important:** This endpoint uses `multipart/form-data` because it can accept an optional company logo image.

### Using Swagger UI:

1. **Make sure you're authenticated** (see above)
2. **Find the `/api/company/addCompany` endpoint**
3. **Click "Try it out"**
4. **Fill in the `data` field** with a JSON string:

```json
{
  "company_name": "Acme Corporation",
  "email": "contact@acme.com",
  "mobile": "+1234567890",
  "address_line1": "123 Main Street",
  "address_line2": "Suite 100",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "zip_code": "10001",
  "vat_number": "US123456789",
  "vat_type": "US"
}
```

**⚠️ Important:** In Swagger UI, you need to provide this as a JSON STRING (with quotes escaped):
```
{"company_name":"Acme Corporation","email":"contact@acme.com","mobile":"+1234567890","address_line1":"123 Main Street","city":"New York","state":"NY","country":"US","zip_code":"10001"}
```

5. **Optionally upload a company logo** in the `image` field
6. **Click "Execute"**

### Using cURL:

```bash
curl -X POST "https://paycycle-2.preview.emergentagent.com/api/company/addCompany" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -F 'data={"company_name":"Acme Corp","email":"contact@acme.com","mobile":"+1234567890","address_line1":"123 Main St","city":"New York","state":"NY","country":"US","zip_code":"10001"}' \
  -F "image=@/path/to/logo.png"
```

### Expected Response:

```json
{
  "success": true,
  "message": "Company created successfully",
  "data": {
    "company_id": 1,
    "company_name": "Acme Corporation",
    "email": "contact@acme.com",
    "mobile": "+1234567890",
    "address_line1": "123 Main Street",
    "city": "New York",
    "vat_verified": false,
    "createdAt": "2025-01-27T10:30:00.000Z"
  }
}
```

---

## 🔧 Using Other HTTP Clients

### Postman

1. **Create a new request**
2. **Set Method:** POST
3. **Set URL:** `https://paycycle-2.preview.emergentagent.com/api/company/addCompany`
4. **Headers Tab:**
   - Add: `Authorization: Bearer YOUR_JWT_TOKEN`
5. **Body Tab:**
   - Select "form-data"
   - Add key: `data`, Value: `{"company_name":"Acme Corp",...}`, Type: Text
   - Add key: `image`, Value: (select file), Type: File (optional)
6. **Click Send**

### Insomnia

Similar to Postman:
1. New Request → POST
2. URL: API endpoint
3. Auth: Bearer Token → Paste your JWT
4. Body: Multipart Form
5. Add fields: `data` (text) and `image` (file)

---

## 📝 Common Issues & Solutions

### Issue 1: "Error: response status is 520"
**Cause:** Authentication token is missing, invalid, or malformed

**Solution:**
- Make sure you've logged in first
- Copy the exact token from the login response
- Authorize in Swagger UI properly
- Check that the token hasn't expired (tokens typically expire after 24 hours)

### Issue 2: "Authentication required. Please provide a valid token"
**Cause:** No Authorization header sent

**Solution:**
- Click the "Authorize" button in Swagger UI
- Enter your JWT token
- Make sure the format is correct (just the token, no "Bearer" prefix in the Swagger UI)

### Issue 3: "Invalid or expired token"
**Cause:** Token has expired or is malformed

**Solution:**
- Login again to get a new token
- Make sure you copied the entire token string

### Issue 4: "User account does not exist"
**Cause:** The user associated with the token was deleted

**Solution:**
- Register a new account
- Login with correct credentials

---

## 🎯 Quick Reference - Key Endpoints

### Authentication
- `POST /api/user/register` - Register new user
- `POST /api/user/login` - Login and get JWT token
- `POST /api/user/forgot-password` - Request password reset
- `POST /api/user/reset-password` - Reset password with token

### Company Management
- `POST /api/company/addCompany` - Create company profile
- `GET /api/company/getCompany` - Get all companies
- `GET /api/company/getCompany/:id` - Get specific company
- `PUT /api/company/updateCompany/:id` - Update company
- `DELETE /api/company/deleteCompany/:id` - Delete company
- `POST /api/company/validateTaxId` - Validate VAT/Tax ID

### Payment Links
- `POST /api/pay/createPaymentLink` - Create payment link
- `GET /api/pay/getPaymentLinks` - Get all payment links
- `GET /api/pay/links/:id` - Get specific payment link
- `PUT /api/pay/links/:id` - Update payment link
- `DELETE /api/pay/deletePaymentLink/:id` - Delete payment link

### Wallets & Transactions
- `GET /api/wallet/getWallet` - Get user wallets
- `POST /api/wallet/addWalletAddress` - Add wallet address
- `POST /api/wallet/getAllTransactions` - Get transactions with filters
- `GET /api/wallet/transaction/:id` - Get transaction details
- `POST /api/wallet/transactions/export` - Export transactions as CSV

---

## 💡 Tips for Success

1. **Always authenticate first** - Most endpoints require a JWT token
2. **Use the Authorize button** - Don't manually add Authorization headers in Swagger
3. **Check required fields** - The API will tell you which fields are mandatory
4. **Save your token** - Keep it somewhere safe during your testing session
5. **Use try-it-out** - Swagger UI has examples built-in

---

## 📞 Need Help?

If you encounter any issues:
1. Check the error message - it usually tells you what's wrong
2. Verify your authentication token is valid
3. Ensure all required fields are provided
4. Check the format of your request data

For additional support, refer to the full API documentation at `/api/docs`
