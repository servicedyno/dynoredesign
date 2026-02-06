import psycopg2
import json

conn = psycopg2.connect(
    host="tramway.proxy.rlwy.net",
    port=57376,
    dbname="db_bozzwallet",
    user="postgres",
    password="oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV"
)
cur = conn.cursor()

print("=" * 80)
print("MERCHANT ANALYSIS: richard@dyno.pt vs nomadly@moxx.co")
print("=" * 80)

# 1. Get user info
print("\n--- 1. USER INFO ---")
cur.execute("SELECT user_id, email, name, username FROM tbl_user WHERE email IN ('richard@dyno.pt', 'nomadly@moxx.co') ORDER BY email")
users = cur.fetchall()
user_map = {}
for u in users:
    user_map[u[1]] = u[0]
    print(f"  user_id={u[0]}, email={u[1]}, name={u[2]}, username={u[3]}")

# 2. Get companies
print("\n--- 2. COMPANIES ---")
for email, uid in user_map.items():
    cur.execute("SELECT company_id, company_name, country FROM tbl_company WHERE user_id = %s", (uid,))
    companies = cur.fetchall()
    print(f"  [{email}] (user_id={uid}):")
    for c in companies:
        print(f"    company_id={c[0]}, name={c[1]}, country={c[2]}")

# 3. Saved wallet addresses (tbl_user_addresses)
print("\n--- 3. SAVED WALLET ADDRESSES (tbl_user_addresses) ---")
for email, uid in user_map.items():
    cur.execute("""
        SELECT user_address_id, user_id, company_id, wallet_name, label, currency, wallet_address, "createdAt"
        FROM tbl_user_addresses 
        WHERE user_id = %s 
        ORDER BY "createdAt" DESC
    """, (uid,))
    addrs = cur.fetchall()
    print(f"\n  [{email}] (user_id={uid}): {len(addrs)} addresses")
    for a in addrs:
        print(f"    id={a[0]}, company_id={a[2]}, name='{a[3]}', label='{a[4]}', currency={a[5]}, address={a[6]}, created={a[7]}")

# 4. User wallets (tbl_user_wallet) — fiat/crypto balance wallets
print("\n--- 4. USER WALLETS (tbl_user_wallet) ---")
for email, uid in user_map.items():
    cur.execute("""
        SELECT wallet_id, user_id, company_id, wallet_name, amount, wallet_type, wallet_address, currency_type, "createdAt"
        FROM tbl_user_wallet 
        WHERE user_id = %s 
        ORDER BY currency_type, wallet_type
    """, (uid,))
    wallets = cur.fetchall()
    print(f"\n  [{email}] (user_id={uid}): {len(wallets)} wallets")
    for w in wallets:
        print(f"    id={w[0]}, company_id={w[2]}, name='{w[3]}', amount={w[4]}, type={w[5]}, address={w[6]}, currency_type={w[7]}, created={w[8]}")

# 5. Merchant wallets (tbl_merchant_wallet) — xpub HD wallets
print("\n--- 5. MERCHANT WALLETS (tbl_merchant_wallet) ---")
for email, uid in user_map.items():
    cur.execute("""
        SELECT wallet_id, user_id, wallet_type, last_derivation_index, created_at
        FROM tbl_merchant_wallet 
        WHERE user_id = %s 
        ORDER BY wallet_type
    """, (uid,))
    mwallets = cur.fetchall()
    print(f"\n  [{email}] (user_id={uid}): {len(mwallets)} merchant wallets")
    for m in mwallets:
        print(f"    id={m[0]}, chain={m[2]}, last_derivation_index={m[3]}, created={m[4]}")

# 6. Merchant temp addresses (tbl_merchant_temp_address) — pool addresses
print("\n--- 6. MERCHANT TEMP ADDRESSES (tbl_merchant_temp_address) ---")
for email, uid in user_map.items():
    cur.execute("""
        SELECT temp_address_id, owner_user_id, wallet_type, wallet_address, status, 
               total_transactions, admin_fee_balance, current_payment_id, created_at
        FROM tbl_merchant_temp_address 
        WHERE owner_user_id = %s 
        ORDER BY wallet_type, status
    """, (uid,))
    taddrs = cur.fetchall()
    print(f"\n  [{email}] (user_id={uid}): {len(taddrs)} temp addresses")
    for t in taddrs:
        print(f"    id={t[0]}, chain={t[2]}, address={t[3]}, status={t[4]}, txs={t[5]}, admin_fee={t[6]}, payment_id={t[7]}, created={t[8]}")

# 7. Summary comparison
print("\n" + "=" * 80)
print("SUMMARY COMPARISON")
print("=" * 80)
for email, uid in user_map.items():
    cur.execute("SELECT COUNT(*) FROM tbl_user_addresses WHERE user_id = %s", (uid,))
    addr_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tbl_user_wallet WHERE user_id = %s", (uid,))
    wallet_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tbl_merchant_wallet WHERE user_id = %s", (uid,))
    mwallet_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tbl_merchant_temp_address WHERE owner_user_id = %s", (uid,))
    temp_count = cur.fetchone()[0]
    print(f"\n  [{email}] (user_id={uid}):")
    print(f"    tbl_user_addresses (saved payout addrs): {addr_count}")
    print(f"    tbl_user_wallet (balance wallets):       {wallet_count}")
    print(f"    tbl_merchant_wallet (xpub HD wallets):   {mwallet_count}")
    print(f"    tbl_merchant_temp_address (pool addrs):  {temp_count}")

cur.close()
conn.close()
print("\nDone.")
