# DynoPay - Test Results & Session Tracker

## App Overview
DynoPay is a full-stack crypto payment gateway. 
- **Frontend**: Next.js (port 3000) with MUI components
- **Backend**: Node.js/Express/TypeScript (port 3300 internally, proxied via Python/uvicorn on port 8001)
- **Database**: PostgreSQL (Railway), Redis (Railway), MongoDB (local)

## Current Setup Status
- ✅ Frontend: Running (Next.js on port 3000)
- ✅ Backend: Running (Node.js on port 3300, Python proxy on port 8001)
- ✅ MongoDB: Running

## Pod URL Setup
- **Pod URL**: `https://d1212cb6-41cd-45ac-bf4d-c2e43e1fe47b.preview.emergentagent.com`
- **Frontend** (`/app/.env.local`): `NEXT_PUBLIC_BASE_URL` set to pod URL with trailing slash
- **Frontend** (`/app/frontend/.env`): `REACT_APP_BACKEND_URL` set to pod URL
- **Backend** (`/app/backend/.env`): `SERVER_URL`, `CHECKOUT_URL`, `FRONTEND_URL` all set to pod URL

### Pod URL Migration & Checkout Fix (Current Session)
- Updated all env files from old `pod-pay.preview.emergentagent.com` to current pod URL
- Installed frontend dependencies (`yarn install` at `/app/`)
- Installed backend Node.js dependencies (`yarn install` at `/app/backend/`)
- Fixed Next.js/SWC version mismatch (downgraded next to 14.2.33 to match ARM64 SWC binary)
- **Fixed checkout build errors** caused by stray commas in `sx={{}}` objects across multiple files:
  - `pages/pay/index.tsx` line 732: `sx={{ , fontWeight: 600 }}` → `sx={{ fontWeight: 600 }}`
  - `Components/Page/Pay3Components/bankTransferCompo.tsx` lines 365, 528
  - `Components/Page/Pay3Components/cryptoTransfer.tsx` lines 1395, 1416, 1525, 1710
  - `Components/UI/TransferExpectedCard/Index.tsx` lines 390, 428, 612
  - `Components/UI/OverPayment/Index.tsx` line 460
  - `Components/UI/UnderPayment/Index.tsx` line 382

## Changes Made in Current Session (Phase: Referral, Dark Mode, Translations)

### Dark Mode Fixes
- Fixed 11 SVG icons in `/assets/Icons/home/` - changed hardcoded `stroke="#0004FF"` to `currentColor`
- Fixed `FeatureIcon` and `WhyChooseDynoPayIcon` styled components with proper dark mode color
- Fixed App Header (`Components/Layout/Header`) - dark mode background, borders, hovers
- Fixed 15+ components with hardcoded `#fff` backgrounds → `theme.palette.background.paper`
  - PanelCard, NewHeader, UserMenu, CompanySelector, TimePeriodSelector, FullHeightModal, AreaChart, DashboardRightSection, API styled, AuthLayout/PasswordValidation, CryptocurrencySelector, OnboardingFlow, ApiKeysModel
- Fixed DynoPay logo in NewHeader to swap between dark/white variants based on theme
- Fixed hardcoded `#E9ECF2` borders in DashboardRightSection and CreatePaymentLink

### Translation Fixes
- Phone tab of register page: All strings now use `t()` (Full Name, Phone Number, Password, Send Verification Code, Phone Verification subtitle, password error)
- Email/Phone toggle buttons now translated
- App Header: "My Profile", "Logout", "Hello" now use `t()` from common namespace
- Added missing keys to all 6 locales (en, de, es, fr, nl, pt) in `auth.json` and `common.json`
- Created `referrals.json` for all 6 locales with 35+ keys
- Registered referrals namespace in i18n.js

### Referral System UI
- Added optional "Referral Code" input field to email registration (with collapsible "Have a referral code?" link)
- Added same referral code field to phone registration tab
- Auto-populates referral code from URL query param (`?ref=CODE`)
- Referral code is sent in register payload to backend
- Added optional "Customer Email" field to Create Payment Link form (for sending referral/referee codes)
- Referral page strings now use translations

### 1. Dark/Light Mode Toggle (Landing + In-App)
- Extended existing `ThemeContext` to work globally (was only for checkout pages)
- Created `themeDark` (dark variant of main app theme) in `/app/styles/theme.ts`
- Created `homeThemeDark` in `/app/styles/homeTheme.ts`
- Updated `_app.tsx` to use `AppThemeProvider` globally with theme selection per layout
- Created `ThemeToggle` component at `/app/Components/UI/ThemeToggle/index.tsx`
- Added toggle to `HomeHeader` (landing page) and `NewHeader` (in-app dashboard)
- Theme persists via `localStorage('theme-mode')`

