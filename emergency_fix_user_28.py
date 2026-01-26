#!/usr/bin/env python3
"""
Emergency fix: Clear ETH address from BTC wallet for user 28
The address should only be in ETH wallet, not BTC wallet
"""

import requests

BASE_URL = "https://repo-env-config.preview.emergentagent.com/api"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwibmFtZSI6IkpvaG5ueSBMVEQiLCJlbWFpbCI6ImpvaG5AZHluby5wdCIsInVzZXJuYW1lIjpudWxsLCJtb2JpbGUiOm51bGwsInBob3RvIjoiaHR0cHM6Ly9mNTAwNmZjNC01Y2FkLTQ4MGUtODU1Mi05MGZkMTcxZjg3NjAucHJldmlldy5lbWVyZ2VudGFnZW50LmNvbWltYWdlcy91c2VyXzNvN3MzeWZ1eW9mLnBuZyIsImxvZ2luX3R5cGUiOiJFTUFJTCIsImN1c3RvbWVyX2lkIjpudWxsLCJleHRlcm5hbF9pZCI6bnVsbCwic3RhdHVzIjoiYWN0aXZlIiwiY3JlYXRlZEF0IjoiMjAyNi0wMS0yNVQxODoxNzo0Ny4wMDhaIiwidXBkYXRlZEF0IjoiMjAyNi0wMS0yNVQxODoxNzo0Ny4wMDhaIiwidmVyaWZpZWRfb3RwIjpudWxsLCJvdHBfZXhwaXJlZCI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6ZmFsc2UsInJlZmVycmFsX2NvZGUiOm51bGwsInJlZmVycmVkX2J5X2NvZGUiOm51bGwsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJhbF9jb3VudCI6MCwiaWF0IjoxNzY5MzY1MDY5LCJleHAiOjE3Njk5Njk4Njl9.aMaUpTJdqZXZ3iQ_hUMXHUlw-DcrQE5dv4viX7fiuw0"

print("="*70)
print("EMERGENCY FIX: Clear incorrect ETH address from BTC wallet")
print("="*70)

print("\nCurrent Issue:")
print("  BTC wallet: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (WRONG - ETH address)")
print("  ETH wallet: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (CORRECT)")
print("  → Same address in both wallets due to bug")

print("\nNeed to manually clear BTC wallet via database...")
print("\n⚠️  This requires direct database access.")
print("\nSQL command needed:")
print("-" * 70)
print("""
UPDATE tbl_user_wallet
SET wallet_address = NULL,
    company_id = NULL,  
    wallet_name = NULL
WHERE user_id = 28
  AND wallet_type = 'BTC'
  AND company_id = 38;
""")
print("-" * 70)

print("\n✅ After this SQL runs:")
print("  BTC wallet: NULL (correct)")
print("  ETH wallet: 0x9a7221... (correct)")

print("\n" + "="*70)
