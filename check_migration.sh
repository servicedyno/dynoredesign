#!/bin/bash
# Verify Database Migration for Merchant Pool System

echo "========================================="
echo "Merchant Pool Database Migration Check"
echo "========================================="
echo ""

# Check if column exists in model
echo "1. Checking Model Definition..."
if grep -q "last_merchant_payout" /app/backend/models/merchantPoolModels/index.ts; then
    echo "   ✅ Column defined in model"
else
    echo "   ❌ Column NOT in model definition"
fi
echo ""

# Check Sequelize sync logs
echo "2. Checking Sequelize Sync Logs..."
if grep -q "Merchant Pool tables synced successfully" /var/log/supervisor/backend.out.log; then
    echo "   ✅ Merchant Pool tables synced successfully"
else
    echo "   ⚠️  No sync confirmation found"
fi
echo ""

# Check if we can query the database (requires psql or python with psycopg2)
echo "3. Database Column Verification..."
echo "   ℹ️  Manual verification needed:"
echo ""
echo "   Run this SQL query:"
echo "   SELECT column_name, data_type "
echo "   FROM information_schema.columns "
echo "   WHERE table_name = 'tbl_merchant_temp_address' "
echo "   AND column_name = 'last_merchant_payout';"
echo ""
echo "   Expected result: last_merchant_payout | timestamp with time zone"
echo ""

# Provide migration SQL if needed
echo "========================================="
echo "If column does NOT exist, run this:"
echo "========================================="
echo ""
echo "ALTER TABLE tbl_merchant_temp_address"
echo "ADD COLUMN IF NOT EXISTS last_merchant_payout TIMESTAMP NULL"
echo "COMMENT 'Timestamp when merchant was last paid (for time-based sweep)';"
echo ""

echo "========================================="
echo "Sequelize Auto-Sync Info"
echo "========================================="
echo ""
echo "If Sequelize is configured with alter:true or sync:true,"
echo "the column should be auto-created on backend restart."
echo ""
echo "To force sync, restart backend:"
echo "sudo supervisorctl restart backend"
echo ""
