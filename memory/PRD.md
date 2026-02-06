# DynoPay - Product Requirements Document

## Original Problem Statement
Crypto payment processing platform (DynoPay) with full-stack monolith: React frontend + Express/TypeScript backend + PostgreSQL + Redis.

## Core Requirements
- API key management with currency rules (one per env, production is master)
- End-to-end currency consistency across dashboard, transactions, wallets, emails, PDFs
- FIAT currency restriction (14 supported currencies)
- Redis-only caching (consolidated from dual in-memory + Redis)
- Consistent currency info objects in API responses
- Token expiry headers on authenticated routes
- Active API key enforcement for payment link creation

## User Personas
- **Merchants**: Create payment links, manage API keys, receive crypto payments
- **Customers**: Pay via crypto through generated payment links

## Architecture
- **Backend**: Express + TypeScript (ts-node), port 3300
- **Frontend**: React, port 3000
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis (single layer)
- **Auth**: JWT (user session + Admin Token)

## Key DB Schema
- `tbl_api`: `{ api_id, company_id, base_currency, status, environment, admin_token }`
- `tbl_user_transactions`: `{ base_amount, base_currency, usd_value }`
- `tbl_companies`: `{ company_id, company_name, user_id }`

## What's Been Implemented
- Auto-generated friendly names for API keys/wallets
- End-to-end currency consistency (dashboard, transactions, wallets, emails, PDFs)
- API key management: one per env, production master, FIAT restriction, dev auto-sync
- Cache consolidation to Redis-only
- Token expiry header (`X-Token-Expires-In-Days`)
- Available currencies endpoint per company
- **Active API key check on payment link creation** (completed 2026-02-06)
- **Transaction display currency fix** (completed 2026-02-06): crypto amounts (ETH/BTC) now correctly convert to company's preferred fiat currency in getTransactions endpoint. Fixed both companyController.ts (was hardcoding USD source) and currencyConvert.ts (CoinGecko now tried first for crypto conversions)
- **Admin fee email redesign** (completed 2026-02-06): Improved Platform Fee Received email to match merchant-facing email quality. Added Status badge ("Processed"), Date row, em-dash subject line. Fixed logo rendering by switching from SVG (clip-path unsupported in Gmail) to PNG served from backend static files.
- **Merchant configuration for nomadly@moxx.co** (completed 2026-02-06): Configured crypto wallets for payment forwarding, initialized merchant pool, regenerated API key with USD currency.
- **Payment logic fix** (completed 2026-02-06): Fixed incorrect wallet_id reference during payment creation in walletController.ts.
- **Webhook logic fix** (completed 2026-02-06): Modified webhookService.ts to look up webhook URL from tbl_api for API-initiated payments. Awaiting user verification with actual webhook URL.

## Backlog

### P1 - Upcoming
- Public/unauthenticated endpoint for payment link creation (x-api-key header auth)
- Auto-create default company + USD API key on new user registration

### P2 - Future
- Update frontend components to consume `currency_info` objects from backend
- Consolidate duplicated currency query logic into single utility function in `currencyUtils.ts`

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company with active API keys: company_id=38
