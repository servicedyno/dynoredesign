# ✅ Swagger UI Token Persistence - Now Sticky!

## What Was Fixed

### Problem Before
- Every time you refreshed the Swagger UI page, you lost your authorization
- Had to click "Authorize" and paste your JWT token again
- Very annoying for development and testing!

### Solution Applied
Added `persistAuthorization: true` to Swagger UI configuration.

---

## How It Works Now

### 1. Authorize Once
1. Open Swagger UI: https://setup-hub-3.preview.emergentagent.com/api/docs
2. Click "Authorize" (🔓)
3. Paste your JWT token
4. Click "Authorize" → "Close"

### 2. Token Persists!
✅ **Refresh the page** → Token still there!
✅ **Close and reopen** → Token still there!
✅ **Works until** → Token expires or you clear browser storage

---

## Token Persistence Details

### Where is it Stored?
The token is stored in **browser's localStorage**:
```
Key: swagger-ui-authorization
Value: Your JWT token
```

### How Long Does it Last?
- **In Browser:** Until you clear browser data or logout
- **JWT Token:** Until it expires (usually 7 days for user tokens, 365 days for admin tokens)

### What Happens When Token Expires?
- You'll get 401 errors when calling endpoints
- Simply authorize again with a new token (login to get fresh token)
- New token will also persist!

---

## Testing the Feature

### Try This:
1. **Authorize in Swagger** with your JWT token
2. **Call any endpoint** (e.g., `GET /api/company/getCompany`)
3. **Refresh the browser page** (F5 or Ctrl+R)
4. **Call the endpoint again** 
5. ✅ **It works!** No need to re-authorize!

---

## Browser Support

Works in all modern browsers:
- ✅ Chrome
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Opera

---

## When You Need to Re-Authorize

You'll need to authorize again if:
1. **Token expires** (after 7 days for user tokens)
2. **Clear browser data** (cache/cookies/localStorage)
3. **Use incognito/private mode** (doesn't persist across sessions)
4. **Switch browsers** (each browser has its own storage)
5. **Manually logout** from Swagger

---

## Security Considerations

### Is This Safe?
✅ **Yes, for development environments**

The token is stored in localStorage which is:
- Only accessible by the same domain
- Not sent with HTTP requests automatically
- Cleared when you clear browser data

### For Production
⚠️ For production applications (not Swagger):
- Use httpOnly cookies for better security
- Implement refresh token mechanism
- Use short-lived access tokens

**Note:** Swagger UI is for API testing/development, so localStorage is acceptable.

---

## Multiple Tokens for Different Projects

If you work with multiple DynoPay environments:

### Each domain gets its own storage:
- `dev.dynopay.com/api/docs` → Separate token
- `staging.dynopay.com/api/docs` → Separate token
- `prod.dynopay.com/api/docs` → Separate token

They don't interfere with each other! ✅

---

## Clearing Stored Token

### If You Want to Logout or Clear Token:

**Method 1: Click "Logout" in Swagger**
1. Click the "Authorize" button
2. Click "Logout"
3. Token is cleared!

**Method 2: Clear Browser Storage**
1. Open browser DevTools (F12)
2. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Find "Local Storage" → Your domain
4. Delete `swagger-ui-authorization` key

**Method 3: Incognito Mode**
Use incognito/private browsing - no persistence!

---

## Configuration Applied

### In `/app/backend/swagger/index.ts`:

```typescript
export const setupSwagger = (app: Express) => {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "DynoPay API Documentation",
    swaggerOptions: {
      persistAuthorization: true, // ← This makes tokens sticky!
    },
  }));
};
```

---

## Benefits

✅ **Faster Development:** No need to re-authorize after every refresh
✅ **Better UX:** Seamless testing experience
✅ **Time Saved:** No more copying and pasting tokens repeatedly
✅ **Workflow Improvement:** Focus on testing, not authentication
✅ **Automatic:** Works without any user action after initial authorization

---

## Common Questions

### Q: Will my token work forever?
**A:** No, it expires based on the JWT expiration time:
- User tokens: 7 days
- Admin tokens: 365 days

After expiration, you'll need to login again and get a new token.

---

### Q: What if I use multiple devices?
**A:** Each device/browser has its own storage. You'll need to authorize on each device, but each will persist independently.

---

### Q: Can others access my token?
**A:** Only if they have access to your computer and browser. localStorage is isolated per domain and not accessible from other websites.

---

### Q: Does this work in mobile browsers?
**A:** Yes! Works on mobile browsers (Chrome, Safari, Firefox mobile).

---

### Q: What about API calls from code?
**A:** This only affects Swagger UI in the browser. Your code/scripts still need to include the Authorization header in each request as usual.

---

## Summary

| Before | After |
|--------|-------|
| ❌ Token lost on refresh | ✅ Token persists on refresh |
| ❌ Re-authorize every time | ✅ Authorize once, works everywhere |
| ❌ Copy-paste repeatedly | ✅ One-time authorization |
| ❌ Annoying workflow | ✅ Smooth development experience |

---

## Try It Now!

1. **Open Swagger UI**
2. **Authorize** with your token
3. **Refresh the page** (F5)
4. **Try an endpoint**
5. 🎉 **It works without re-authorizing!**

**Your token is now sticky - enjoy the improved workflow!** 🚀
