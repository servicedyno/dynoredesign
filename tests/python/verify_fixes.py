import requests
import json

BASE_URL = "https://setup-tooling.preview.emergentagent.com/api"

print("=" * 80)
print("VERIFYING FIXES")
print("=" * 80)

# Login and check photo URL
print("\n1. Checking photo URL fix for john@dyno.pt...")
login_response = requests.post(f"{BASE_URL}/user/login", json={
    "email": "john@dyno.pt",
    "password": "Katiekendra123@"
})

login_data = login_response.json()
user_data = login_data.get("data", {}).get("userData", {})
photo_url = user_data.get("photo", "")

print(f"   Photo URL: {photo_url}")

if "emergentagent.com/images" in photo_url or "emergentagent.com/api" in photo_url or not photo_url:
    print("   ✅ Photo URL is properly formatted!")
else:
    print("   ❌ Photo URL may still be malformed")

# Check user 29 as well
print("\n2. Checking database for remaining malformed URLs...")
import psycopg2
conn = psycopg2.connect(
    host="shortline.proxy.rlwy.net",
    port=44579,
    database="db_bozzwallet",
    user="postgres",
    password="JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO"
)
cursor = conn.cursor()

cursor.execute("""
    SELECT user_id, photo FROM tbl_user 
    WHERE photo LIKE '%emergentagent.comimages%'
       OR photo LIKE '%emergentagent.comapi%';
""")
malformed = cursor.fetchall()

if len(malformed) == 0:
    print("   ✅ No malformed photo URLs found in database!")
else:
    print(f"   ❌ Still found {len(malformed)} malformed URLs")
    for m in malformed:
        print(f"      User {m[0]}: {m[1][:60]}...")

conn.close()

print("\n" + "=" * 80)
print("VERIFICATION COMPLETE")
print("=" * 80)
