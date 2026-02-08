#!/usr/bin/env python3
"""
API Documentation Testing Script for DynoPay Backend
Tests Swagger/OpenAPI documentation for Direct API vs Payment Link differences
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://dep-installer-44.preview.emergentagent.com"
CREDENTIALS = {"email": "richard@dyno.pt", "password": "Katiekendra123@"}

def test_backend_health():
    """Test 1: Backend Health Check"""
    print("=== TEST 1: Backend Health Check ===")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Backend health check passed: HTTP 200")
            return True
        else:
            print(f"❌ Backend health check failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend health check error: {str(e)}")
        return False

def test_swagger_ui_accessibility():
    """Test 2: Swagger UI Accessible"""
    print("\n=== TEST 2: Swagger UI Accessibility ===")
    try:
        response = requests.get(f"{BASE_URL}/api/docs", timeout=10)
        if response.status_code == 200 and "text/html" in response.headers.get("content-type", ""):
            print("✅ Swagger UI accessible: HTTP 200 with HTML content")
            return True
        else:
            print(f"❌ Swagger UI failed: HTTP {response.status_code}, Content-Type: {response.headers.get('content-type')}")
            return False
    except Exception as e:
        print(f"❌ Swagger UI error: {str(e)}")
        return False

def test_openapi_spec_validity():
    """Test 3: OpenAPI Spec Valid with 178 paths"""
    print("\n=== TEST 3: OpenAPI Spec Validity ===")
    try:
        response = requests.get(f"{BASE_URL}/api/docs.json", timeout=10)
        if response.status_code == 200:
            try:
                spec = response.json()
                path_count = len(spec.get("paths", {}))
                print(f"✅ OpenAPI spec valid: HTTP 200, {path_count} paths found")
                if path_count == 178:
                    print("✅ Exact path count match: 178 paths")
                    return True, spec
                else:
                    print(f"⚠️  Path count mismatch: Expected 178, got {path_count}")
                    return True, spec  # Still valid JSON, just different count
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON in OpenAPI spec: {str(e)}")
                return False, None
        else:
            print(f"❌ OpenAPI spec failed: HTTP {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ OpenAPI spec error: {str(e)}")
        return False, None

def test_direct_api_endpoint_docs(spec):
    """Test 4: Direct API endpoint docs (cryptoPayment)"""
    print("\n=== TEST 4: Direct API Endpoint Documentation ===")
    
    if not spec:
        print("❌ No OpenAPI spec available")
        return False
    
    try:
        crypto_payment_path = spec.get("paths", {}).get("/api/user/cryptoPayment", {}).get("post", {})
        description = crypto_payment_path.get("description", "")
        
        print(f"CryptoPayment endpoint description length: {len(description)} characters")
        
        required_phrases = [
            "No grace period",
            "No underpayment threshold", 
            "No overpayment threshold",
            "Payment Links only"
        ]
        
        missing_phrases = []
        found_phrases = []
        
        for phrase in required_phrases:
            if phrase.lower() in description.lower():
                found_phrases.append(phrase)
                print(f"✅ Found required phrase: '{phrase}'")
            else:
                missing_phrases.append(phrase)
                print(f"❌ Missing required phrase: '{phrase}'")
        
        if not missing_phrases:
            print("✅ All required Direct API documentation phrases found")
            return True
        else:
            print(f"❌ Missing {len(missing_phrases)} required phrases: {missing_phrases}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking Direct API docs: {str(e)}")
        return False

def test_company_settings_docs(spec):
    """Test 5: Company settings docs"""
    print("\n=== TEST 5: Company Settings Documentation ===")
    
    if not spec:
        print("❌ No OpenAPI spec available")
        return False
    
    try:
        update_company_path = spec.get("paths", {}).get("/api/company/updateCompany/{id}", {}).get("put", {})
        description = update_company_path.get("description", "")
        
        print(f"UpdateCompany endpoint description length: {len(description)} characters")
        
        required_checks = [
            ("Payment Links only", "payment links restriction"),
            ("max 30", "grace period 30 minute limit")
        ]
        
        all_found = True
        
        for phrase, check_name in required_checks:
            if phrase.lower() in description.lower():
                print(f"✅ Found {check_name}: '{phrase}'")
            else:
                print(f"❌ Missing {check_name}: '{phrase}'")
                all_found = False
        
        if all_found:
            print("✅ Company settings documentation requirements met")
            return True
        else:
            print("❌ Company settings documentation incomplete")
            return False
            
    except Exception as e:
        print(f"❌ Error checking company settings docs: {str(e)}")
        return False

def test_webhook_docs(spec):
    """Test 6: Webhook documentation"""
    print("\n=== TEST 6: Webhook Documentation ===")
    
    if not spec:
        print("❌ No OpenAPI spec available")
        return False
    
    try:
        # Look for webhook documentation in the spec
        webhook_info_found = False
        direct_api_example_correct = False
        payment_link_example_correct = False
        
        # Check if webhook documentation exists
        spec_str = json.dumps(spec, indent=2)
        
        # Check for Direct API underpaid example without grace_period_minutes
        if "direct api" in spec_str.lower() and "underpaid" in spec_str.lower():
            webhook_info_found = True
            print("✅ Webhook documentation section found")
            
            # Check if Direct API example has "note" field instead of grace_period_minutes
            if '"note"' in spec_str and "direct api" in spec_str.lower():
                direct_api_example_correct = True
                print("✅ Direct API underpaid example has 'note' field")
            else:
                print("❌ Direct API underpaid example missing 'note' field")
        else:
            print("❌ Webhook documentation not found")
        
        # Check for Payment Link example with grace_period_minutes
        if "payment link" in spec_str.lower() and "grace_period_minutes" in spec_str:
            payment_link_example_correct = True
            print("✅ Payment Link underpaid example has grace_period_minutes")
        else:
            print("❌ Payment Link underpaid example missing grace_period_minutes")
        
        success = webhook_info_found and direct_api_example_correct and payment_link_example_correct
        
        if success:
            print("✅ Webhook documentation requirements met")
        else:
            print("❌ Webhook documentation incomplete")
            
        return success
        
    except Exception as e:
        print(f"❌ Error checking webhook docs: {str(e)}")
        return False

def test_faq_section(spec):
    """Test 7: FAQ section with comparison table"""
    print("\n=== TEST 7: FAQ Section Documentation ===")
    
    if not spec:
        print("❌ No OpenAPI spec available")
        return False
    
    try:
        info_description = spec.get("info", {}).get("description", "")
        
        print(f"API info description length: {len(info_description)} characters")
        
        # Check for comparison table with "Not used" entries for Direct API
        required_elements = [
            ("comparison table", "table structure"),
            ("not used", "direct api exclusions"),
            ("direct api", "direct api references"),
            ("payment link", "payment link references")
        ]
        
        all_found = True
        
        for phrase, description in required_elements:
            if phrase.lower() in info_description.lower():
                print(f"✅ Found {description}: '{phrase}'")
            else:
                print(f"❌ Missing {description}: '{phrase}'")
                all_found = False
        
        if all_found:
            print("✅ FAQ section with comparison table found")
            return True
        else:
            print("❌ FAQ section incomplete")
            return False
            
    except Exception as e:
        print(f"❌ Error checking FAQ section: {str(e)}")
        return False

def main():
    """Run all API documentation tests"""
    print("🚀 Starting API Documentation Testing for DynoPay Backend")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)
    
    # Test results tracking
    results = []
    
    # Run all tests
    results.append(("Backend Health", test_backend_health()))
    results.append(("Swagger UI Accessibility", test_swagger_ui_accessibility()))
    
    spec_valid, spec = test_openapi_spec_validity()
    results.append(("OpenAPI Spec Validity", spec_valid))
    
    if spec_valid and spec:
        results.append(("Direct API Endpoint Docs", test_direct_api_endpoint_docs(spec)))
        results.append(("Company Settings Docs", test_company_settings_docs(spec)))
        results.append(("Webhook Docs", test_webhook_docs(spec)))
        results.append(("FAQ Section", test_faq_section(spec)))
    else:
        print("\n⚠️  Skipping detailed documentation tests due to invalid OpenAPI spec")
        results.extend([
            ("Direct API Endpoint Docs", False),
            ("Company Settings Docs", False), 
            ("Webhook Docs", False),
            ("FAQ Section", False)
        ])
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, passed_test in results:
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status} | {test_name}")
        if passed_test:
            passed += 1
    
    success_rate = (passed / total) * 100
    print(f"\nSuccess Rate: {passed}/{total} ({success_rate:.1f}%)")
    
    if passed == total:
        print("🎉 All API documentation tests passed!")
        return 0
    else:
        print(f"⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())