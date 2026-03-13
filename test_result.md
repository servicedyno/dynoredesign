# DynoPay Backend Test Plan

## Original Problem Statement
User attempted to login using a Gmail address and after it logged in, it auto logged out.

## Root Cause Analysis
1. **Backend Bug (Root Cause):** The `getFeeFreeStatus` controller in `companyController.ts` reads user from `(req as any).user?.user_id` instead of `res.locals.user` (which is where the authMiddleware stores user data). All other controllers correctly use `jwt.decode(res.locals.token)`.
2. **Frontend Bug (Cascading Failure):** The axios response interceptor nukes the entire session (removes localStorage tokens + redirects to /auth/login) when a retried request fails after token refresh, even if the refresh was successful. This means a single broken endpoint can log out the user.

## Fixes Applied
1. **Backend:** Changed `getFeeFreeStatus` to use `jwt.decode(res.locals.token) as IUserType` consistent with all other controllers.
2. **Frontend:** Updated axios interceptor to only clear session when the refresh-token call itself fails (401), NOT when a retried request after successful refresh still fails.

## Testing Protocol
- Backend tests should verify the `/api/company/fee-free-status` endpoint works with valid auth tokens
- Frontend test should verify login flow stays on dashboard after login

## Test Cases
1. Backend: GET /api/company/fee-free-status should return 200 with valid token
2. Backend: GET /api/company/fee-free-status should return 401 without token
3. Frontend: Login flow should persist session after successful login

## Incorporate User Feedback
- N/A
