import requests
import json

# Connect to database directly via backend API or check the database
# First let's check via a database query

import subprocess

# Query the merchant temp address pool directly
query = """
SELECT 
    mta.address_id,
    mta.company_id,
    mta.currency,
    mta.address,
    mta.status,
    mta.derivation_index,
    mta.reserved_at,
    mta.created_at
FROM tbl_merchant_temp_address mta
WHERE mta.company_id = 38
ORDER BY mta.currency, mta.status;
"""

import os
import psycopg2

# Database connection from environment
conn = psycopg2.connect(
    host="shortline.proxy.rlwy.net",
    port=44579,
    database="db_bozzwallet",
    user="postgres",
    password="JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO"
)

cursor = conn.cursor()

print("=" * 80)
print("MERCHANT TEMPORARY ADDRESS POOL - john@dyno.pt (company_id: 38)")
print("=" * 80)

# Check if table exists
cursor.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tbl_merchant_temp_address'
    );
""")
table_exists = cursor.fetchone()[0]

if not table_exists:
    print("\n❌ Table 'tbl_merchant_temp_address' does not exist!")
    print("   The merchant pool system may not be initialized.")
else:
    # Get temp addresses for company 38
    cursor.execute("""
        SELECT 
            address_id,
            company_id,
            currency,
            address,
            status,
            derivation_index,
            reserved_at,
            created_at
        FROM tbl_merchant_temp_address
        WHERE company_id = 38
        ORDER BY currency, status;
    """)
    
    addresses = cursor.fetchall()
    
    print(f"\n✅ Found {len(addresses)} temporary pool addresses")
    
    if addresses:
        # Group by currency and status
        by_currency = {}
        for addr in addresses:
            currency = addr[2]
            if currency not in by_currency:
                by_currency[currency] = []
            by_currency[currency].append({
                'address_id': addr[0],
                'address': addr[3],
                'status': addr[4],
                'derivation_index': addr[5],
                'reserved_at': addr[6],
                'created_at': addr[7]
            })
        
        print("\n" + "-" * 80)
        for currency, addrs in sorted(by_currency.items()):
            available = len([a for a in addrs if a['status'] == 'available'])
            reserved = len([a for a in addrs if a['status'] == 'reserved'])
            used = len([a for a in addrs if a['status'] == 'used'])
            
            print(f"\n📦 {currency}: {len(addrs)} address(es)")
            print(f"   Available: {available} | Reserved: {reserved} | Used: {used}")
            
            for a in addrs:
                addr_str = a['address'][:50] + "..." if a['address'] and len(a['address']) > 50 else a['address']
                print(f"   • [{a['status']:10}] {addr_str}")
                print(f"     Index: {a['derivation_index']} | Created: {a['created_at']}")
    else:
        print("\n⚠️ No temporary addresses found for this merchant!")
        print("   Pool addresses are created on-demand when payments are initiated.")

# Also check total pool addresses across all merchants
print("\n" + "=" * 80)
print("OVERALL POOL STATISTICS")
print("=" * 80)

cursor.execute("""
    SELECT 
        currency,
        status,
        COUNT(*) as count
    FROM tbl_merchant_temp_address
    GROUP BY currency, status
    ORDER BY currency, status;
""")

stats = cursor.fetchall()
if stats:
    print("\nAll merchants pool summary:")
    current_currency = None
    for stat in stats:
        if stat[0] != current_currency:
            current_currency = stat[0]
            print(f"\n  {current_currency}:")
        print(f"    - {stat[1]}: {stat[2]}")
else:
    print("\nNo pool addresses exist in the system.")

conn.close()
