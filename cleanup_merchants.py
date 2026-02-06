import psycopg2

conn = psycopg2.connect(
    host="tramway.proxy.rlwy.net", port=57376,
    dbname="db_bozzwallet", user="postgres",
    password="oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV"
)
cur = conn.cursor()

KEEP_UIDS = (4, 16, 28)

# Get companies to delete
cur.execute("SELECT company_id FROM tbl_company WHERE user_id NOT IN %s", (KEEP_UIDS,))
del_company_ids = tuple(c[0] for c in cur.fetchall()) or (0,)

# Get customers to delete (belong to deleted companies)
cur.execute("SELECT customer_id FROM tbl_customer WHERE company_id IN %s", (del_company_ids,))
del_customer_ids = tuple(c[0] for c in cur.fetchall()) or (0,)

print("=" * 60)
print("CLEANUP: Deleting all users except uid 4, 16, 28")
print(f"  Companies to delete: {len(del_company_ids)} -> {del_company_ids}")
print(f"  Customers to delete: {len(del_customer_ids)}")
print("=" * 60)

# Delete in FK-safe order (children first)
steps = [
    ("tbl_customer_wallet",       f"customer_id IN %s",               del_customer_ids),
    ("tbl_customer_transaction",  f"company_id IN %s",                del_company_ids),
    ("tbl_customer",              f"company_id IN %s",                del_company_ids),
    ("tbl_referee_code",          f"referrer_user_id NOT IN %s",      KEEP_UIDS),
    ("tbl_webhook_delivery_log",  f"company_id IN %s",                del_company_ids),
    ("tbl_notification",          f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_notification_preferences", f"user_id NOT IN %s",            KEEP_UIDS),
    ("tbl_user_transaction",      f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_user_temp_address",     f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_user_addresses",        f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_user_wallet",           f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_api",                   f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_payment_link",          f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_company",               f"user_id NOT IN %s",               KEEP_UIDS),
    ("tbl_user",                  f"user_id NOT IN %s",               KEEP_UIDS),
]

total_deleted = 0
for table, condition, params in steps:
    try:
        sql = f'DELETE FROM "{table}" WHERE {condition}'
        cur.execute(sql, (params,))
        count = cur.rowcount
        total_deleted += count
        icon = "✅" if count > 0 else "  "
        print(f"  {icon} {table:35s} -> {count} rows deleted")
    except Exception as e:
        print(f"  ❌ {table:35s} -> ERROR: {e}")
        conn.rollback()

conn.commit()

print(f"\nTotal rows deleted: {total_deleted}")
print()

# Verify what's left
print("=== VERIFICATION: Remaining data ===")
tables_to_check = [
    "tbl_user", "tbl_company", "tbl_user_wallet", "tbl_user_addresses",
    "tbl_merchant_wallet", "tbl_merchant_temp_address", "tbl_api",
    "tbl_payment_link", "tbl_customer", "tbl_notification"
]
for t in tables_to_check:
    cur.execute(f'SELECT COUNT(*) FROM "{t}"')
    print(f"  {t}: {cur.fetchone()[0]} rows")

print()
print("=== REMAINING USERS ===")
cur.execute("SELECT user_id, email, name FROM tbl_user ORDER BY user_id")
for r in cur.fetchall():
    print(f"  ✅ uid={r[0]} | {r[1]} | {r[2]}")

cur.close()
conn.close()
print("\nDone.")
