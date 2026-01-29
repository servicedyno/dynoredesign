import requests
import json

BASE_URL = "https://dependinstall.preview.emergentagent.com/api"

# Login credentials
email = "john@dyno.pt"
password = "Katiekendra123@"

print("=" * 60)
print("MERCHANT POOL ADDRESS CHECK - john@dyno.pt")
print("=" * 60)

# Step 1: Login
print("\n1. Authenticating merchant...")
login_response = requests.post(f"{BASE_URL}/user/login", json={
    "email": email,
    "password": password
})

print(f"   Login response status: {login_response.status_code}")
login_data = login_response.json()
print(f"   Response keys: {login_data.keys()}")

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    print(json.dumps(login_data, indent=2))
    exit(1)

# Extract token - check different possible structures
token = None
if "token" in login_data:
    token = login_data["token"]
elif "data" in login_data and isinstance(login_data["data"], dict):
    token = login_data["data"].get("token")

user_data = login_data.get("data", login_data)
if isinstance(user_data, str):
    user_data = login_data

print(f"✅ Logged in as: {user_data.get('name', 'N/A')} (user_id: {user_data.get('user_id', 'N/A')})")
print(f"   Company ID: {user_data.get('company_id', 'N/A')}")
print(f"   Token found: {'Yes' if token else 'No'}")

if not token:
    print("Full response:")
    print(json.dumps(login_data, indent=2))
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get wallet addresses
print("\n2. Fetching wallet addresses...")
wallet_response = requests.get(f"{BASE_URL}/wallet/getWalletAddresses", headers=headers)

if wallet_response.status_code == 200:
    wallet_data = wallet_response.json()
    addresses = wallet_data.get("data", [])
    print(f"✅ Found {len(addresses)} wallet addresses")
    
    if addresses:
        # Group by currency
        by_currency = {}
        for addr in addresses:
            currency = addr.get("currency", "Unknown")
            if currency not in by_currency:
                by_currency[currency] = []
            by_currency[currency].append(addr)
        
        print("\n   Addresses by currency:")
        for currency, addrs in sorted(by_currency.items()):
            print(f"   - {currency}: {len(addrs)} address(es)")
            for a in addrs:
                addr_str = a.get("address", "N/A")
                status = a.get("status", "N/A")
                print(f"     • {addr_str[:45]}... (status: {status})")
    else:
        print("   No wallet addresses found in pool")
else:
    print(f"❌ Failed to get wallet addresses: {wallet_response.status_code}")
    print(wallet_response.text)

# Step 3: Get wallets (merchant wallets/xpubs)
print("\n3. Fetching merchant wallets (xpubs)...")
wallets_response = requests.get(f"{BASE_URL}/wallet/getWallet", headers=headers)

if wallets_response.status_code == 200:
    wallets_data = wallets_response.json()
    wallets = wallets_data.get("data", [])
    print(f"✅ Found {len(wallets)} merchant wallets")
    
    # Filter crypto wallets
    crypto_wallets = [w for w in wallets if w.get("wallet_type") not in ["USD", "EUR", "GBP", "NGN"]]
    fiat_wallets = [w for w in wallets if w.get("wallet_type") in ["USD", "EUR", "GBP", "NGN"]]
    
    print(f"   - Crypto wallets: {len(crypto_wallets)}")
    print(f"   - Fiat wallets: {len(fiat_wallets)}")
    
    if crypto_wallets:
        print("\n   Crypto wallet types configured:")
        for w in crypto_wallets:
            wtype = w.get('wallet_type', 'N/A')
            addr = w.get('address', 'N/A')
            if addr and len(addr) > 50:
                addr = addr[:50] + "..."
            print(f"   - {wtype}: {addr}")
else:
    print(f"❌ Failed to get wallets: {wallets_response.status_code}")

# Step 4: Check dashboard for pool status
print("\n4. Checking dashboard for pool status...")
dashboard_response = requests.get(f"{BASE_URL}/dashboard", headers=headers)

if dashboard_response.status_code == 200:
    dashboard_data = dashboard_response.json()
    data = dashboard_data.get("data", {})
    print(f"✅ Dashboard data retrieved")
    print(f"   - Active wallets: {data.get('active_wallets', 'N/A')}")
    print(f"   - Total transactions: {data.get('total_transactions', {}).get('count', 'N/A')}")
    print(f"   - Fee tier: {data.get('fee_tier', {}).get('current_tier', 'N/A')}")
else:
    print(f"❌ Failed to get dashboard: {dashboard_response.status_code}")

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
