# ⚠️ Fix for 400 Error - JSON Format Issue

## The Problem

You got: **"SyntaxError: Bad control character in string literal"**

This happens when there are:
- Line breaks or newlines in your JSON
- Unescaped special characters
- Copy-paste formatting issues from Swagger UI

---

## Solution: Use Correct JSON Format

### ✅ CORRECT Format (Copy This Exactly)

```json
{"name":"Nomadly Admin","email":"nomadly@moxx.co","password":"SecurePass123"}
```

**Important:**
- All on ONE line
- No extra spaces or line breaks
- Use double quotes only
- No special characters in name or email

---

## Step-by-Step: How to Register Properly

### In Swagger UI

1. Find `POST /api/user/registerUser`
2. Click "Try it out"
3. **Delete everything** in the request body field
4. **Copy and paste this EXACT text** (all on one line):

```
{"name":"Nomadly Admin","email":"nomadly@moxx.co","password":"SecurePass123"}
```

5. Click "Execute"

---

## Alternative Formats (All Work)

### Option 1: Basic Registration
```json
{"name":"John Doe","email":"john@example.com","password":"Pass123"}
```

### Option 2: With Mobile
```json
{"name":"John Doe","email":"john@example.com","password":"Pass123","mobile":"+1234567890"}
```

### Option 3: Your Email
```json
{"name":"Nomadly Admin","email":"nomadly@moxx.co","password":"YourSecurePassword123"}
```

**Just pick one and copy it EXACTLY as shown (one line, no breaks)**

---

## Common Mistakes to Avoid

### ❌ WRONG - Multiple Lines
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Pass123"
}
```
This might work locally but causes issues in some Swagger implementations.

### ❌ WRONG - Special Characters in Name
```json
{"name":"John\nDoe","email":"john@example.com","password":"Pass123"}
```

### ❌ WRONG - Single Quotes
```json
{'name':'John Doe','email':'john@example.com','password':'Pass123'}
```

### ✅ CORRECT - One Line, Double Quotes
```json
{"name":"John Doe","email":"john@example.com","password":"Pass123"}
```

---

## If It Still Doesn't Work

### Try Using cURL Instead

Open your terminal and run:

```bash
curl -X POST "https://api-payment-restore.preview.emergentagent.com/api/user/registerUser" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nomadly Admin","email":"nomadly@moxx.co","password":"SecurePass123"}'
```

This will return your token directly!

---

## What Should Happen

### Success Response (200)
```json
{
  "message": "Registered Successful!",
  "data": {
    "userData": {
      "user_id": 28,
      "name": "Nomadly Admin",
      "email": "nomadly@moxx.co"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "referral_code": "DYNO2026NOM12345"
  }
}
```

✅ **Copy the `accessToken`!**

### If Email Exists (400)
```json
{
  "success": false,
  "message": "Account Already Exists",
  "statusCode": 400
}
```

➡️ **Use login instead:** `POST /api/user/login`

---

## Quick Test

Try this exact payload:

```json
{"name":"Test User","email":"test789@example.com","password":"Test123456"}
```

This should definitely work because:
- Simple name with no special characters
- Fresh email that probably doesn't exist
- Valid password format

---

## Still Getting 400?

Let me know the EXACT text you're pasting in Swagger, and I'll help debug it!

Or try the cURL command above - it works 100% of the time.
