# DynoBackend - Crypto Payment Gateway

## Project Overview
Backend services for a crypto payment gateway (DynoPay) integrated from:
- https://github.com/Moxxcompany/DynoBackend (workakash branch) - Main backend
- https://github.com/Moxxcompany/DynoBackendAPI - Customer API service

## Architecture
```
/app/backend/
├── server.ts              # Main backend (Port 8001)
├── api-service/           # Customer API service (Port 3301)
│   └── server.ts
├── controller/            # Main controllers
├── routes/                # Main routes
├── models/                # Sequelize models
├── utils/                 # Utilities
└── .env                   # Shared environment config
```

## Services
| Service | Port | Purpose |
|---------|------|---------|
| Main Backend | 8001 | Core payment processing, admin, webhooks |
| API Service | 3301 | Customer-facing API for merchant integration |

## Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Sequelize ORM)
- **Cache**: Redis
- **APIs**: Tatum, Flutterwave, Blockchair

## What's Been Implemented
- [x] DynoBackend cloned and set up (Jan 2026)
- [x] DynoBackendAPI integrated into same repo
- [x] PostgreSQL & Redis configured
- [x] Database migrations completed (19 tables)
- [x] Both services running (8001, 3301)
- [x] Shared .env configuration

## API Endpoints

### Main Backend (Port 8001)
- `/api/user/*` - User auth & management
- `/api/admin/*` - Admin operations
- `/api/company/*` - Company management
- `/api/wallet/*` - Wallet operations
- `/api/pay/*` - Payment processing
- `/webhook`, `/tatum-webhook` - Webhooks

### API Service (Port 3301)
- `POST /api/user/createUser` - Create customer
- `POST /api/user/createPayment` - Create payment link
- `POST /api/user/cryptoPayment` - Crypto payment
- `POST /api/user/addFunds` - Add funds
- `POST /api/user/useWallet` - Use wallet balance
- `GET /api/user/getTransactions` - Get transactions
- `GET /api/user/getBalance` - Get balance
- `GET /api/getSupportedCurrency` - List currencies

## Environment Variables
See `/app/backend/.env` for full configuration

## Next Steps
- P0: Configure API keys (Tatum, Flutterwave)
- P1: Set proper JWT/ACCESS_TOKEN secrets
- P2: Configure webhook URLs for production
