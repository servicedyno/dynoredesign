#!/usr/bin/env python3

import requests
import json
import sys

def test_welcome_email_move():
    """
    Test that the welcome email has been correctly moved from registration flow 
    to the email verification flow in DynoPay backend.
    """
    results = []
    
    # TEST 1: Backend healthy
    print("TEST 1: Backend Health Check")
    try:
        response = requests.get("http://localhost:8001/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                results.append(("TEST 1 - Backend Health", "✅ PASSED", f"Status: {data.get('status')}"))
                print(f"✅ PASSED - Status: {data.get('status')}")
            else:
                results.append(("TEST 1 - Backend Health", "❌ FAILED", f"Status: {data.get('status')}"))
                print(f"❌ FAILED - Status: {data.get('status')}")
        else:
            results.append(("TEST 1 - Backend Health", "❌ FAILED", f"HTTP {response.status_code}"))
            print(f"❌ FAILED - HTTP {response.status_code}")
    except Exception as e:
        results.append(("TEST 1 - Backend Health", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # TEST 2: TypeScript compiles cleanly  
    print("\nTEST 2: TypeScript Compilation")
    import subprocess
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--skipLibCheck"], 
            cwd="/app/backend", 
            capture_output=True, 
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            results.append(("TEST 2 - TypeScript Compilation", "✅ PASSED", "Clean compilation"))
            print("✅ PASSED - Clean compilation")
        else:
            results.append(("TEST 2 - TypeScript Compilation", "❌ FAILED", f"Exit code: {result.returncode}"))
            print(f"❌ FAILED - Exit code: {result.returncode}")
            if result.stderr:
                print(f"Errors: {result.stderr}")
    except Exception as e:
        results.append(("TEST 2 - TypeScript Compilation", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # TEST 3: registerUser no longer sends welcome email
    print("\nTEST 3: registerUser function no longer sends welcome email")
    try:
        # Check registerUser function (lines 36-163) for sendWelcomeEmail
        result = subprocess.run(
            ["awk", "NR >= 36 && NR <= 163 {print NR \": \" $0}", "/app/backend/controller/userController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            register_lines = result.stdout
            if "sendWelcomeEmail" in register_lines:
                results.append(("TEST 3 - registerUser no sendWelcomeEmail", "❌ FAILED", "Found sendWelcomeEmail in registerUser"))
                print("❌ FAILED - Found sendWelcomeEmail in registerUser function")
            else:
                # Check for deferred comment
                if "Welcome email is deferred until after OTP verification" in register_lines:
                    results.append(("TEST 3 - registerUser no sendWelcomeEmail", "✅ PASSED", "No sendWelcomeEmail found, deferred comment present"))
                    print("✅ PASSED - No sendWelcomeEmail found, deferred comment present")
                else:
                    results.append(("TEST 3 - registerUser no sendWelcomeEmail", "⚠️ WARNING", "No sendWelcomeEmail but missing deferred comment"))
                    print("⚠️ WARNING - No sendWelcomeEmail but missing deferred comment")
        else:
            results.append(("TEST 3 - registerUser no sendWelcomeEmail", "❌ FAILED", "Could not check registerUser function"))
            print("❌ FAILED - Could not check registerUser function")
    except Exception as e:
        results.append(("TEST 3 - registerUser no sendWelcomeEmail", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # TEST 4: verifyEmail now sends welcome email after OTP verification
    print("\nTEST 4: verifyEmail function sends welcome email after OTP verification")
    try:
        # Check verifyEmail function (lines ~2232-2280) for sendWelcomeEmail
        result = subprocess.run(
            ["awk", "NR >= 2232 && NR <= 2280 {print NR \": \" $0}", "/app/backend/controller/userController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            verify_lines = result.stdout
            if "sendWelcomeEmail" in verify_lines and "OTP matches — mark email as verified" in verify_lines:
                results.append(("TEST 4 - verifyEmail sends welcome email", "✅ PASSED", "sendWelcomeEmail found after OTP verification"))
                print("✅ PASSED - sendWelcomeEmail found after OTP verification")
            elif "sendWelcomeEmail" in verify_lines:
                results.append(("TEST 4 - verifyEmail sends welcome email", "⚠️ WARNING", "sendWelcomeEmail found but unclear if after OTP verification"))
                print("⚠️ WARNING - sendWelcomeEmail found but unclear if after OTP verification")
            else:
                results.append(("TEST 4 - verifyEmail sends welcome email", "❌ FAILED", "No sendWelcomeEmail found in verifyEmail"))
                print("❌ FAILED - No sendWelcomeEmail found in verifyEmail function")
        else:
            results.append(("TEST 4 - verifyEmail sends welcome email", "❌ FAILED", "Could not check verifyEmail function"))
            print("❌ FAILED - Could not check verifyEmail function")
    except Exception as e:
        results.append(("TEST 4 - verifyEmail sends welcome email", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # TEST 5: Registration still sends verification OTP email
    print("\nTEST 5: Registration still sends verification OTP email")
    try:
        result = subprocess.run(
            ["awk", "NR >= 36 && NR <= 163 {print NR \": \" $0}", "/app/backend/controller/userController.ts"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            register_lines = result.stdout
            if "sendEmailVerificationOTPEmail" in register_lines:
                results.append(("TEST 5 - Registration sends OTP email", "✅ PASSED", "sendEmailVerificationOTPEmail found in registerUser"))
                print("✅ PASSED - sendEmailVerificationOTPEmail found in registerUser")
            else:
                results.append(("TEST 5 - Registration sends OTP email", "❌ FAILED", "No sendEmailVerificationOTPEmail found"))
                print("❌ FAILED - No sendEmailVerificationOTP Email found in registerUser")
        else:
            results.append(("TEST 5 - Registration sends OTP email", "❌ FAILED", "Could not check registerUser function"))
            print("❌ FAILED - Could not check registerUser function")
    except Exception as e:
        results.append(("TEST 5 - Registration sends OTP email", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # TEST 6: Verify email endpoint is protected
    print("\nTEST 6: Verify email endpoint is protected")
    try:
        response = requests.post(
            "http://localhost:8001/api/user/verify-email",
            headers={"Content-Type": "application/json"},
            json={"otp": "123456"},
            timeout=10
        )
        # Should return 401 (auth required) or 403 (CSRF/auth error) - both indicate protection
        if response.status_code in [401, 403]:
            results.append(("TEST 6 - Verify endpoint protected", "✅ PASSED", f"HTTP {response.status_code} - Authentication/authorization required"))
            print(f"✅ PASSED - HTTP {response.status_code} - Authentication/authorization required")
        else:
            results.append(("TEST 6 - Verify endpoint protected", "❌ FAILED", f"HTTP {response.status_code} - Should require auth"))
            print(f"❌ FAILED - HTTP {response.status_code} - Should require authentication")
    except Exception as e:
        results.append(("TEST 6 - Verify endpoint protected", "❌ FAILED", str(e)))
        print(f"❌ FAILED - {str(e)}")
    
    # Summary
    print("\n" + "="*80)
    print("WELCOME EMAIL MOVE TESTING SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, status, _ in results if status == "✅ PASSED")
    failed = sum(1 for _, status, _ in results if status == "❌ FAILED")
    warnings = sum(1 for _, status, _ in results if status == "⚠️ WARNING")
    total = len(results)
    
    for test_name, status, details in results:
        print(f"{status} {test_name}: {details}")
    
    print(f"\nOVERALL RESULTS: {passed}/{total} tests passed")
    if warnings > 0:
        print(f"⚠️ {warnings} warnings")
    
    success_rate = (passed / total) * 100 if total > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL WELCOME EMAIL MOVE TESTS PASSED!")
        return True
    else:
        print(f"\n⚠️ {failed} TEST(S) FAILED - Review implementation")
        return False

if __name__ == "__main__":
    success = test_welcome_email_move()
    sys.exit(0 if success else 1)