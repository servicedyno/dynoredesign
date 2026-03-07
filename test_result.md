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
- **Pod URL**: `https://pod-endpoint-config.preview.emergentagent.com`
- **Frontend** (`/app/.env.local`): `NEXT_PUBLIC_BASE_URL` set to pod URL with trailing slash
- **Frontend** (`/app/frontend/.env`): `REACT_APP_BACKEND_URL` set to pod URL
- **Backend** (`/app/backend/.env`): `SERVER_URL`, `CHECKOUT_URL`, `FRONTEND_URL` all set to pod URL

## Changes Made in This Session

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

### 6. Dark Mode Text Visibility Fix (Complete)
**Root cause**: Styled components across the landing page imported `homeTheme` (light theme) directly and used its palette values instead of the dynamic `theme` callback parameter from MUI's `styled()`. This caused all colors to remain hardcoded to light-mode values even when dark mode was active.

**Files Fixed**:
- `/app/Components/UI/SectionTitle/styled.tsx` - Badge, Heading, SubText now use `({ theme })` callback
- `/app/Components/UI/HomeCard/styled.tsx` - StyledCard gradients, WhyChooseUsCard borders/bg, all text colors now theme-aware
- `/app/Components/Layout/HomeHeader/styled.tsx` - FixedHeader bg, nav link colors, Sign In, mobile drawer all dark-mode aware
- `/app/Components/Layout/HomeFooter/styled.tsx` - Footer bg uses conditional dark color
- `/app/Components/Layout/HomeButton/styled.tsx` - Primary and outlined button variants use dark-mode aware colors
- `/app/Components/Page/Home/styled.tsx` - All section backgrounds and glow effects use `theme.palette`
- `/app/Components/Page/Home/UseCase.tsx` - UseCase cards, tags, borders all theme-aware
- `/app/Components/UI/UseCaseBanner/index.tsx` - Banner gradient and border now dark-mode aware
- `/app/Components/UI/LanguageSwitcher/styled.tsx` - Dropdown, trigger, borders, hover states all theme-aware
- `/app/pages/privacy-policy.tsx`, `terms-conditions.tsx`, `aml-policy.tsx` - Replaced hardcoded `#131520`, `#676B7E` with `text.primary`, `text.secondary`
- `/app/pages/system-status.tsx` - Replaced hardcoded colors with theme tokens

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