### 2. DE/NL Languages in Switcher
- Created German and Dutch flag images in `/app/assets/Images/Icons/flags/`
- Updated `LanguageSwitcher/index.tsx` to include DE (Deutsch) and NL (Nederlands)
- Updated `MobileNavigationBar/index.tsx` language list with all 6 languages
- DE/NL locale files and i18n config were already in place

### 3. New Company Flow (Removed Old Design)
- Changed "Add Company" button in `CompanySelector` from navigating to `/company` page (old CRUD table design) to using the onboarding-style flow
- Now uses `CreateCompanyModal` → `AddWalletModal` → `CelebrationOverlay` inline
- Same UX as initial onboarding: create company, then prompted to add wallet

### 4. Total Value Bug Fix ($15k → $14k)
- **Root cause**: `useDashboardData` dispatched `DASHBOARD_FETCH` without `company_id` on first render (getting aggregate $15k), then after `CompanySelector` auto-selected a company, re-fetched with company_id (getting $14k for that company)
- **Fix**: Updated `useDashboardData` to only fetch when `selectedCompanyId` is set (or when user has no companies), preventing the flash of aggregate data

### 5. Performance Optimization
- Increased httpx connection pool in Python proxy (100 max connections, 20 keepalive)
- Fixed NewHeader to use `useMuiTheme()` instead of imported static theme (proper reactivity)
- Fixed Home container styled components to use theme from provider instead of static import

### 6. Dark Mode Comprehensive Fix (Complete)
**Root cause**: Styled components across the app imported `homeTheme`/`theme` (light-only static) directly and used hardcoded color literals instead of the dynamic `theme` callback parameter from MUI's `styled()`.

**Phase 1 - Landing Page (styled components)**:
- `SectionTitle/styled.tsx` - Badge, Heading, SubText
- `HomeCard/styled.tsx` - StyledCard gradients, WhyChooseUsCard, + icon brightness filter for dark mode
- `HomeHeader/styled.tsx` - FixedHeader bg, nav links, Sign In, mobile drawer
- `HomeFooter/styled.tsx` - Footer bg conditional dark color
- `HomeButton/styled.tsx` - Primary and outlined buttons
- `Home/styled.tsx` - Section backgrounds and glow effects
- `Home/UseCase.tsx` - Cards, tags, borders
- `UseCaseBanner/index.tsx` - Banner gradient and border
- `LanguageSwitcher/styled.tsx` - Dropdown, trigger, borders, hover states
- `MobileLanguageSwitcher/styled.tsx` - Modal bg, close button
- Static pages: `privacy-policy`, `terms-conditions`, `aml-policy`, `system-status`

**Phase 2 - Logo Visibility**:
- `HomeHeader/index.tsx` - Switches to white logo (`dynopay-whiteLogo.svg`) in dark mode
- `auth/login.tsx` - Switches to white PNG logo in dark mode
- `auth/register.tsx` - Switches to white PNG logo in dark mode

**Phase 3 - Documentation Page**:
- All helper components (ParamTable, EndpointCard) now use `useTheme()` with dark-aware colors
- Section headings, body text, code inline tags, sidebar nav, auth cards, error table, support box

**Phase 4 - Auth Pages & Shared Components**:
- `Login/styled.tsx` - Dark wrapper bg, dark card bg, dark border
- `auth/login.tsx` - Text colors, border colors, backgrounds
- `auth/register.tsx` - Text colors, icon colors
- `AuthLayout/TitleDescription` - Title and description colors
- `AuthLayout/InputFields` - Input bg, disabled state, autofill colors
- `UI/Buttons/index.tsx` - Hover, disabled, animation state colors (converted from static theme import to `useTheme()`)
- `UI/OtpDialog/index.tsx` - Background and text colors
- `_error.tsx` - Button colors for dark mode

**Phase 5 - Icon Brightness**:
- `FeatureIcon` and `WhyChooseDynoPayIcon` apply `brightness(2.5)` CSS filter in dark mode for `#0004FF` stroke icons

## Testing Protocol

### Backend Testing
- Test the dashboard API with and without company_id parameter
- Verify login flow works correctly
- Test that CSRF token + auth flow works

### Frontend Testing
- Verify dark/light mode toggle on landing page
- Verify language switcher shows all 6 languages (EN, PT, FR, ES, DE, NL)
- Verify "Add Company" opens modal flow instead of old page
- Verify dashboard loads with correct company-scoped data (no flash)

## Incorporate User Feedback
- User should test the dark mode toggle persistence (switch on landing → verify on login/dashboard)
- User should test the Add Company flow from the company selector dropdown
- User should verify the total value no longer flashes between different amounts
