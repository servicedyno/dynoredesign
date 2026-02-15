# DynoPay - Cryptocurrency Payment Gateway

## Original Problem Statement
Cryptocurrency payment gateway built with Node.js/Express/TypeScript backend and React frontend. Provides merchant API for accepting crypto payments with QR code generation, multi-chain support, and auto-conversion features.

## Architecture
- **Backend**: Node.js/Express/TypeScript (runs on port 8001 via supervisor + ts-node)
- **Frontend**: React (runs on port 3000 via yarn/craco)
- **Database**: PostgreSQL (Railway-hosted)
- **Cache**: Redis (Railway-hosted)
- **Image Processing**: sharp library for QR code logo overlays
- **External APIs**: Brevo (email alerts), Binance (price feeds via SSH tunnel), Tatum, CryptoAPIs, BlockBee

## Key Credentials
- Merchant: richard@dyno.pt / Katiekendra123@
- Company: Bozzmail (ID: 38)
- API Key: Encrypted, retrieved via /api/userApi/getApi endpoint

## What's Been Implemented
- [2026-02-15] QR codes with embedded currency logos (15 cryptos)
- [2026-02-15] JSON parsing error handling (400 instead of 500)
- [2026-02-15] Persistent email alerting via Brevo + Redis
- [2026-02-15] Binance connectivity via SSH SOCKS5 tunnel
- [2026-02-15] BCH double-prefix address fix
- [2026-02-15] Created 5 test payments ($10 each: SOL, POLYGON, DOGE, BCH, BTC) with visible addresses

## Current Status
- All services running and healthy
- SSH tunnel active for Binance connectivity
- No known bugs or blockers

## Backlog
- P2: Clean up test scripts in /app/scripts/ (test_qr.ts, test_email.ts)
