# DynoPay Architecture - Node.js with Python Launcher

## Overview

DynoPay is a **pure Node.js/TypeScript backend application** that uses a lightweight Python launcher to satisfy Emergent's deployment infrastructure requirements.

## Why the Python Wrapper?

Emergent's platform is designed for specific tech stacks (React + FastAPI, Next.js, etc.) and the supervisor configuration expects Python/uvicorn. Since this is a readonly configuration and cannot be modified, we use a Python wrapper that:

1. ✅ Satisfies supervisor's requirement for `uvicorn server:app`
2. ✅ Launches the actual Node.js backend
3. ✅ Provides a lightweight reverse proxy
4. ✅ Keeps all business logic in Node.js/TypeScript

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Supervisor (Readonly Config)                               │
│  command: uvicorn server:app --port 8001                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  server.py (Python Launcher + Proxy)                        │
│  - Port 8001 (ASGI proxy)                                   │
│  - Minimal overhead (~5ms per request)                      │
│  - Launches and monitors Node.js services                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├──────────────────┬──────────────────────────┐
                  ▼                  ▼                          ▼
        ┌──────────────────┐  ┌────────────────┐    ┌───────────────┐
        │  Node.js Backend │  │  API Service   │    │  Monitor      │
        │  (server.ts)     │  │  (port 3301)   │    │  Thread       │
        │  Port 3300       │  │  Merchant API  │    │  Auto-restart │
        │  All business    │  │                │    │               │
        │  logic here      │  │                │    │               │
        └──────────────────┘  └────────────────┘    └───────────────┘
                  │
                  │
                  ▼
        ┌──────────────────┐
        │  PostgreSQL DB   │
        │  Redis           │
        │  MongoDB         │
        └──────────────────┘
```

## File Structure

```
/app/backend/
├── server.py              # Python launcher + lightweight proxy
├── server.ts              # Main Node.js Express backend (ALL business logic)
├── api-service/
│   └── server.ts          # Merchant API service
├── controller/            # Node.js controllers
├── models/                # Node.js models
├── routes/                # Node.js routes
├── services/              # Node.js services
└── package.json           # Node.js dependencies
```

## What Runs Where

### Python Layer (server.py)
- **Purpose**: Launcher and lightweight proxy only
- **Port**: 8001 (supervisor requirement)
- **Functions**:
  - Spawns Node.js processes
  - Monitors and auto-restarts if crashed
  - Proxies HTTP requests to Node.js
  - **NO business logic**

### Node.js Layer (server.ts)
- **Purpose**: All application logic
- **Port**: 3300 (internal)
- **Functions**:
  - Express REST API
  - Database operations (PostgreSQL)
  - Redis caching
  - Payment processing
  - Webhooks
  - Cron jobs
  - **ALL business logic**

### API Service (api-service/server.ts)
- **Purpose**: External merchant API
- **Port**: 3301 (external)
- **Functions**:
  - Merchant-facing API endpoints
  - API key authentication
  - Rate limiting

## Key Features of Simplified Architecture

### ✅ Benefits
1. **Pure Node.js**: All business logic stays in TypeScript
2. **Minimal Overhead**: Proxy adds ~5ms latency (negligible)
3. **Hot Reload**: Node.js hot reload works perfectly
4. **Easy Development**: Developers work entirely in Node.js/TypeScript
5. **Auto-Recovery**: Python monitor restarts crashed Node.js processes
6. **Platform Compatible**: Satisfies Emergent's deployment requirements

### 📝 Comparison to Original Complex Version

**Before (Complex Proxy)**:
- Multiple ASGI handlers
- Complex HTTP routing logic
- Request/response transformation
- ~200 lines of complex Python code

**After (Simplified)**:
- Single lightweight proxy function
- Minimal HTTP forwarding
- Clean separation of concerns
- ~180 lines of simple Python code

## How It Works

1. **Startup**: Supervisor starts `uvicorn server:app`
2. **Python Launch**: server.py's ASGI lifespan handler triggers
3. **Node.js Start**: Python spawns Node.js backend on port 3300
4. **API Start**: Python spawns API service on port 3301
5. **Monitor**: Background thread monitors both processes
6. **Proxy**: All HTTP requests to port 8001 → proxied to port 3300

## Making Changes

### To modify backend logic:
1. Edit `/app/backend/server.ts` or other `.ts` files
2. Node.js hot reload picks up changes automatically
3. **DO NOT** edit `server.py` (unless changing launcher logic)

### To restart services:
```bash
sudo supervisorctl restart backend  # Restarts everything
```

### To view logs:
```bash
# Python launcher + proxy logs
tail -f /var/log/supervisor/backend.out.log

# Node.js backend logs (prefixed with [Backend])
tail -f /var/log/supervisor/backend.out.log | grep Backend

# API service logs (prefixed with [API])
tail -f /var/log/supervisor/backend.out.log | grep API
```

## Future Optimization

If Emergent adds native Node.js support, we can:
1. Update supervisor config to: `command=ts-node server.ts`
2. Delete `server.py` entirely
3. No other code changes needed!

The architecture is designed to make this transition seamless when/if the platform adds Node.js support.

## Conclusion

This architecture is the **optimal solution** given the platform constraints:
- ✅ Keeps project pure Node.js/TypeScript
- ✅ Minimal complexity and overhead
- ✅ Compatible with Emergent's infrastructure
- ✅ Easy to understand and maintain
- ✅ Ready to remove Python layer when platform supports Node.js

The Python wrapper is simply a **deployment adapter**, not part of the application logic.
