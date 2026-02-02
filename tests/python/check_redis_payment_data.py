#!/usr/bin/env python3
"""
Check Redis data for the ETH address to understand the current payment state
"""

import redis
import json
import os

def check_redis_data():
    """Check Redis data for the ETH address"""
    
    # Get Redis URL from backend .env
    redis_url = None
    try:
        with open('/app/backend/.env', 'r') as f:
            for line in f:
                if line.startswith('REDIS_PUBLIC_URL='):
                    redis_url = line.split('=', 1)[1].strip()
                    break
    except:
        pass
    
    if not redis_url:
        print("❌ No Redis URL found in backend .env")
        return
    
    try:
        # Connect to Redis
        r = redis.from_url(redis_url)
        
        # Check the specific address
        eth_address = "0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51"
        redis_key = f"crypto-{eth_address}"
        
        print(f"🔍 Checking Redis key: {redis_key}")
        
        # Get the data
        data = r.get(redis_key)
        
        if data:
            try:
                parsed_data = json.loads(data)
                print("✅ Redis data found:")
                print(json.dumps(parsed_data, indent=2))
                
                # Check if there's a ref key to get customer data
                if 'ref' in parsed_data:
                    ref_key = parsed_data['ref']
                    print(f"\n🔍 Checking customer ref: {ref_key}")
                    customer_data = r.get(ref_key)
                    if customer_data:
                        try:
                            customer_parsed = json.loads(customer_data)
                            print("✅ Customer data found:")
                            print(json.dumps(customer_parsed, indent=2))
                        except:
                            print(f"Customer data (raw): {customer_data}")
                    else:
                        print("❌ No customer data found")
                
            except json.JSONDecodeError:
                print(f"Redis data (raw): {data}")
        else:
            print("❌ No Redis data found for this address")
            
            # Check if there are any crypto-* keys
            print("\n🔍 Checking for any crypto-* keys...")
            crypto_keys = r.keys("crypto-*")
            if crypto_keys:
                print(f"Found {len(crypto_keys)} crypto keys:")
                for key in crypto_keys[:5]:  # Show first 5
                    key_str = key.decode() if isinstance(key, bytes) else key
                    print(f"  - {key_str}")
                    
                    # Check if any contain our address
                    if eth_address.lower() in key_str.lower():
                        print(f"    ⭐ This key contains our address!")
                        key_data = r.get(key)
                        if key_data:
                            try:
                                key_parsed = json.loads(key_data)
                                print(f"    Data: {json.dumps(key_parsed, indent=6)}")
                            except:
                                print(f"    Raw data: {key_data}")
            else:
                print("❌ No crypto-* keys found in Redis")
        
    except Exception as e:
        print(f"❌ Redis connection failed: {str(e)}")

if __name__ == "__main__":
    check_redis_data()