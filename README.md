# DynoPay — Cryptocurrency Payment Gateway

A multi-chain cryptocurrency payment processing platform with auto-stablecoin conversion, merchant pool management, and comprehensive webhook integration.

## Tech Stack

- **Backend:** Node.js 20.x / TypeScript 5.x / Express 4.18
- **Database:** PostgreSQL (Sequelize ORM) + Redis
- **Blockchain:** Tatum SDK, TronWeb, XRPL, bchaddrjs
- **Exchange:** Binance (Convert API + WebSocket)
- **Email:** Brevo (Sendinblue)
- **Frontend:** React 19 + Tailwind CSS (API-first — frontend is minimal)

## Quick Start

```bash
cd backend
cp .env.example .env   # configure your environment
yarn install
yarn dev               # development with hot-reload
yarn build && yarn start  # production
```

## Project Structure

```
/app
├── backend/              # Express/TypeScript API server
│   ├── apis/             # External API integrations (Tatum, Binance)
│   ├── controller/       # Route handlers
│   ├── database/         # DB migrations
│   ├── helper/           # Email templates, utilities
│   ├── middleware/        # Auth, rate-limit, sanitize, logging
│   ├── models/           # Sequelize models
│   ├── routes/           # Express route definitions
│   ├── services/         # Business logic & cron jobs
│   ├── swagger/          # API documentation
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Shared utilities (Redis, logging, etc.)
│   └── webhooks/         # Tatum webhook handlers
├── frontend/             # React frontend (placeholder)
├── docs/                 # Documentation
│   ├── guides/           # Setup & configuration guides
│   ├── plans/            # Architecture & refactoring plans
│   └── reports/          # Analysis & test reports
├── tests/                # Test suites
└── scripts/              # Operational scripts
```

## Documentation

### Guides
- [Environment Variables](docs/guides/ENV_VARS_COMPLETE_GUIDE.md)
- [Deployment Guide](docs/guides/DEPLOY_AND_TEST_GUIDE.md)
- [Railway Setup](docs/guides/RAILWAY_ENV_VARS.md)
- [Binance Proxy Setup](docs/guides/BINANCE_PROXY_SETUP.md)
- [KYC Integration](docs/guides/KYC_DOCUMENTATION.md)

### Reports
- [Codebase Analysis](docs/reports/CODEBASE_ANALYSIS_REPORT.md)
- [Security Fixes](docs/reports/SECURITY_FIXES_SUMMARY.md)

### Plans
- [Controller Refactoring](docs/plans/CONTROLLER_REFACTORING_PLAN.md)
- [Auto-Conversion Plan](docs/plans/AUTO_CONVERSION_PLAN.md)

## Key Features

- **Multi-chain payments:** BTC, ETH, LTC, DOGE, TRX, SOL, XRP, RLUSD, POLYGON, BCH + ERC20/TRC20 tokens
- **Merchant Pool system:** Pre-warmed address pools with reservation & sweep
- **Auto-stablecoin conversion:** Binance integration for volatile → USDT/USDC
- **QR codes with currency logos:** Branded QR codes for all 15 supported chains
- **Webhook notifications:** HMAC-signed merchant callbacks
- **Fee optimization:** Dynamic gas estimation, XRP reserve handling, fee caching
- **Error monitoring:** Redis-backed error buffer with email digest alerts
