import requests
import json

BASE_URL = "https://dep-manager-3.preview.emergentagent.com/api"

# Login
login_response = requests.post(f"{BASE_URL}/user/login", json={
    "email": "john@dyno.pt",
    "password": "Katiekendra123@"
})
login_data = login_response.json()
token = login_data.get("data", {}).get("accessToken")
headers = {"Authorization": f"Bearer {token}"}

print("=" * 70)
print("MERCHANT POOL DETAILED CHECK - john@dyno.pt")
print("=" * 70)

# Get wallet addresses with full data
wallet_response = requests.get(f"{BASE_URL}/wallet/getWalletAddresses", headers=headers)
wallet_data = wallet_response.json()

print("\nRaw Pool Address Data:")
print("-" * 70)
addresses = wallet_data.get("data", [])
for addr in addresses:
    print(json.dumps(addr, indent=2))
    print("-" * 40)

print(f"\n✅ TOTAL POOL ADDRESSES: {len(addresses)}")
print("=" * 70)
