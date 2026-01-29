import psycopg2

conn = psycopg2.connect(
    host="shortline.proxy.rlwy.net",
    port=44579,
    database="db_bozzwallet",
    user="postgres",
    password="JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO"
)

cursor = conn.cursor()

print("=" * 80)
print("MERCHANT POOL STATUS - ALL ADDRESSES")
print("=" * 80)

cursor.execute("""
    SELECT 
        temp_address_id,
        wallet_type,
        wallet_address,
        status,
        admin_fee_balance,
        last_merchant_payout,
        total_transactions,
        owner_user_id,
        current_company_id,
        current_payment_id
    FROM tbl_merchant_temp_address
    ORDER BY wallet_type, status;
""")

addresses = cursor.fetchall()

print(f"\nTotal pool addresses: {len(addresses)}")
print("\n" + "-" * 80)

for addr in addresses:
    print(f"\n📍 ID: {addr[0]} | {addr[1]}")
    print(f"   Address: {addr[2][:50]}...")
    print(f"   Status: {addr[3]}")
    print(f"   Admin Fee Balance: {addr[4]}")
    print(f"   Last Merchant Payout: {addr[5]}")
    print(f"   Total Txs: {addr[6]}")
    print(f"   Owner: {addr[7]} | Company: {addr[8]} | Payment: {addr[9]}")

# Check for sweep candidates
print("\n" + "=" * 80)
print("SWEEP CANDIDATES")
print("=" * 80)

# Threshold candidates
cursor.execute("""
    SELECT COUNT(*) FROM tbl_merchant_temp_address 
    WHERE status = 'AVAILABLE' AND admin_fee_balance > 0;
""")
threshold_count = cursor.fetchone()[0]
print(f"\n📊 Threshold sweep candidates (AVAILABLE + fee > 0): {threshold_count}")

# Time-based candidates
cursor.execute("""
    SELECT COUNT(*) FROM tbl_merchant_temp_address 
    WHERE status = 'IN_USE' AND admin_fee_balance > 0 AND last_merchant_payout IS NOT NULL;
""")
time_count = cursor.fetchone()[0]
print(f"📊 Time-based sweep candidates (IN_USE + fee > 0 + payout set): {time_count}")

# Reserved addresses
cursor.execute("""
    SELECT COUNT(*) FROM tbl_merchant_temp_address 
    WHERE status = 'RESERVED';
""")
reserved_count = cursor.fetchone()[0]
print(f"📊 Currently reserved: {reserved_count}")

conn.close()
