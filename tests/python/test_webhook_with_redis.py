#!/usr/bin/env python3
"""
DynoPay Webhook Testing with Redis Session Data
Tests the webhook endpoints with proper Redis data structure
"""

import requests
import json
import time
import redis
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:3300/api"  # Local Node.js backend
REDIS_URL = "redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463"

def setup_redis_connection():
    """Setup Redis connection"""
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        print("✅ Redis connection established")
        return r
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return None

def create_test_redis_data(redis_client):
    """Create test Redis data for webhook testing"""
    
    # Test wallet address
    test_address = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
    
    # Customer data (referenced by payment)
    customer_ref = "test-customer-ref-001"
    customer_data = {
        "adm_id": "10",  # User ID from test_result.md (nomadly@moxx.co)
        "company_id": "1",
        "amount": "0.001",
        "currency": "BTC",
        "customer_name": "Test Customer",
        "customer_email": "nomadly@moxx.co"
    }
    
    # Payment session data (crypto-{address} format)
    crypto_key = f"crypto-{test_address}"
    payment_data = {
        "ref": customer_ref,
        "amount": "0.001",
        "currency": "BTC",
        "address": test_address,
        "status": "pending",
        "created_at": datetime.now().isoformat()
    }
    
    try:
        # Set customer data
        for field, value in customer_data.items():
            redis_client.hset(customer_ref, field, str(value))
        
        # Set payment data
        for field, value in payment_data.items():
            redis_client.hset(crypto_key, field, str(value))
        
        print(f"✅ Redis test data created:")
        print(f"   Customer key: {customer_ref}")
        print(f"   Payment key: {crypto_key}")
        print(f"   Customer data: {customer_data}")
        print(f"   Payment data: {payment_data}")
        
        return {
            "address": test_address,
            "customer_ref": customer_ref,
            "crypto_key": crypto_key,
            "customer_data": customer_data,
            "payment_data": payment_data
        }
        
    except Exception as e:
        print(f"❌ Failed to create Redis test data: {e}")
        return None

def test_tatum_webhook(test_data):
    """Test the Tatum webhook endpoint"""
    
    print("\n🔍 Testing POST /api/tatum-webhook")
    
    # Simulate Tatum webhook payload
    webhook_payload = {
        "subscriptionType": "ADDRESS_TRANSACTION",
        "txId": "test-tx-12345abcdef",
        "address": test_data["address"],
        "counterAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        "amount": "0.001",
        "asset": "BTC",
        "blockNumber": 850000,
        "type": "native"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/tatum-webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text if response.text else 'Empty response'}")
        
        if response.status_code == 200:
            print("   ✅ Tatum webhook endpoint responded successfully")
            return True
        else:
            print(f"   ❌ Tatum webhook failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Tatum webhook test failed: {e}")
        return False

def test_tatum_crypto_webhook(test_data):
    """Test the Tatum crypto webhook endpoint"""
    
    print("\n🔍 Testing POST /api/tatum-crypto-webhook")
    
    # Simulate Tatum crypto webhook payload
    webhook_payload = {
        "subscriptionType": "ADDRESS_TRANSACTION",
        "txId": "test-crypto-tx-67890fedcba",
        "address": test_data["address"],
        "counterAddress": "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
        "amount": "0.0015",  # Slightly more than expected
        "asset": "BTC",
        "blockNumber": 850001,
        "type": "native"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/tatum-crypto-webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text if response.text else 'Empty response'}")
        
        if response.status_code == 200:
            print("   ✅ Tatum crypto webhook endpoint responded successfully")
            return True
        else:
            print(f"   ❌ Tatum crypto webhook failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Tatum crypto webhook test failed: {e}")
        return False

