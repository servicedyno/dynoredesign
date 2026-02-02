# 🔍 Token Debugging Guide

## Please Try Your Request Again

I've added debugging to see what's in your token. Please:

1. **Go to Swagger UI**: https://setup-tooling.preview.emergentagent.com/api/docs

2. **Make sure you're authorized**:
   - Click the "Authorize" button (🔓)
   - Paste your JWT token
   - Click "Authorize" → "Close"

3. **Try GET /api/company/getCompany** 

4. **Let me know** when you've tried it

Then I'll check the logs to see exactly what's in your decoded token and fix the issue.

---

## Alternative: Test with Fresh Token

If you want to test with a fresh token right now, you can:

### Register a New Test User
```bash
POST /api/user/registerUser

Body:
{
  "name": "Test User",
  "email": "test@dynopay.test",
  "password": "Test123456"
}
```

This will return a new token that should work. Copy the `accessToken` from the response.

---

## What I'm Checking

The middleware is now logging:
- What's in the decoded token
- Whether `user_id` field is present
- Why validation is failing

This will help me identify if:
- The token structure is different than expected
- The field name is different (e.g., `userId` vs `user_id`)
- The token is missing required data

Let me know once you've tried the request!
