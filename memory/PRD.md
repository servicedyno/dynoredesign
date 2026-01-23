# DynoBackend - Crypto Payment Gateway

## Project Overview
Backend service for a crypto payment gateway (DynoPay) cloned from https://github.com/Moxxcompany/DynoBackend/tree/workakash

## Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Sequelize ORM)
- **Cache**: Redis
- **APIs**: Tatum, Flutterwave, Blockchair, HTX

## What's Been Implemented
- [x] Repository cloned and set up (Jan 2026)
- [x] PostgreSQL installed and configured
- [x] Redis installed and configured
- [x] Database migrations completed (19 tables created)
- [x] Fixed native module issues (fast-crc32c → crc-32)
- [x] Fixed Flutterwave initialization (optional keys)
- [x] Seeded initial fees data
- [x] Server running on port 8001

## Database Tables Created
- tbl_admin_fee_wallet
- tbl_admin_fee_transaction
- tbl_admin_fee_transfer
- tbl_admin_wallet
- tbl_user
- tbl_company
- tbl_api
- tbl_plan
- tbl_subscription
- tbl_customer
- tbl_customer_transaction
- tbl_customer_wallet
- tbl_fees
- tbl_user_wallet
- tbl_payment_link
- tbl_user_self_transaction
- tbl_user_temp_address
- tbl_user_transaction
- tbl_user_addresses

## API Routes Available
- `/api/user/*` - User authentication & management
- `/api/admin/*` - Admin operations
- `/api/company/*` - Company management (auth required)
- `/api/userApi/*` - API key management (auth required)
- `/api/wallet/*` - Wallet operations (auth required)
- `/api/pay/*` - Payment processing
- `/webhook` - Flutterwave webhook
- `/tatum-webhook` - Tatum webhook
- `/tatum-crypto-webhook` - Tatum crypto webhook

## Environment Variables Required (for production)
- `PORT` - Server port (default: 8001)
- `DB_NAME`, `USER_NAME`, `PASSWORD`, `HOST`, `DB_PORT` - PostgreSQL config
- `REDIS_PUBLIC_URL` - Redis connection URL
- `JWT_SECRET` - JWT signing secret
- `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY` - Flutterwave (optional)
- `TATUM_KEY`, `TATUM_SECRET_KEY` - Tatum API keys
- `SERVER_URL` - Server URL for webhooks
- `ETH_CONTRACT`, `TRX_CONTRACT` - USDT contract addresses
- `PROJECT_ID`, `LOCATION_ID`, `KEY_RING_ID` - Google Cloud KMS
- `GOOGLE_CLIENT_EMAIL`, `GOOGLE_CLIENT_KEY` - Google credentials

## Next Steps / Backlog
- P0: Configure external API keys (Tatum, Flutterwave) for production
- P1: Set up proper JWT secret
- P1: Configure webhook URLs
- P2: Set up Google Cloud KMS for key encryption
- P2: Configure contract addresses for USDT
