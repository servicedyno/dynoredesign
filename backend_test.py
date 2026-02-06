#!/usr/bin/env python3
"""
DynoPay Backend Testing - Code Analysis Tests
Testing 3 fixes on DynoPay backend as requested in the review.
"""

import subprocess
import sys
import json
import re
from typing import Dict, List, Tuple

def read_file(file_path: str) -> str:
    """Read file content."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return ""

def test_duplicate_payment_pending_email_fix():
    """
    Test 1: Duplicate Payment Pending Email Fix
    File: /app/backend/webhooks/index.ts
    Bug: Both tatumWebHook and tatumCryptoWebHook called sendPendingPaymentNotification 
    Fix: Removed the call from tatumWebHook — only tatumCryptoWebHook sends it now
    """
    print("🔍 TEST 1: Duplicate Payment Pending Email Fix")
    print("=" * 60)
    
    file_path = "/app/backend/webhooks/index.ts"
    content = read_file(file_path)
    
    if not content:
        return False
    
    results = []
    
    # Step 1: Find tatumWebHook function (around line 359)
    tatum_webhook_match = re.search(r'const tatumWebHook.*?(?=const tatumCryptoWebHook)', content, re.DOTALL)
    if tatum_webhook_match:
        tatum_webhook_content = tatum_webhook_match.group(0)
        print("✅ Found tatumWebHook function")
        
        # Step 2: Verify it does NOT call sendPendingPaymentNotification
        if 'sendPendingPaymentNotification' in tatum_webhook_content:
            print("❌ FAIL: tatumWebHook still contains sendPendingPaymentNotification call")
            results.append(False)
        else:
            print("✅ PASS: tatumWebHook does NOT call sendPendingPaymentNotification")
            results.append(True)
        
        # Check for the expected comment
        if "NOTE: Pending notification is handled by tatumCryptoWebHook to avoid duplicates" in tatum_webhook_content:
            print("✅ PASS: Found expected comment about avoiding duplicates")
            results.append(True)
        else:
            print("❌ FAIL: Missing expected comment about avoiding duplicates")
            results.append(False)
    else:
        print("❌ FAIL: Could not find tatumWebHook function")
        results.append(False)
    
    # Step 3: Find tatumCryptoWebHook function (around line 411)
    crypto_webhook_match = re.search(r'const tatumCryptoWebHook.*?(?=export)', content, re.DOTALL)
    if crypto_webhook_match:
        crypto_webhook_content = crypto_webhook_match.group(0)
        print("✅ Found tatumCryptoWebHook function")
        
        # Step 4: Verify it STILL calls sendPendingPaymentNotification
        if 'sendPendingPaymentNotification' in crypto_webhook_content:
            print("✅ PASS: tatumCryptoWebHook still calls sendPendingPaymentNotification")
            results.append(True)
        else:
            print("❌ FAIL: tatumCryptoWebHook missing sendPendingPaymentNotification call")
            results.append(False)
    else:
        print("❌ FAIL: Could not find tatumCryptoWebHook function")
        results.append(False)
    
    # Step 5: Count total occurrences of sendPendingPaymentNotification
    total_occurrences = len(re.findall(r'sendPendingPaymentNotification', content))
    print(f"📊 Total occurrences of 'sendPendingPaymentNotification': {total_occurrences}")
    
    if total_occurrences == 2:  # 1 import + 1 call in tatumCryptoWebHook
        print("✅ PASS: Exactly 2 occurrences found (1 import + 1 call)")
        results.append(True)
    else:
        print(f"❌ FAIL: Expected 2 occurrences, found {total_occurrences}")
        results.append(False)
    
    success = all(results)
    print(f"🏁 Test 1 Result: {'✅ PASS' if success else '❌ FAIL'} ({sum(results)}/{len(results)} checks passed)")
    print()
    return success

def test_social_media_urls_updated():
    """
    Test 2: Social Media URLs Updated + Telegram Added
    Files: /app/backend/helper/sendEmail.ts AND /app/backend/services/emailService.ts
    """
    print("🔍 TEST 2: Social Media URLs Updated + Telegram Added")
    print("=" * 60)
    
    expected_urls = {
        'Facebook': 'https://www.facebook.com/dynopay',
        'Instagram': 'https://www.instagram.com/dynopay', 
        'X/Twitter': 'https://x.com/dynopaycom',
        'LinkedIn': 'https://www.linkedin.com/company/dynopay/',
        'Telegram': 'https://t.me/Dynopay_Announcements'
    }
    
    files_to_check = [
        "/app/backend/helper/sendEmail.ts",
        "/app/backend/services/emailService.ts"
    ]
    
    results = []
    
    for file_path in files_to_check:
        print(f"\n📁 Checking {file_path}")
        content = read_file(file_path)
        
        if not content:
            results.append(False)
            continue
        
        file_results = []
        
        for platform, expected_url in expected_urls.items():
            if expected_url in content:
                print(f"✅ PASS: {platform} URL found - {expected_url}")
                file_results.append(True)
            else:
                print(f"❌ FAIL: {platform} URL missing - {expected_url}")
                file_results.append(False)
        
        # Check for Telegram icon img tag
        telegram_icon_patterns = [
            r'<img[^>]*src="[^"]*flaticon[^"]*telegram[^"]*"',
            r'<img[^>]*src="[^"]*2111646[^"]*"',  # Specific Telegram icon ID from flaticon
            r'alt="Telegram"'
        ]
        
        telegram_icon_found = any(re.search(pattern, content, re.IGNORECASE) for pattern in telegram_icon_patterns)
        if telegram_icon_found:
            print("✅ PASS: Telegram icon found")
            file_results.append(True)
        else:
            print("❌ FAIL: Telegram icon not found")
            file_results.append(False)
        
        file_success = all(file_results)
        print(f"📊 File Result: {'✅ PASS' if file_success else '❌ FAIL'} ({sum(file_results)}/{len(file_results)} checks passed)")
        results.append(file_success)
    
    success = all(results)
    print(f"\n🏁 Test 2 Result: {'✅ PASS' if success else '❌ FAIL'} ({sum(results)}/{len(results)} files passed)")
    print()
    return success

def test_all_emails_use_branded_template():
    """
    Test 3: All Emails Use Branded Template
    Files: /app/backend/controller/walletController.ts, /app/backend/helper/sendEmail.ts
    """
    print("🔍 TEST 3: All Emails Use Branded Template")
    print("=" * 60)
    
    results = []
    
    # Step 1: Check walletController.ts updateOtp function
    print("📁 Checking /app/backend/controller/walletController.ts")
    wallet_controller_content = read_file("/app/backend/controller/walletController.ts")
    
    if wallet_controller_content:
        # Check for dynoPayEmailTemplate import
        if 'dynoPayEmailTemplate' in wallet_controller_content and 'emailService' in wallet_controller_content:
            print("✅ PASS: dynoPayEmailTemplate imported from emailService")
            results.append(True)
        else:
            print("❌ FAIL: dynoPayEmailTemplate import from emailService not found")
            results.append(False)
        
        # Find updateOtp function (around line 2748)
        update_otp_match = re.search(r'const updateOtp.*?(?=const|\Z)', wallet_controller_content, re.DOTALL)
        if update_otp_match:
            update_otp_content = update_otp_match.group(0)
            print("✅ Found updateOtp function")
            
            # Check if OTP email uses htmlBody (template-wrapped) NOT raw text
            if 'htmlBody' in update_otp_content and 'dynoPayEmailTemplate' in update_otp_content:
                print("✅ PASS: OTP email uses htmlBody (template-wrapped)")
                results.append(True)
            else:
                print("❌ FAIL: OTP email does not use htmlBody template")
                results.append(False)
        else:
            print("❌ FAIL: Could not find updateOtp function")
            results.append(False)
    else:
        results.append(False)
    
    # Step 2: Check helper/sendEmail.ts
    print("\n📁 Checking /app/backend/helper/sendEmail.ts")
    send_email_content = read_file("/app/backend/helper/sendEmail.ts")
    
    if send_email_content:
        # Find all mailTransporter calls and verify they use htmlBody
        mail_transporter_calls = re.findall(r'mailTransporter\s*\(\s*\{([^}]+)\}', send_email_content, re.DOTALL)
        
        print(f"📊 Found {len(mail_transporter_calls)} mailTransporter calls")
        
        all_use_html_body = True
        for i, call in enumerate(mail_transporter_calls):
            if 'body:' in call:
                if 'htmlBody' in call:
                    print(f"✅ Call {i+1}: Uses htmlBody")
                elif 'message' in call and 'htmlBody' not in call:
                    print(f"❌ Call {i+1}: Uses raw message instead of htmlBody")
                    all_use_html_body = False
                else:
                    print(f"✅ Call {i+1}: Uses proper body format")
        
        if all_use_html_body:
            print("✅ PASS: All mailTransporter calls use htmlBody")
            results.append(True)
        else:
            print("❌ FAIL: Some mailTransporter calls use raw message instead of htmlBody")
            results.append(False)
    else:
        results.append(False)
    
    # Step 3: Check services/emailService.ts for dynoPayEmailTemplate export
    print("\n📁 Checking /app/backend/services/emailService.ts")
    email_service_content = read_file("/app/backend/services/emailService.ts")
    
    if email_service_content:
        # Check if dynoPayEmailTemplate is exported at the bottom
        if re.search(r'export.*dynoPayEmailTemplate', email_service_content):
            print("✅ PASS: dynoPayEmailTemplate is exported from emailService.ts")
            results.append(True)
        else:
            print("❌ FAIL: dynoPayEmailTemplate is not exported from emailService.ts")
            results.append(False)
    else:
        results.append(False)
    
    success = all(results)
    print(f"\n🏁 Test 3 Result: {'✅ PASS' if success else '❌ FAIL'} ({sum(results)}/{len(results)} checks passed)")
    print()
    return success

def test_backend_health():
    """
    Test 4: Backend Health
    Verify backend is responding correctly
    """
    print("🔍 TEST 4: Backend Health")
    print("=" * 60)
    
    base_url = "https://init-chain.preview.emergentagent.com"
    
    # Try different possible health endpoints
    health_endpoints = [
        "/api/health",
        "/health", 
        "/api/status",
        "/status"
    ]
    
    for endpoint in health_endpoints:
        try:
            result = subprocess.run(
                ['curl', '-s', '-w', '%{http_code}', f"{base_url}{endpoint}"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Extract status code from the end of output
            output = result.stdout
            if output and len(output) >= 3:
                status_code = output[-3:]
                response_body = output[:-3] if len(output) > 3 else ""
                
                if status_code.startswith('2'):  # 2xx status codes
                    print(f"✅ PASS: {endpoint} returned status {status_code}")
                    if response_body and ('healthy' in response_body.lower() or 'ok' in response_body.lower()):
                        print("✅ PASS: Response indicates healthy status")
                    print(f"🏁 Test 4 Result: ✅ PASS")
                    print()
                    return True
                else:
                    print(f"❌ {endpoint} returned status {status_code}")
            
        except Exception as e:
            print(f"❌ Error testing {endpoint}: {e}")
    
    print("❌ FAIL: No healthy backend endpoint found")
    print(f"🏁 Test 4 Result: ❌ FAIL")
    print()
    return False

def main():
    """Run all tests and provide summary."""
    print("🚀 DYNOPAY BACKEND CODE ANALYSIS TESTS")
    print("=" * 80)
    print("Testing 3 fixes on DynoPay backend as requested")
    print("BASE URL: https://init-chain.preview.emergentagent.com")
    print("=" * 80)
    print()
    
    tests = [
        ("Duplicate Payment Pending Email Fix", test_duplicate_payment_pending_email_fix),
        ("Social Media URLs Updated + Telegram Added", test_social_media_urls_updated), 
        ("All Emails Use Branded Template", test_all_emails_use_branded_template),
        ("Backend Health", test_backend_health)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ ERROR in {test_name}: {e}")
            results.append((test_name, False))
    
    # Summary
    print("=" * 80)
    print("🏁 FINAL SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n📊 Overall Result: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! All 3 fixes are working correctly.")
    else:
        print("⚠️  Some tests failed. Review the detailed output above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)