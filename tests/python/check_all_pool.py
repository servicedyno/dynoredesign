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
print("TEMPORARY ADDRESS POOL FOR MERCHANT john@dyno.pt (owner_user_id: 28)")
print("=" * 80)

# Get all addresses owned by user 28
cursor.execute("""
    SELECT 
        temp_address_id,
        wallet_type,
        wallet_address,
        status,
        current_company_id,
        derivation_index,
        total_transactions,
        admin_fee_balance
    FROM tbl_merchant_temp_address
    WHERE owner_user_id = 28
    ORDER BY wallet_type, temp_address_id;
""")

addresses = cursor.fetchall()

print(f"\n✅ Total pool addresses for merchant: {len(addresses)}")

# Group by currency
by_currency = {}
for addr in addresses:
    currency = addr[1]
    if currency not in by_currency:
        by_currency[currency] = []
    by_currency[currency].append({
        'id': addr[0],
        'address': addr[2],
        'status': addr[3],
        'company': addr[4],
        'index': addr[5],
        'tx_count': addr[6],
        'admin_fee': addr[7]
    })

print("\n" + "-" * 80)
print("POOL ADDRESSES BY CURRENCY")
print("-" * 80)

for currency in sorted(by_currency.keys()):
    addrs = by_currency[currency]
    available = len([a for a in addrs if a['status'] == 'AVAILABLE'])
    reserved = len([a for a in addrs if a['status'] == 'RESERVED'])
    processing = len([a for a in addrs if a['status'] == 'PROCESSING'])
    
    print(f"\n📦 {currency}: {len(addrs)} address(es)")
    print(f"   ✅ Available: {available} | 🔒 Reserved: {reserved} | ⏳ Processing: {processing}")
    
    for a in addrs:
        addr_display = a['address'][:55] if a['address'] else 'N/A'
        status_icon = "✅" if a['status'] == 'AVAILABLE' else "🔒" if a['status'] == 'RESERVED' else "⏳"
        print(f"\n   {status_icon} Address #{a['id']}:")
        print(f"      {addr_display}")
        print(f"      Status: {a['status']} | Index: {a['index']} | Txs: {a['tx_count'] or 0}")

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

total_available = sum(1 for c in by_currency.values() for a in c if a['status'] == 'AVAILABLE')
total_reserved = sum(1 for c in by_currency.values() for a in c if a['status'] == 'RESERVED')
total_processing = sum(1 for c in by_currency.values() for a in c if a['status'] == 'PROCESSING')

print(f"\n🏦 Merchant: john@dyno.pt (user_id: 28)")
print(f"\n📊 Pool Statistics:")
print(f"   • Total addresses: {len(addresses)}")
print(f"   • Available for new payments: {total_available}")
print(f"   • Currently reserved: {total_reserved}")
print(f"   • Processing payments: {total_processing}")
print(f"\n💰 Currencies covered: {', '.join(sorted(by_currency.keys()))}")

conn.close()
