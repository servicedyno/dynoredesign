#!/bin/bash
# ============================================
# DynoPay - Manual Dependency Setup Trigger
# ============================================
# Run this script manually to reinstall dependencies

echo "🔧 Manual Dependency Setup Trigger"
echo "=================================="
echo ""

# Ask for confirmation
read -p "This will check and reinstall all dependencies. Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

echo "🚀 Running dependency setup..."
echo ""

# Run the setup script
if [ -f "/app/setup_dependencies.sh" ]; then
    /app/setup_dependencies.sh
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo ""
        echo "✅ Dependency setup completed successfully!"
        echo ""
        echo "To restart services, run:"
        echo "   sudo supervisorctl restart all"
    else
        echo ""
        echo "❌ Dependency setup failed with exit code: $exit_code"
        echo "Check /var/log/supervisor/dependency-setup.err.log for details"
        exit $exit_code
    fi
else
    echo "❌ Setup script not found at /app/setup_dependencies.sh"
    exit 1
fi
