# ✅ Step-by-Step: Register & Get Token via Swagger UI

## Yes! You Can Register Directly in Swagger UI

Follow these simple steps:

---

## Step 1: Open Swagger UI

Go to: https://rlusd-erc20-deploy.preview.emergentagent.com/api/docs

---

## Step 2: Find the Registration Endpoint

1. Scroll down to the **"User Management"** section (or search for "register")
2. Find the endpoint: **`POST /api/user/registerUser`**
3. Click on it to expand

---

## Step 3: Try It Out

1. Click the **"Try it out"** button (on the right side)
2. You'll see an editable request body

---

## Step 4: Fill in Your Details

Replace the example with YOUR information:

```json
{
  "name": "Nomadly Admin",
  "email": "your-email@example.com",
  "password": "YourSecurePassword123"
}
```

**Important:**
- Use a real email address you can remember
- Choose a strong password
- Remember these credentials for future logins!

---

## Step 5: Execute

Click the blue **"Execute"** button at the bottom

---

## Step 6: Get Your Token

You'll see a response like this:

```json
{
  "message": "Registered Successful!",
  "data": {
    "userData": {
      "user_id": 28,
      "name": "Nomadly Admin",
      "email": "your-email@example.com",
      ...
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwibmFtZSI6Ik5vbWFkbHkgQWRtaW4iLCJlbWFpbCI6InlvdXItZW1haWxAZXhhbXBsZS5jb20iLCJpYXQiOjE3Mzc5ODc2NTQsImV4cCI6MTczODU5MjQ1NH0.abc123def456...",
    "referral_code": "DYNO2026NOM12345"
  }
}
```

**✅ COPY THE ENTIRE `accessToken` VALUE!**

It starts with `eyJ` and is very long (several lines).

---

## Step 7: Authorize in Swagger

1. Scroll back to the **top of the page**
2. Click the **"Authorize"** button (🔓 lock icon in the top-right)
3. A popup will appear with a field labeled **"BearerAuth"**
4. **Paste your entire accessToken** in that field
5. Click **"Authorize"**
6. Click **"Close"**

You should see the lock icon change from 🔓 to 🔒 (now locked/authorized)

---

## Step 8: Test It Works

1. Find **`GET /api/company/getCompany`**
2. Click **"Try it out"**
3. Click **"Execute"**

You should get:
```json
{
  "message": "",
  "data": []
}
```

This means it worked! (Empty array because you have no companies yet)

---

## Step 9: Create Your First Company

Now try **`POST /api/company/addCompany`**:

1. Click **"Try it out"**
2. In the **data** field, paste:
```json
{"company_name":"Nomadly Corp","email":"contact@nomadly.com","mobile":"+1234567890","address_line1":"123 Business St","city":"New York","state":"NY","country":"US","zip_code":"10001"}
```
3. Click **"Execute"**

You should get a success response with your new company details!

---

## Visual Guide

### 1. Find Registration
```
User Management
  ▼ POST /api/user/registerUser    [Try it out]
```

### 2. Fill Details
```
Request body
{
  "name": "Your Name",        ← Change this
  "email": "your@email.com",  ← Change this
  "password": "YourPass123"   ← Change this
}
```

### 3. Get Token from Response
```
Response body
{
  "data": {
    "accessToken": "eyJhbGc..."  ← COPY THIS!
  }
}
```

### 4. Authorize
```
[Top of page]
🔓 Authorize

BearerAuth
Value: eyJhbGc...  ← PASTE HERE

[Authorize] [Close]
```

### 5. You're Done!
```
🔒 Authorize  ← Now shows locked icon
```

---

## If Email Already Exists

If you get an error like "Account Already Exists", use the login endpoint instead:

1. Find **`POST /api/user/login`**
2. **Try it out**
3. Enter:
```json
{
  "email": "your-email@example.com",
  "password": "YourPassword"
}
```
4. **Execute**
5. Copy the **`token`** from the response
6. **Authorize** with that token

---

## Troubleshooting

### "Cannot read accessToken"
- Make sure you copied the ENTIRE token (it's very long)
- Check you copied from the response body, not the request

### "Invalid token format"
- Make sure you pasted JUST the token, nothing else
- No quotes, no spaces before/after
- Token should start with `eyJ`

### "Email already exists"
- Use the login endpoint instead
- Or use a different email address

---

## Summary

1. ✅ Open Swagger
2. ✅ Find `POST /api/user/registerUser`
3. ✅ Try it out, enter your details
4. ✅ Execute
5. ✅ Copy the `accessToken` from response
6. ✅ Click "Authorize" button at top
7. ✅ Paste token, click Authorize → Close
8. ✅ Now you can use ALL endpoints!

**It's that easy!** 🎉
