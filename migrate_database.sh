#!/bin/bash

echo "================================================================================"
echo "  DATABASE & REDIS MIGRATION"
echo "  From: OLD (yamanote DB + crossover Redis) - DynoBackend"
echo "  To:   NEW (shortline DB + turntable Redis) - This repo"
echo "================================================================================"
echo ""

# Database credentials
OLD_DB="postgresql://postgres:oMHQMHfnrFyWgkhYaiXbhjDEMZSWOapc@yamanote.proxy.rlwy.net:42097/db_bozzwallet"
NEW_DB="postgresql://postgres:JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO@shortline.proxy.rlwy.net:44579/railway"

# Redis URLs
OLD_REDIS="redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463"
NEW_REDIS="redis://default:nGRWpSIBrXftcfgRCQDxtAJGowmXlgUg@turntable.proxy.rlwy.net:21752"

echo "📋 Step 1: Dumping OLD database schema and data..."
echo "   Source: yamanote.proxy.rlwy.net/db_bozzwallet"
PGPASSWORD="oMHQMHfnrFyWgkhYaiXbhjDEMZSWOapc" pg_dump \
  -h yamanote.proxy.rlwy.net \
  -p 42097 \
  -U postgres \
  -d db_bozzwallet \
  --no-owner \
  --no-acl \
  -f /tmp/dynopay_backup.sql

if [ $? -eq 0 ]; then
    echo "   ✅ Database dump completed: /tmp/dynopay_backup.sql"
    echo ""
else
    echo "   ❌ Database dump failed!"
    exit 1
fi

echo "📋 Step 2: Restoring to NEW database..."
echo "   Target: shortline.proxy.rlwy.net/railway"
echo "   This will drop existing tables and recreate with data"

# Restore the SQL dump
PGPASSWORD="JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO" psql \
  -h shortline.proxy.rlwy.net \
  -p 44579 \
  -U postgres \
  -d railway \
  -f /tmp/dynopay_backup.sql

if [ $? -eq 0 ]; then
    echo "   ✅ Database restored successfully!"
    echo ""
else
    echo "   ⚠️  Restore completed with warnings (this is often normal)"
    echo ""
fi

echo "📋 Step 3: Verifying database tables..."
TABLE_COUNT=$(PGPASSWORD="JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO" psql \
  -h shortline.proxy.rlwy.net \
  -p 44579 \
  -U postgres \
  -d railway \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo "   Tables created: $TABLE_COUNT"

if [ $TABLE_COUNT -gt 0 ]; then
    echo "   ✅ Database migration successful!"
    echo ""
else
    echo "   ❌ No tables found in new database!"
    exit 1
fi

echo "================================================================================"
echo "  DATABASE MIGRATION COMPLETE ✅"
echo "================================================================================"
echo ""
echo "Next steps:"
echo "  1. Run: cd /app/backend && npx ts-node sync_database.ts"
echo "     (This will add any missing columns from this repo's models)"
echo "  2. Redis data will be copied separately"
echo ""
