# DynoPay Bug Fixes

## Issues Fixed

### 1. Auto-logout after login (waajihamalik@gmail.com)
- **Backend**: `getFeeFreeStatus` in `companyController.ts` used `req.user` instead of `res.locals.user`
- **Frontend**: Axios interceptor nuked session when retried request failed after successful refresh

### 2. Pages showing "An error occurred on client" (/transactions, /developer-keys, /wallet, /pay-links)
- **Root Cause**: `EmptyDataModel` component referenced `theme.palette.background.paper` on line 91 without importing or calling `useTheme()` — caused `ReferenceError: theme is not defined`
- **Fix**: Added `import { useTheme } from "@mui/material/styles"` and `const theme = useTheme()` to the component

## Files Modified
- `/app/backend/controller/companyController.ts` - Fixed getFeeFreeStatus auth
- `/app/axiosConfig.ts` - Fixed interceptor session handling
- `/app/Components/UI/EmptyDataModel/index.tsx` - Added useTheme hook
- `/app/pages/transactions.tsx` - Reverted debug error boundary

## Testing Protocol
- All 4 affected pages verified working via Playwright: /transactions, /developer-keys, /wallet, /pay-links
