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
print("FIXING MALFORMED PHOTO URLs IN DATABASE")
print("=" * 80)

# Check for malformed URLs in tbl_user
cursor.execute("""
    SELECT user_id, photo FROM tbl_user 
    WHERE photo LIKE '%emergentagent.comimages%'
       OR photo LIKE '%emergentagent.comapi%'
       OR (photo LIKE '%.com%' AND photo NOT LIKE '%.com/%');
""")
malformed_users = cursor.fetchall()

print(f"\n📊 Found {len(malformed_users)} users with malformed photo URLs")

for user in malformed_users:
    user_id = user[0]
    old_url = user[1]
    
    if old_url:
        # Fix: add slash before 'images/' or 'api/'
        new_url = old_url.replace('emergentagent.comimages/', 'emergentagent.com/images/')
        new_url = new_url.replace('emergentagent.comapi/', 'emergentagent.com/api/')
        
        print(f"\n👤 User {user_id}:")
        print(f"   OLD: {old_url[:70]}...")
        print(f"   NEW: {new_url[:70]}...")
        
        cursor.execute("""
            UPDATE tbl_user SET photo = %s WHERE user_id = %s;
        """, (new_url, user_id))

# Check for malformed URLs in tbl_company
cursor.execute("""
    SELECT company_id, photo FROM tbl_company 
    WHERE photo LIKE '%emergentagent.comimages%'
       OR photo LIKE '%emergentagent.comapi%';
""")
malformed_companies = cursor.fetchall()

print(f"\n📊 Found {len(malformed_companies)} companies with malformed photo URLs")

for company in malformed_companies:
    company_id = company[0]
    old_url = company[1]
    
    if old_url:
        new_url = old_url.replace('emergentagent.comimages/', 'emergentagent.com/images/')
        new_url = new_url.replace('emergentagent.comapi/', 'emergentagent.com/api/')
        
        print(f"\n🏢 Company {company_id}:")
        print(f"   OLD: {old_url[:70]}...")
        print(f"   NEW: {new_url[:70]}...")
        
        cursor.execute("""
            UPDATE tbl_company SET photo = %s WHERE company_id = %s;
        """, (new_url, company_id))

conn.commit()
print("\n" + "=" * 80)
print("✅ Photo URL fixes completed!")
print("=" * 80)

conn.close()