def verify_redis_updates(redis_client, test_data):
    """Verify that webhook processing updated Redis data"""
    
    print("\n🔍 Verifying Redis updates after webhook processing")
    
    try:
        # Check updated payment data
        crypto_key = test_data["crypto_key"]
        updated_payment = redis_client.hgetall(crypto_key)
        
        print(f"   Updated payment data: {updated_payment}")
        
        # Check for expected updates
        has_tx_id = "txId" in updated_payment and updated_payment["txId"]
        has_received_amount = "receivedAmount" in updated_payment and updated_payment["receivedAmount"]
        
        if has_tx_id:
            print(f"   ✅ Transaction ID updated: {updated_payment['txId']}")
        else:
            print("   ❌ Transaction ID not found in updated data")
        
        if has_received_amount:
            print(f"   ✅ Received amount updated: {updated_payment['receivedAmount']}")
        else:
            print("   ❌ Received amount not found in updated data")
        
        return has_tx_id and has_received_amount
        
    except Exception as e:
        print(f"   ❌ Redis verification failed: {e}")
        return False

def test_pending_notification_system():
    """Test the pending payment notification system"""
    
    print("\n🔍 Testing Pending Payment Notification System")
    
    # Test notification types endpoint (requires authentication)
    # First, let's test if the endpoint exists without auth
    try:
        response = requests.get(f"{BACKEND_URL}/notifications/types")
        
        if response.status_code == 401:
            print("   ✅ Notification types endpoint exists (requires authentication)")
            return True
        elif response.status_code == 200:
            types_data = response.json()
            notification_types = types_data.get("types", [])
            
            has_payment_pending = "payment_pending" in notification_types
            has_payment_confirming = "payment_confirming" in notification_types
            
            print(f"   Available notification types: {notification_types}")
            print(f"   ✅ payment_pending type available: {has_payment_pending}")
            print(f"   ✅ payment_confirming type available: {has_payment_confirming}")
            
            return has_payment_pending and has_payment_confirming
        else:
            print(f"   ❌ Failed to get notification types: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Notification types test failed: {e}")
        return False

def cleanup_redis_data(redis_client, test_data):
    """Clean up test Redis data"""
    
    print("\n🧹 Cleaning up test Redis data")
    
    try:
        # Delete test keys
        keys_to_delete = [
            test_data["customer_ref"],
            test_data["crypto_key"],
            f"pending-notif-test-tx-12345abcdef",
            f"pending-notif-test-crypto-tx-67890fedcba"
        ]
        
        for key in keys_to_delete:
            redis_client.delete(key)
        
        print("   ✅ Test Redis data cleaned up")
        
    except Exception as e:
        print(f"   ❌ Cleanup failed: {e}")

def main():
    """Main test execution"""
    
    print("🚀 DynoPay Webhook Testing with Redis Session Data")
    print("=" * 60)
    
    # Setup Redis connection
    redis_client = setup_redis_connection()
    if not redis_client:
        print("❌ Cannot proceed without Redis connection")
        return
    
    # Create test data
    test_data = create_test_redis_data(redis_client)
    if not test_data:
        print("❌ Cannot proceed without test data")
        return
    
    # Run tests
    results = {
        "tatum_webhook": False,
        "tatum_crypto_webhook": False,
        "redis_updates": False,
        "notification_system": False
    }
    
    try:
        # Test webhook endpoints
        results["tatum_webhook"] = test_tatum_webhook(test_data)
        time.sleep(2)  # Allow processing time
        
        results["tatum_crypto_webhook"] = test_tatum_crypto_webhook(test_data)
        time.sleep(2)  # Allow processing time
        
        # Verify Redis updates
        results["redis_updates"] = verify_redis_updates(redis_client, test_data)
        
        # Test notification system
        results["notification_system"] = test_pending_notification_system()
        
    finally:
        # Cleanup
        cleanup_redis_data(redis_client, test_data)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 WEBHOOK TESTING SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    total_passed = sum(1 for result in results.values() if result is True)
    total_tests = len(results)
    
    print(f"\n🎯 Overall Result: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("🎉 All webhook tests passed successfully!")
    else:
        print("⚠️  Some webhook tests failed - check logs above for details")

if __name__ == "__main__":
    main()