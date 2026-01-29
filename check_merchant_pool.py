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

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)

login_data = login_response.json()
token = login_data.get("data", {}).get("token") or login_data.get("token")
user_data = login_data.get("data", {})
print(f"✅ Logged in as: {user_data.get('name', 'N/A')} (user_id: {user_data.get('user_id', 'N/A')})")
print(f"   Company ID: {user_data.get('company_id', 'N/A')}")

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
                print(f"     • {a.get('address', 'N/A')[:40]}...")
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
        print("\n   Crypto wallet types:")
        for w in crypto_wallets:
            print(f"   - {w.get('wallet_type', 'N/A')}: {w.get('address', 'N/A')[:50]}...")
else:
    print(f"❌ Failed to get wallets: {wallets_response.status_code}")

# Step 4: Check merchant pool status via dashboard
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
print("CHECK COMPLETE")
print("=" * 60)
