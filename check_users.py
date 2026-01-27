import requests

BASE_URL = "https://simple-setup-6.preview.emergentagent.com"

# Try different possible credentials
credentials = [
    ("john@dyno.pt", "Katiekendra123@"),
    ("moxxcompany@gmail.com", "Moxx2024"),
    ("admin@dynopay.com", "admin123"),
    ("test@example.com", "password123"),
]

print("Checking available user accounts...\n")

for email, password in credentials:
    print(f"Trying: {email}")
    response = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        print(f"  ✅ SUCCESS!")
        token = response.json()["data"]["token"]
        
        # Get user profile
        profile = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        if profile.status_code == 200:
            print(f"  Profile: {profile.json()}")
        
        # Get companies
        companies = requests.get(
            f"{BASE_URL}/api/company/getCompany",
            headers={"Authorization": f"Bearer {token}"}
        )
        if companies.status_code == 200:
            print(f"  Companies: {companies.json()}")
        break
    else:
        print(f"  ❌ Failed: {response.json().get('message', 'Unknown error')}")

print("\n" + "="*60)
