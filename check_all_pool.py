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
print("COMPLETE POOL STATUS CHECK")
print("=" * 80)

# Total count
cursor.execute("SELECT COUNT(*) FROM tbl_merchant_temp_address;")
total = cursor.fetchone()[0]
print(f"\n📊 Total addresses in tbl_merchant_temp_address: {total}")

if total > 0:
    # Get all addresses
    cursor.execute("""
        SELECT 
            temp_address_id,
            wallet_type,
            wallet_address,
            status,
            current_company_id,
            owner_user_id
        FROM tbl_merchant_temp_address
        ORDER BY wallet_type;
    """)
    
    for row in cursor.fetchall():
        print(f"\n  ID: {row[0]}")
        print(f"  Type: {row[1]}")
        print(f"  Address: {row[2][:50]}..." if row[2] and len(row[2]) > 50 else f"  Address: {row[2]}")
        print(f"  Status: {row[3]}")
        print(f"  Company: {row[4]}")
        print(f"  Owner: {row[5]}")
else:
    print("\n⚠️ The temporary address pool is EMPTY!")
    print("   No addresses have been generated yet.")

# Check merchant wallet (xpub) table
print("\n" + "=" * 80)
print("MERCHANT WALLET (XPUB) TABLE CHECK")
print("=" * 80)

cursor.execute("SELECT COUNT(*) FROM tbl_merchant_wallet;")
wallet_count = cursor.fetchone()[0]
print(f"\n📊 Total entries in tbl_merchant_wallet: {wallet_count}")

if wallet_count > 0:
    cursor.execute("""
        SELECT company_id, wallet_type, xpub, current_index
        FROM tbl_merchant_wallet
        WHERE company_id = 38;
    """)
    wallets = cursor.fetchall()
    
    print(f"\nMerchant wallets for company_id=38: {len(wallets)}")
    for w in wallets:
        xpub_short = w[2][:50] + "..." if w[2] and len(w[2]) > 50 else w[2]
        print(f"  • {w[1]}: index={w[3]}, xpub={xpub_short}")
else:
    print("\n⚠️ No merchant wallets (xpubs) configured!")
    print("   Merchant pool system has not been initialized.")

conn.close()
