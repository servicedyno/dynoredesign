# 🔍 Token Issue Identified & Resolved

## Problem Found ✅

**Your token is a CUSTOMER token, not a USER token!**

### What I Found in the Logs

Your decoded token contains:
```json
{
  "id": "4f8d8459-d0b4-4d16-9526-ab19a6fc547c",
  "company_id": 3,
  "customer_name": "Nomadly1 admin",
  "email": "nomadly1@moxx.co",
  "mobile": "nomadly1@moxx.co"
}
```

**This is a customer token** (has `id` and `customer_name`) - used for payment processing and customer portal.

### What You Need

To access `/api/company/getCompany`, you need a **USER token** (has `user_id` and `name`) - used for merchant dashboard and company management.

---

## Solution: Get a User Token

### Method 1: Register as a User (Recommended)

**Endpoint:** `POST /api/user/registerUser`

**Request:**
```json
{
  "name": "Your Name",
  "email": "your-email@example.com",
  "password": "YourPassword123"
}
```

**Response:**
```json
{
  "message": "Registered Successful!",
  "data": {
    "userData": {
      "user_id": 27,
      "name": "Your Name",
      "email": "your-email@example.com",
      ...
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

✅ **Copy the `accessToken` from this response!**

---

### Method 2: Login as Existing User

**Endpoint:** `POST /api/user/login`

**Request:**
```json
{
  "email": "your-email@example.com",
  "password": "YourPassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 27,
    "name": "Your Name",
    ...
  }
}
```

✅ **Copy the `token` from this response!**

---

## Using Your User Token in Swagger

1. **Get your user token** (from Method 1 or 2 above)

2. **Open Swagger UI**: https://fix-issues-8.preview.emergentagent.com/api/docs

3. **Click "Authorize"** (🔓 button at top)

4. **Paste your USER token** in the BearerAuth field

5. **Click "Authorize"** then **"Close"**

6. **Now try** `GET /api/company/getCompany` - It will work! ✅

---

## Understanding Token Types

### 🔵 User Tokens (for Merchant Dashboard)
- **Used for:** Company management, dashboard, payment links, settings
- **Has fields:** `user_id`, `name`, `email`
- **Get from:** `/api/user/registerUser` or `/api/user/login`
- **Use on endpoints:** 
  - ✅ `/api/company/*`
  - ✅ `/api/dashboard/*`
  - ✅ `/api/wallet/*`
  - ✅ `/api/pay/*`
  - ✅ `/api/notifications/*`

### 🟢 Customer Tokens (for Payment Processing)
- **Used for:** Making payments, customer portal
- **Has fields:** `id`, `customer_name`, `company_id`
- **Get from:** Payment link flow or customer registration
- **Use on endpoints:**
  - ✅ Customer payment endpoints
  - ✅ Customer transaction history
  - ❌ NOT for company management

---

## Why This Happened

You likely got your token from:
- A payment link
- Customer portal login
- Third-party integration

These generate **customer tokens** for payment processing, not **user tokens** for merchant dashboard access.

---

## Quick Test (Use This Token)

I already created a test user for you earlier:

**Test User Credentials:**
- Email: `testuser@dynopay.com`
- Password: `Test123456`

**To get the token:**
1. Call `POST /api/user/login` with the above credentials
2. Copy the returned token
3. Use it in Swagger

This token will definitely work for company management endpoints!

---

## Better Error Message

Now when you use a customer token on user endpoints, you'll get:
```
"This endpoint requires user authentication. Please login with a user account, not a customer account."
```

This makes it clear what the issue is! 🎯
