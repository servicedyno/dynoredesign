# Dependency Installation Analysis & Recommendations

## Current State Analysis

### ✅ What's Working
1. **Backend Node.js dependencies**: ✅ Installed (611 packages in node_modules)
2. **Frontend dependencies**: ✅ Installed (929 packages in node_modules)
3. **Python dependencies**: ✅ Installed in virtual environment

### ❌ Problems Identified

#### 1. **No Automatic Dependency Installation on Setup**
**Issue**: Dependencies are NOT automatically installed when the environment starts.

**Current Behavior**:
- Supervisor directly runs `uvicorn` and `yarn start`
- No pre-check or installation step before starting services
- If dependencies are missing, services fail silently or with errors

**Evidence**:
```bash
# Supervisor configuration (READ-ONLY)
[program:backend]
command=/root/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload
directory=/app/backend
autostart=true

[program:frontend]
command=yarn start
directory=/app/frontend
autostart=true
```

#### 2. **Inconsistent Lock Files**
**Issue**: Backend uses `package-lock.json` (npm) but frontend uses `yarn.lock` (yarn)

**Current State**:
- Backend: `/app/backend/package-lock.json` exists (npm-based)
- Frontend: `/app/frontend/yarn.lock` exists (yarn-based)
- Mixed package managers can cause version conflicts

#### 3. **Manual Dependency Management**
**Issue**: Dependencies must be manually installed before first run

**What Happens**:
- New dependencies added to package.json are NOT automatically installed
- Developer must remember to run `yarn install` or `npm install`
- Easy to forget when making changes

#### 4. **No Dependency Verification**
**Issue**: No health check to verify all dependencies are present

**Risk**:
- Services may start but fail at runtime when importing missing packages
- Hard-to-debug "module not found" errors
- Wasted time troubleshooting

---

## Root Causes

### 1. Supervisor Configuration is Read-Only
The supervisor config at `/etc/supervisor/conf.d/supervisord.conf` is marked as **READONLY** and directly runs services without any setup scripts.

### 2. No Pre-Start Hook
There's no automatic script that runs before services start to:
- Check if dependencies exist
- Install missing dependencies
- Verify environment readiness

### 3. Backend Has Pre-Start Script (But Not Used)
- Script exists: `/app/backend/start_backend.sh`
- Contains dependency checks and installation logic
- **BUT**: Not referenced in supervisor configuration
- Supervisor directly calls uvicorn instead

---

## Recommended Solutions

### 🎯 Solution 1: Add Pre-Start Dependency Check (RECOMMENDED)

#### A. Create Master Setup Script

**File**: `/app/setup_dependencies.sh`
```bash
#!/bin/bash
set -e

echo "================================================"
echo "🔧 DynoPay - Dependency Setup & Verification"
echo "================================================"

# Function to check and install Node.js dependencies
install_node_deps() {
    local dir=$1
    local package_manager=$2
    
    cd "$dir"
    echo "📦 Checking $dir dependencies..."
    
    if [ "$package_manager" = "yarn" ]; then
        if [ ! -d "node_modules" ] || [ ! -f "node_modules/.yarn-integrity" ]; then
            echo "   Installing via yarn..."
            yarn install --frozen-lockfile --non-interactive || yarn install --non-interactive
            echo "   ✅ Yarn dependencies installed"
        else
            echo "   ✅ Dependencies already installed"
        fi
    else
        if [ ! -d "node_modules" ]; then
            echo "   Installing via npm..."
            npm ci --no-audit || npm install --no-audit
            echo "   ✅ NPM dependencies installed"
        else
            echo "   ✅ Dependencies already installed"
        fi
    fi
}

# Install backend dependencies (npm)
install_node_deps "/app/backend" "npm"

# Install frontend dependencies (yarn)
install_node_deps "/app/frontend" "yarn"

# Install Python dependencies
echo "🐍 Checking Python dependencies..."
cd /app/backend
if ! /root/.venv/bin/pip list | grep -q "uvicorn"; then
    echo "   Installing Python dependencies..."
    /root/.venv/bin/pip install -r requirements.txt --no-cache-dir
    echo "   ✅ Python dependencies installed"
else
    echo "   ✅ Python dependencies already installed"
fi

echo "================================================"
echo "✅ All dependencies verified and ready"
echo "================================================"
```

#### B. Make Script Executable
```bash
chmod +x /app/setup_dependencies.sh
```

#### C. Run on System Startup

**Option 1**: Add to `.bashrc` or system startup
```bash
# Add to /root/.bashrc or /etc/rc.local
/app/setup_dependencies.sh
```

