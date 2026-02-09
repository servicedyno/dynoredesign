import requests
import json

BASE_URL = "https://dep-init.preview.emergentagent.com/api"

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

login_data = login_response.json()

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    exit(1)

# Extract token from data.accessToken
token = login_data.get("data", {}).get("accessToken")
user_data = login_data.get("data", {}).get("userData", {})

print(f"✅ Logged in as: {user_data.get('name', 'N/A')} (user_id: {user_data.get('user_id', 'N/A')})")
print(f"   Email: {user_data.get('email', 'N/A')}")
print(f"   Status: {user_data.get('status', 'N/A')}")

headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get wallet addresses (pool addresses)
print("\n2. Fetching pool wallet addresses...")
wallet_response = requests.get(f"{BASE_URL}/wallet/getWalletAddresses", headers=headers)

if wallet_response.status_code == 200:
    wallet_data = wallet_response.json()
    addresses = wallet_data.get("data", [])
    print(f"✅ Found {len(addresses)} pool addresses")
    
    if addresses:
        # Group by currency
        by_currency = {}
        for addr in addresses:
            currency = addr.get("currency", "Unknown")
            if currency not in by_currency:
                by_currency[currency] = []
            by_currency[currency].append(addr)
        
        print("\n   Pool Addresses by Currency:")
        print("   " + "-" * 50)
        for currency, addrs in sorted(by_currency.items()):
            print(f"\n   {currency}: {len(addrs)} address(es)")
            for a in addrs:
                addr_str = a.get("address", "N/A")
                status = a.get("status", "N/A")
                print(f"     • {addr_str[:50]}...")
                print(f"       Status: {status}")
    else:
        print("   ⚠️ No pool addresses found - pool may not be initialized")
else:
    print(f"❌ Failed to get wallet addresses: {wallet_response.status_code}")
    print(wallet_response.text)

# Step 3: Get wallets (merchant xpub wallets)
print("\n3. Fetching merchant wallets (xpubs)...")
wallets_response = requests.get(f"{BASE_URL}/wallet/getWallet", headers=headers)

if wallets_response.status_code == 200:
    wallets_data = wallets_response.json()
    wallets = wallets_data.get("data", [])
    print(f"✅ Found {len(wallets)} total wallets")
    
    # Filter crypto vs fiat wallets
    fiat_types = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"]
    crypto_wallets = [w for w in wallets if w.get("wallet_type") not in fiat_types]
    fiat_wallets = [w for w in wallets if w.get("wallet_type") in fiat_types]
    
    print(f"   - Crypto wallets: {len(crypto_wallets)}")
    print(f"   - Fiat wallets: {len(fiat_wallets)}")
    
    if crypto_wallets:
        print("\n   Configured Crypto Wallets (xpubs):")
        print("   " + "-" * 50)
        for w in crypto_wallets:
            wtype = w.get('wallet_type', 'N/A')
            addr = w.get('address', 'N/A')
            if addr and len(addr) > 60:
                addr = addr[:60] + "..."
            print(f"   • {wtype}: {addr}")
else:
    print(f"❌ Failed to get wallets: {wallets_response.status_code}")

# Step 4: Check dashboard
print("\n4. Dashboard Overview...")
dashboard_response = requests.get(f"{BASE_URL}/dashboard", headers=headers)

if dashboard_response.status_code == 200:
    dashboard_data = dashboard_response.json()
    data = dashboard_data.get("data", {})
    print(f"✅ Dashboard data:")
    print(f"   - Active wallets: {data.get('active_wallets', 'N/A')}")
    print(f"   - Total transactions: {data.get('total_transactions', {}).get('count', 'N/A')}")
    print(f"   - Fee tier: {data.get('fee_tier', {}).get('current_tier', 'N/A')}")
else:
    print(f"❌ Failed to get dashboard: {dashboard_response.status_code}")

print("\n" + "=" * 60)
print("POOL SUMMARY")
print("=" * 60)
