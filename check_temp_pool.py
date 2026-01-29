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

# First check table structure
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tbl_merchant_temp_address'
    ORDER BY ordinal_position;
""")
columns = cursor.fetchall()

if not columns:
    print("\n❌ Table 'tbl_merchant_temp_address' does not exist!")
else:
    print("\nTable structure:")
    for col in columns:
        print(f"  - {col[0]}: {col[1]}")
    
    # Get all columns dynamically
    col_names = [c[0] for c in columns]
    
    # Query all data for company 38
    cursor.execute(f"""
        SELECT * FROM tbl_merchant_temp_address
        WHERE company_id = 38
        ORDER BY currency;
    """)
    
    addresses = cursor.fetchall()
    
    print(f"\n✅ Found {len(addresses)} temporary pool addresses for company_id=38")
    
    if addresses:
        print("\n" + "-" * 80)
        for addr in addresses:
            print("\nAddress Record:")
            for i, col in enumerate(col_names):
                val = addr[i]
                if isinstance(val, str) and len(val) > 60:
                    val = val[:60] + "..."
                print(f"  {col}: {val}")
    else:
        print("\n⚠️ No temporary pool addresses found for merchant john@dyno.pt!")
        
    # Get overall stats
    cursor.execute("""
        SELECT currency, status, COUNT(*) 
        FROM tbl_merchant_temp_address 
        GROUP BY currency, status 
        ORDER BY currency, status;
    """)
    stats = cursor.fetchall()
    
    print("\n" + "=" * 80)
    print("OVERALL POOL STATISTICS (All Merchants)")
    print("=" * 80)
    
    if stats:
        for s in stats:
            print(f"  {s[0]} - {s[1]}: {s[2]} addresses")
    else:
        print("  No pool addresses in system")

conn.close()
