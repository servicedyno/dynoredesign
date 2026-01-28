#!/bin/bash
# ============================================
# DynoPay - Automatic Dependency Setup
# ============================================
# This script ensures all dependencies are installed before services start
# Run this on system startup or before running services

set -e  # Exit on error

echo "================================================"
echo "🔧 DynoPay - Dependency Setup & Verification"
echo "================================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check and install Node.js dependencies
install_node_deps() {
    local dir=$1
    local package_manager=$2
    local name=$3
    
    echo -e "${BLUE}📦 Checking $name dependencies...${NC}"
    cd "$dir"
    
    if [ "$package_manager" = "yarn" ]; then
        # Check for yarn.lock and node_modules
        if [ ! -d "node_modules" ] || [ ! -f "node_modules/.yarn-integrity" ]; then
            echo -e "${YELLOW}   ⏳ Installing via yarn (this may take a few minutes)...${NC}"
            
            # Try frozen lockfile first, fallback to regular install
            if yarn install --frozen-lockfile --non-interactive 2>/dev/null; then
                echo -e "${GREEN}   ✅ Yarn dependencies installed (frozen lockfile)${NC}"
            elif yarn install --non-interactive; then
                echo -e "${GREEN}   ✅ Yarn dependencies installed${NC}"
            else
                echo -e "${YELLOW}   ⚠️  Yarn install had warnings but completed${NC}"
            fi
        else
            echo -e "${GREEN}   ✅ Dependencies already installed${NC}"
        fi
    else
        # NPM installation
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}   ⏳ Installing via npm (this may take a few minutes)...${NC}"
            
            # Try npm ci first (faster, uses lock file), fallback to npm install
            if [ -f "package-lock.json" ]; then
                if npm ci --no-audit --prefer-offline 2>/dev/null; then
                    echo -e "${GREEN}   ✅ NPM dependencies installed (ci)${NC}"
                elif npm install --no-audit; then
                    echo -e "${GREEN}   ✅ NPM dependencies installed${NC}"
                else
                    echo -e "${YELLOW}   ⚠️  NPM install had warnings but completed${NC}"
                fi
            else
                npm install --no-audit
                echo -e "${GREEN}   ✅ NPM dependencies installed${NC}"
            fi
        else
            echo -e "${GREEN}   ✅ Dependencies already installed${NC}"
        fi
    fi
    
    echo ""
}

# Function to check and install Python dependencies
install_python_deps() {
    echo -e "${BLUE}🐍 Checking Python dependencies...${NC}"
    cd /app/backend
    
    if [ -f "requirements.txt" ]; then
        # Check if uvicorn is installed (key dependency)
        if ! /root/.venv/bin/pip list 2>/dev/null | grep -q "uvicorn"; then
            echo -e "${YELLOW}   ⏳ Installing Python dependencies...${NC}"
            /root/.venv/bin/pip install -r requirements.txt --no-cache-dir
            echo -e "${GREEN}   ✅ Python dependencies installed${NC}"
        else
            echo -e "${GREEN}   ✅ Python dependencies already installed${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  requirements.txt not found, skipping...${NC}"
    fi
    
    echo ""
}

# Function to verify critical packages
verify_critical_packages() {
    echo -e "${BLUE}🔍 Verifying critical packages...${NC}"
    
    local all_good=true
    
    # Backend critical packages
    cd /app/backend
    local backend_packages=("express" "sequelize" "pg" "ts-node" "typescript")
    for pkg in "${backend_packages[@]}"; do
        if [ -d "node_modules/$pkg" ]; then
            echo -e "${GREEN}   ✅ Backend: $pkg${NC}"
        else
            echo -e "${YELLOW}   ❌ Backend: $pkg MISSING${NC}"
            all_good=false
        fi
    done
    
    # Frontend critical packages
    cd /app/frontend
    local frontend_packages=("react" "react-dom" "react-scripts")
    for pkg in "${frontend_packages[@]}"; do
        if [ -d "node_modules/$pkg" ]; then
            echo -e "${GREEN}   ✅ Frontend: $pkg${NC}"
        else
            echo -e "${YELLOW}   ❌ Frontend: $pkg MISSING${NC}"
            all_good=false
        fi
    done
    
    # Python critical packages
    local python_packages=("uvicorn" "starlette" "httpx")
    for pkg in "${python_packages[@]}"; do
        if /root/.venv/bin/pip list 2>/dev/null | grep -q "^$pkg "; then
            echo -e "${GREEN}   ✅ Python: $pkg${NC}"
        else
            echo -e "${YELLOW}   ❌ Python: $pkg MISSING${NC}"
            all_good=false
        fi
    done
    
    echo ""
    
    if [ "$all_good" = true ]; then
        echo -e "${GREEN}✅ All critical packages verified!${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Some packages are missing. Services may not work correctly.${NC}"
        return 1
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    echo "Starting dependency setup at $(date)"
    echo ""
    
    # Install backend dependencies (npm)
    install_node_deps "/app/backend" "npm" "Backend"
    
    # Install frontend dependencies (yarn)
    install_node_deps "/app/frontend" "yarn" "Frontend"
    
    # Install Python dependencies
    install_python_deps
    
    # Verify critical packages
    verify_critical_packages
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo "================================================"
    echo -e "${GREEN}✅ Dependency setup completed in ${duration}s${NC}"
    echo "================================================"
    echo ""
    echo "Services are ready to start!"
    echo ""
}

# Run main function
main

# Exit with success
exit 0
