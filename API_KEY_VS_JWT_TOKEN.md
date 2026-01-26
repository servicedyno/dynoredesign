# 🔑 API Key vs JWT Token - Understanding the Difference

## What You Have

```
U2FsdGVkX18Y1r7820X9rwDR1ENhHV1PMQyOKXFi3x9mgJyh4TRNAkk3aTkA1gu6DThmC/ncmerkXaqFt640z1iSdC6i84p9+OLVrqL2ojp+7CJ5+d5bAy4jaulxC+UG
```

This is an **encrypted API key** - used for external integrations and merchant API calls.

## What You Need

A **JWT token** - used for authenticating in Swagger UI and accessing the dashboard.

---

## The Difference

### 🔵 API Key (What You Have)
- **Format:** Long encrypted string
- **Purpose:** External merchant integrations, server-to-server calls
- **Used in:** `x-api-key` header
- **Get from:** Creating an API key in your company settings
- **Example endpoints:**
  ```
  POST /api/external/payment
  GET /api/external/transactions
  ```

### 🟢 JWT Token (What You Need)
- **Format:** Three parts separated by dots (header.payload.signature)
- **Purpose:** User authentication in dashboard/Swagger
- **Used in:** `Authorization: Bearer <token>` header
- **Get from:** User login or registration
- **Example endpoints:**
  ```
  GET /api/company/getCompany
  POST /api/company/addCompany
  GET /api/dashboard
  ```

---

## How to Get a JWT Token

You need to create a **user account** first. Here's how:

### Step 1: Register a User Account

Use this in Swagger UI:

**Endpoint:** `POST /api/user/registerUser`

**Request Body:**
```json
{
  "name": "Nomadly Admin",
  "email": "nomadly@moxx.co",
  "password": "YourSecurePassword123"
}
```

**Response (Success):**
```json
{
  "message": "Registered Successful!",
  "data": {
    "userData": {
      "user_id": 28,
      "name": "Nomadly Admin",
      "email": "nomadly@moxx.co",
      ...
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwibmFtZSI6Ik5vbWFkbHkgQWRtaW4iLCJlbWFpbCI6Im5vbWFkbHlAbW94eC5jbyIsImlhdCI6MTY3ODk4NzY1NCwiZXhwIjoxNjc5NTkyNDU0fQ.abc123...",
    "referral_code": "DYNO2026NOM12345"
  }
}
```

✅ **Copy the `accessToken`** - This is your JWT token!

---

### Step 2: Use JWT Token in Swagger

1. **Copy the accessToken** from the registration response

2. **Click "Authorize"** button in Swagger UI (🔓 icon at top)

3. **Paste the token** in the "BearerAuth" field:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Click "Authorize"** then **"Close"**

5. **Now you can use all user endpoints!** ✅

---

## If Email Already Exists

If you get "Account Already Exists", login instead:

**Endpoint:** `POST /api/user/login`

**Request Body:**
```json
{
  "email": "nomadly@moxx.co",
  "password": "YourPassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 28,
    "name": "Nomadly Admin",
    ...
  }
}
```

✅ **Copy the `token`** - This is your JWT token!

---

## Visual Comparison

### API Key Format:
```
U2FsdGVkX18Y1r7820X9rwDR1ENhHV1PMQyOKXFi3x9mgJyh4TRNAkk3aTkA1gu6...
```
❌ **This does NOT work in Swagger Authorization**

### JWT Token Format:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwibmFtZSI6Ik5vbWFkbHkgQWRtaW4iLCJlbWFpbCI6Im5vbWFkbHlAbW94eC5jbyIsImlhdCI6MTY3ODk4NzY1NCwiZXhwIjoxNjc5NTkyNDU0fQ.abc123def456...
```
✅ **This WORKS in Swagger Authorization**

Notice the three parts separated by dots (`.`) in JWT tokens!

---

## Quick Action Plan

1. **Open Swagger UI**: https://dynopay-api-test.preview.emergentagent.com/api/docs

2. **Find** `POST /api/user/registerUser`

3. **Try it out** with:
   ```json
   {
     "name": "Your Name",
     "email": "your-email@example.com",
     "password": "SecurePassword123"
   }
   ```

4. **Copy the accessToken** from response

5. **Click Authorize** button and paste the token

6. **Now you're authenticated!** ✅

---

## About Your API Key

Your API key (`U2FsdGVkX18...`) is still valid and useful! It's used for:

- **External merchant integrations**
- **Server-to-server API calls**
- **Webhook callbacks**
- **Third-party integrations**

But it's **NOT used for Swagger UI** authentication. For that, you need a JWT token from user login/registration.

---

## Still Confused?

Think of it this way:

- **API Key** = Your business/company credentials (for your app/server to make API calls)
- **JWT Token** = Your personal login session (for you to access the dashboard/Swagger)

You need both, but for different purposes!

For Swagger UI → **You need a JWT Token** ← Register/Login as a user to get one!
