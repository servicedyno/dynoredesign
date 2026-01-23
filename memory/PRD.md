# DynoPay Backend - Product Requirements Document

## Original Problem Statement
Set up a crypto payment gateway backend from GitHub repositories (DynoBackend & DynoBackendAPI), merge them into a monorepo, and implement comprehensive feature additions including company profiles, tax integration, dashboard APIs, notifications, authentication fixes, and more.

## Architecture
```
/app/backend/
├── api-service/          # Secondary API service (port 3301)
├── controller/           # Business logic
├── models/               # Sequelize models (PostgreSQL)
├── routes/               # Express routes
├── services/             # Shared services
├── utils/                # Utilities
├── jobs/                 # Cron jobs
└── server.ts             # Main entry (port 8001)
```

**Tech Stack:** Node.js, TypeScript, Express, PostgreSQL, Redis, Sequelize ORM

## Implemented Features

### Phase 1: Database Schema Updates ✅ (January 2026)
- **Modified Tables:**
  - `tbl_company`: Added address_line1, address_line2, city, state, country, zip_code, vat_number, vat_type, vat_verified
  - `tbl_api`: Added api_name
  - `tbl_user_wallet`: Added company_id, wallet_name
  - `tbl_user_addresses`: Added company_id, wallet_name
  
- **New Tables Created:**
  - `tbl_tax_rate`: Cache VAT rates by country
  - `tbl_invoice`: Transaction invoices
  - `tbl_notification`: Individual notifications
  - `tbl_notification_preferences`: User notification settings
  - `tbl_kyc`: KYC verification records

## Prioritized Backlog

### P0 (Critical)
- Phase 2: Company Profile & Tax Integration (APILayer)
- Phase 3: Dashboard APIs

### P1 (High Priority)
- Phase 4: Notifications System
- Phase 5: Authentication Fixes (Forgot Password, Google Sign-In)
- Phase 6: API, Wallet & Company-Level Data Scoping

### P2 (Medium Priority)
- Phase 7: Transactions (filters, CSV export)
- Phase 8: Payment Links CRUD
- Phase 9: Email Service (17 templates via Brevo)
- Phase 10: Partial Wallet Configuration
- Phase 11: KYC System
- Phase 12: Invoice Generation

## Known Issues
1. **Fee Logic Defaults Bug** - BTC should be $7, USDT-TRC20 should be $10 (currently $5)
2. **Missing userReceives < $5 Check** - Full amount should go to admin if user receives < $5
3. **Google Sign-In** - Needs investigation/fix

## Key Integrations
- PostgreSQL (external database)
- Redis (caching/queues)
- APILayer (Tax Data API)
- Brevo (Email)
- Telnyx (SMS)
- Tatum, BlockBee, Blockchair (Crypto APIs)
- Flutterwave (Payments)

## Configuration
- Implementation Plan: `/app/backend/DYNOPAY_IMPLEMENTATION_TASKS.txt`
- Environment: `/app/backend/.env`
