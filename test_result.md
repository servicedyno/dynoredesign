backend:
  - target_url: https://initial-config-19.preview.emergentagent.com/api
  - test_endpoints:
    - POST /api/public/create-trial-link: Create trial link with provisional account (body: {amount: "10", currency: "USD", email: "test-trial-xyz123@mailinator.com"})
    - GET /api/public/trial/{slug}: Get trial link details (use slug from create response)
    - POST /api/public/create-trial-link (reuse email): Test reusing provisional user with same email
  - test_results:
    - ✅ POST /api/public/create-trial-link: PASSED - Status 201, returned checkout_url with /pay?d=, slug, accepted_currencies=["BTC"], manage_url
    - ✅ GET /api/public/trial/{slug}: PASSED - Status 200, returned checkout_url (non-null) and trial link details
    - ✅ POST /api/public/create-trial-link (reuse email): PASSED - Status 201, successfully reused provisional user for same email
  - expected_behaviors: ✅ ALL VERIFIED
    - create-trial-link returns 201 with checkout_url, slug, and accepted_currencies=["BTC"] ✅
    - The response includes checkout_url pointing to /pay?d={ref} ✅
    - get trial link returns checkout_url in response data ✅
    - Creating a trial link with same email reuses provisional user (no error) ✅

frontend:
  - target_url: https://initial-config-19.preview.emergentagent.com
  - not testing frontend at this time

## Testing Protocol
1. ALWAYS start by reading this file
2. Run ONLY the tests specified above
3. After testing, update this file with results
4. Do NOT modify application code
5. Do NOT restart services
6. Report exact error messages and status codes

## Test Results Summary
- **Backend API Tests**: 3/3 PASSED ✅
- **All trial payment link endpoints working correctly**
- **Provisional user creation and reuse working as expected**
- **Response formats match specifications**

## Incorporate User Feedback
- None at this time
