import psycopg2

conn = psycopg2.connect(
    host="tramway.proxy.rlwy.net", port=57376,
    dbname="db_bozzwallet", user="postgres",
    password="oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV"
)
cur = conn.cursor()

# Get all users
cur.execute("SELECT user_id, email, name, username FROM tbl_user ORDER BY user_id")
users = cur.fetchall()

header = f"  {'UID':>5s} | {'Email':30s} | {'Name':20s} | Crypto | w/Addr | NoAddr | Companies  | xPub | Pool"
print("=== ALL MERCHANTS - CRYPTO WALLET STATUS ===\n")
print(header)
print("-" * len(header))

nomadly_like = []

for u in users:
    uid, email, name, username = u

    # Crypto wallets
    cur.execute("""
        SELECT wallet_id, wallet_type, wallet_address, company_id
        FROM tbl_user_wallet WHERE user_id = %s AND currency_type = 'CRYPTO'
    """, (uid,))
    crypto = cur.fetchall()

    with_addr = [c for c in crypto if c[2] is not None]
    no_addr = [c for c in crypto if c[2] is None]
    company_ids = set(c[3] for c in crypto if c[3] is not None)
    has_null_company = any(c[3] is None for c in crypto)
    
    parts = []
    if company_ids:
        parts.append(",".join(str(c) for c in sorted(company_ids)))
    if has_null_company:
        parts.append("NULL")
    company_str = " | ".join(parts) if parts else "-"

    # Merchant wallets (xpub)
    cur.execute("SELECT COUNT(*) FROM tbl_merchant_wallet WHERE user_id = %s", (uid,))
    mw_count = cur.fetchone()[0]

    # Pool temp addresses
    cur.execute("SELECT COUNT(*) FROM tbl_merchant_temp_address WHERE owner_user_id = %s", (uid,))
    pool_count = cur.fetchone()[0]

    # Flag if similar to old nomadly
    is_like_nomadly = len(no_addr) > 0 and len(with_addr) == 0 and pool_count == 0
    flag = "⚠️" if is_like_nomadly else "  "

    display_name = str(name)[:20] if name else "-"
    
    print(f"{flag} {uid:>5d} | {email:30s} | {display_name:20s} | {len(crypto):>6d} | {len(with_addr):>6d} | {len(no_addr):>6d} | {company_str:>10s} | {mw_count:>4d} | {pool_count:>4d}")

    if is_like_nomadly:
        # Get detail on which currencies are missing
        missing = [c[1] for c in no_addr]
        cur.execute("SELECT company_id, company_name FROM tbl_company WHERE user_id = %s", (uid,))
        companies = cur.fetchall()
        nomadly_like.append({
            "uid": uid,
            "email": email,
            "name": name,
            "crypto_count": len(crypto),
            "missing_currencies": missing,
            "companies": companies,
            "has_null_company": has_null_company,
        })

print(f"\n{'='*80}")
print(f"⚠️  MERCHANTS SIMILAR TO OLD NOMADLY: {len(nomadly_like)}")
print(f"    (crypto wallets with ALL wallet_address=NULL + no merchant pool)")
print(f"{'='*80}\n")

for m in nomadly_like:
    print(f"  user_id={m['uid']} | {m['email']} | {m['name']}")
    print(f"    Crypto wallets: {m['crypto_count']} (all without addresses)")
    print(f"    Missing addresses for: {', '.join(m['missing_currencies'])}")
    print(f"    company_id=NULL: {m['has_null_company']}")
    companies_str = ", ".join(f"id={c[0]} ({c[1]})" for c in m['companies']) if m['companies'] else "NONE"
    print(f"    Companies: {companies_str}")
    print()

cur.close()
conn.close()
