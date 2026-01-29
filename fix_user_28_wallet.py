#!/usr/bin/env python3
"""
Fix wallet data for user 28 (john@dyno.pt)
- Move ETH address from BTC wallet to ETH wallet
- Clear BTC wallet address
"""

import requests

BASE_URL = "https://env-checker-1.preview.emergentagent.com/api"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwibmFtZSI6IkpvaG5ueSBMVEQiLCJlbWFpbCI6ImpvaG5AZHluby5wdCIsInVzZXJuYW1lIjpudWxsLCJtb2JpbGUiOm51bGwsInBob3RvIjoiaHR0cHM6Ly9mNTAwNmZjNC01Y2FkLTQ4MGUtODU1Mi05MGZkMTcxZjg3NjAucHJldmlldy5lbWVyZ2VudGFnZW50LmNvbWltYWdlcy91c2VyXzNvN3MzeWZ1eW9mLnBuZyIsImxvZ2luX3R5cGUiOiJFTUFJTCIsImN1c3RvbWVyX2lkIjpudWxsLCJleHRlcm5hbF9pZCI6bnVsbCwic3RhdHVzIjoiYWN0aXZlIiwiY3JlYXRlZEF0IjoiMjAyNi0wMS0yNVQxODoxNzo0Ny4wMDhaIiwidXBkYXRlZEF0IjoiMjAyNi0wMS0yNVQxODoxNzo0Ny4wMDhaIiwidmVyaWZpZWRfb3RwIjpudWxsLCJvdHBfZXhwaXJlZCI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6ZmFsc2UsInJlZmVycmFsX2NvZGUiOm51bGwsInJlZmVycmVkX2J5X2NvZGUiOm51bGwsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJhbF9jb3VudCI6MCwiaWF0IjoxNzY5MzY1MDY5LCJleHAiOjE3Njk5Njk4Njl9.aMaUpTJdqZXZ3iQ_hUMXHUlw-DcrQE5dv4viX7fiuw0"

ETH_ADDRESS = "0x9a7221b5e32d5f99e8da95585835442e29afb38f"
COMPANY_ID = 38

print("="*60)
print("WALLET DATA FIX FOR USER 28")
print("="*60)

print("\n1. Current State:")
print("   BTC wallet has: 0x9a7221... (ETH address - WRONG)")
print("   ETH wallet has: null (WRONG)")

print("\n2. Steps to fix:")
print("   • Clear BTC wallet address")
print("   • Add ETH address to ETH wallet with proper validation")

# Step 1: Delete BTC wallet address
print("\n3. Clearing BTC wallet address...")
headers = {"Authorization": f"Bearer {TOKEN}"}
response = requests.post(
    f"{BASE_URL}/wallet/deleteWalletAddress",
    headers=headers,
    json={"currency": "BTC"}
)

if response.status_code == 200:
    print("   ✅ BTC wallet address cleared")
else:
    print(f"   ❌ Failed to clear BTC: {response.status_code}")
    print(f"   Response: {response.text}")

# Step 2: Validate ETH address
print("\n4. Validating ETH address...")
response = requests.post(
    f"{BASE_URL}/wallet/validateWalletAddress",
    headers=headers,
    json={
        "wallet_address": ETH_ADDRESS,
        "currency": "ETH",
        "company_id": COMPANY_ID,
        "wallet_name": "ETH Main Wallet"
    }
)

if response.status_code == 200:
    print("   ✅ ETH address validated - OTP sent to john@dyno.pt")
    print("   📧 Check email for OTP code")
    print("\n5. Next Step:")
    print("   • Go to frontend")
    print("   • Enter the OTP from email")
    print("   • Verify to complete ETH wallet setup")
else:
    print(f"   ❌ Failed to validate ETH: {response.status_code}")
    data = response.json()
    print(f"   Response: {data.get('message', response.text)}")

print("\n" + "="*60)