**Option 2**: Create systemd service (runs before supervisor)
```ini
# /etc/systemd/system/dynopay-setup.service
[Unit]
Description=DynoPay Dependency Setup
Before=supervisor.service

[Service]
Type=oneshot
ExecStart=/app/setup_dependencies.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

**Option 3**: Run via cron on reboot
```bash
@reboot /app/setup_dependencies.sh >> /var/log/dependency-setup.log 2>&1
```

---

### 🎯 Solution 2: Modify Supervisor to Use Pre-Start Scripts

**Note**: Supervisor config is READ-ONLY, so this requires system-level changes.

If supervisor config can be modified, update to:

```ini
[program:backend]
command=/app/backend/start_backend.sh
directory=/app/backend
autostart=true
autorestart=true

[program:frontend]
command=/app/frontend/start_frontend.sh
directory=/app/frontend
autostart=true
autorestart=true
```

Create `/app/frontend/start_frontend.sh`:
```bash
#!/bin/bash
set -e

cd /app/frontend

# Check and install dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.yarn-integrity" ]; then
    echo "📦 Installing frontend dependencies..."
    yarn install --frozen-lockfile --non-interactive || yarn install --non-interactive
fi

# Start frontend
exec yarn start
```

---

### 🎯 Solution 3: Add Post-Install Hooks

Add to `package.json` scripts:

**Backend** (`/app/backend/package.json`):
```json
{
  "scripts": {
    "postinstall": "echo '✅ Backend dependencies installed'",
    "prestart": "npm ci --no-audit --prefer-offline || npm install --no-audit",
    "start": "node dist/server.js"
  }
}
```

**Frontend** (`/app/frontend/package.json`):
```json
{
  "scripts": {
    "postinstall": "echo '✅ Frontend dependencies installed'",
    "prestart": "yarn install --frozen-lockfile --non-interactive --prefer-offline || yarn install --non-interactive",
    "start": "craco start"
  }
}
```

---

### 🎯 Solution 4: Standardize Package Manager

**Problem**: Mixed npm (backend) and yarn (frontend) can cause issues.

**Recommendation**: Standardize on **Yarn** for both.

**Steps**:
```bash
# Backend: Convert to yarn
cd /app/backend
rm -f package-lock.json
yarn install
yarn build

# Update all commands to use yarn
# package.json: "start": "yarn build && node dist/server.js"
```

---

## Implementation Priority

### 🚨 Critical (Implement Immediately)
1. ✅ **Create `/app/setup_dependencies.sh`** - Master setup script
2. ✅ **Make script executable** - `chmod +x /app/setup_dependencies.sh`
3. ✅ **Run on startup** - Add to cron or systemd

### ⚠️ Important (Implement Soon)
4. **Standardize package manager** - Use yarn for both frontend/backend
5. **Add pre-start scripts** - Verify dependencies before service start

### 💡 Nice to Have
6. **Health check endpoints** - `/health` that verifies dependencies
7. **Automated testing** - CI/CD pipeline to catch missing deps

---

## Verification Steps

After implementing solutions, verify:

### 1. Check Dependencies After Reboot
```bash
# Simulate fresh environment
sudo supervisorctl stop all
rm -rf /app/backend/node_modules /app/frontend/node_modules
sudo supervisorctl start all

# Check logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

### 2. Test Missing Dependency Scenario
```bash
# Remove a critical package
cd /app/backend
npm uninstall ts-node

# Try to start
sudo supervisorctl restart backend

# Should auto-install and work
```

### 3. Monitor Startup Time
```bash
# Time the dependency installation
time /app/setup_dependencies.sh
```

---

## Best Practices Going Forward

### 1. **Always Update Lock Files**
```bash
# After adding new dependencies
cd /app/backend && npm install
cd /app/frontend && yarn install
```

### 2. **Document Dependencies**
Keep `requirements.txt` and `package.json` up to date with comments.

### 3. **Use CI/CD**
Automate dependency installation and testing in deployment pipeline.

### 4. **Version Pinning**
Pin major versions to avoid breaking changes:
```json
{
  "dependencies": {
    "express": "^4.18.2",  // ✅ Good: Pin major version
    "axios": "*"            // ❌ Bad: Any version
  }
}
```

### 5. **Regular Audits**
```bash
# Check for security vulnerabilities
npm audit
yarn audit

# Update outdated packages
npm outdated
yarn outdated
```

---

## Summary

### Current Issues:
❌ No automatic dependency installation on startup
❌ Dependencies must be manually installed
❌ Mixed package managers (npm + yarn)
❌ No dependency verification before service start

### Recommended Fix:
✅ Create master setup script (`/app/setup_dependencies.sh`)
✅ Run script on system startup (cron/systemd)
✅ Standardize on yarn for both frontend/backend
✅ Add pre-start verification to service scripts

### Expected Result:
- Dependencies automatically installed on first boot
- Services never fail due to missing packages
- Consistent dependency management
- Better developer experience

---

## Next Steps

1. Create the setup script
2. Test in development environment
3. Deploy to production
4. Monitor for any issues
5. Document process for team
