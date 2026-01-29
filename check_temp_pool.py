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
print("MERCHANT TEMPORARY ADDRESS POOL - john@dyno.pt (company_id: 38)")
print("=" * 80)

# Query pool addresses - either currently assigned to company 38 OR available
cursor.execute("""
    SELECT 
        temp_address_id,
        wallet_type,
        wallet_address,
        status,
        derivation_index,
        current_company_id,
        admin_fee_balance,
        total_transactions,
        current_payment_id,
        created_at
    FROM tbl_merchant_temp_address
    WHERE current_company_id = 38 OR status = 'available'
    ORDER BY wallet_type, status;
""")

addresses = cursor.fetchall()

print(f"\n✅ Found {len(addresses)} pool addresses (assigned to company 38 or available)")

# Group by currency
by_currency = {}
for addr in addresses:
    currency = addr[1]
    if currency not in by_currency:
        by_currency[currency] = {'available': [], 'reserved': [], 'processing': [], 'other': []}
    
    status = addr[3] or 'unknown'
    record = {
        'id': addr[0],
        'address': addr[2],
        'status': status,
        'index': addr[4],
        'company_id': addr[5],
        'admin_fee': addr[6],
        'tx_count': addr[7],
        'payment_id': addr[8],
        'created': addr[9]
    }
    
    if status == 'available':
        by_currency[currency]['available'].append(record)
    elif status == 'reserved':
        by_currency[currency]['reserved'].append(record)
    elif status == 'processing':
        by_currency[currency]['processing'].append(record)
    else:
        by_currency[currency]['other'].append(record)

print("\n" + "-" * 80)
print("POOL ADDRESSES BY CURRENCY")
print("-" * 80)

for currency in sorted(by_currency.keys()):
    data = by_currency[currency]
    available = len(data['available'])
    reserved = len(data['reserved'])
    processing = len(data['processing'])
    other = len(data['other'])
    total = available + reserved + processing + other
    
    print(f"\n📦 {currency}: {total} total")
    print(f"   ✅ Available: {available} | 🔒 Reserved: {reserved} | ⏳ Processing: {processing} | Other: {other}")
    
    # Show details for each address
    all_addrs = data['available'] + data['reserved'] + data['processing'] + data['other']
    for a in all_addrs:
        addr_short = a['address'][:45] + "..." if a['address'] and len(a['address']) > 45 else a['address']
        company_info = f"company={a['company_id']}" if a['company_id'] else "unassigned"
        print(f"   • [{a['status']:10}] {addr_short}")
        print(f"     ID: {a['id']} | Index: {a['index']} | {company_info} | Txs: {a['tx_count']}")

# Summary for company 38 specifically
print("\n" + "=" * 80)
print("SUMMARY FOR MERCHANT john@dyno.pt (company_id: 38)")
print("=" * 80)

cursor.execute("""
    SELECT wallet_type, status, COUNT(*) 
    FROM tbl_merchant_temp_address 
    WHERE current_company_id = 38
    GROUP BY wallet_type, status
    ORDER BY wallet_type;
""")
merchant_stats = cursor.fetchall()

if merchant_stats:
    print("\nAddresses currently assigned to this merchant:")
    for s in merchant_stats:
        print(f"  • {s[0]}: {s[2]} ({s[1]})")
else:
    print("\n⚠️ No pool addresses currently assigned to this merchant")
    print("   Addresses are assigned when a payment is initiated")

# Total available in system
cursor.execute("""
    SELECT wallet_type, COUNT(*) 
    FROM tbl_merchant_temp_address 
    WHERE status = 'available'
    GROUP BY wallet_type
    ORDER BY wallet_type;
""")
available_stats = cursor.fetchall()

print("\nAvailable addresses in pool (ready for any merchant):")
if available_stats:
    for s in available_stats:
        print(f"  • {s[0]}: {s[1]} available")
else:
    print("  ⚠️ No available addresses - pool needs initialization")

conn.close()
