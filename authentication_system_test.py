#!/usr/bin/env python3
"""
DynoPay Authentication System Testing Suite
Comprehensive testing of all authentication endpoints as requested in review
"""

import os
import sys
import json
import time
import requests
from typing import Dict, List, Any

class AuthenticationSystemTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.test_results = {}
        self.errors = []
        self.jwt_token = None
        self.test_user_data = {
            "name": "Auth Test User",
            "email": "auth.test@dynopay.com", 
            "password": "TestPassword123!",
            "mobile": "+1234567890"
        }
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
        # Fallback to localhost
        return "http://localhost:3300"
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result"""
        self.test_results[test_name] = {
            'success': success,
            'message': message,
            'details': details or {}
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if not success:
            self.errors.append(f"{test_name}: {message}")
    
    def test_user_registration(self):
        """Test POST /api/user/registerUser"""
        print("\n=== Testing User Registration ===")
        
        # Test 1: Valid registration
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/registerUser",
                json=self.test_user_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.jwt_token = data['data']['accessToken']
                    self.log_result(
                        "User Registration - Valid Data", 
                        True, 
                        "Successfully registered user with valid data",
                        {"email": self.test_user_data["email"], "has_token": bool(self.jwt_token)}
                    )
                else:
                    self.log_result(
                        "User Registration - Valid Data", 
                        False, 
                        "Registration succeeded but no token received",
                        {"response": data}
                    )
            elif response.status_code == 400:
                # User might already exist, try with different email
                alt_user_data = self.test_user_data.copy()
                alt_user_data["email"] = f"auth.test.{int(time.time())}@dynopay.com"
                
                alt_response = requests.post(
                    f"{self.backend_url}/api/user/registerUser",
                    json=alt_user_data,
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                if alt_response.status_code == 200:
                    alt_data = alt_response.json()
                    if 'data' in alt_data and 'accessToken' in alt_data['data']:
                        self.jwt_token = alt_data['data']['accessToken']
                        self.test_user_data = alt_user_data  # Update for future tests
                        self.log_result(
                            "User Registration - Valid Data", 
                            True, 
                            "Successfully registered user with alternative email",
                            {"email": alt_user_data["email"], "has_token": bool(self.jwt_token)}
                        )
                    else:
                        self.log_result(
                            "User Registration - Valid Data", 
                            False, 
                            "Registration succeeded but no token received",
                            {"response": alt_data}
                        )
                else:
                    self.log_result(
                        "User Registration - Valid Data", 
                        False, 
                        f"Registration failed with status {alt_response.status_code}",
                        {"response": alt_response.text}
                    )
            else:
                self.log_result(
                    "User Registration - Valid Data", 
                    False, 
                    f"Registration failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Registration - Valid Data", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: Missing fields validation
        try:
            invalid_data = {"email": "test@test.com"}  # Missing required fields
            response = requests.post(
                f"{self.backend_url}/api/user/registerUser",
                json=invalid_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400:
                self.log_result(
                    "User Registration - Missing Fields", 
                    True, 
                    "Correctly rejected registration with missing fields",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "User Registration - Missing Fields", 
                    False, 
                    f"Should return 400 for missing fields, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Registration - Missing Fields", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 3: Invalid email format
        try:
            invalid_email_data = self.test_user_data.copy()
            invalid_email_data["email"] = "invalid-email-format"
            
            response = requests.post(
                f"{self.backend_url}/api/user/registerUser",
                json=invalid_email_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400:
                self.log_result(
                    "User Registration - Invalid Email", 
                    True, 
                    "Correctly rejected registration with invalid email format",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "User Registration - Invalid Email", 
                    False, 
                    f"Should return 400 for invalid email, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Registration - Invalid Email", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_user_login(self):
        """Test POST /api/user/login"""
        print("\n=== Testing User Login ===")
        
        # Test 1: Valid credentials (use known test user from review)
        test_credentials = [
            {"email": "john@dyno.pt", "password": "Katiekendra123@"},
            {"email": "nomadly@moxx.co", "password": "password123"}  # Check backend .env for password
        ]
        
        login_successful = False
        
        for creds in test_credentials:
            try:
                response = requests.post(
                    f"{self.backend_url}/api/user/login",
                    json=creds,
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data and 'accessToken' in data['data']:
                        self.jwt_token = data['data']['accessToken']
                        login_successful = True
                        self.log_result(
                            "User Login - Valid Credentials", 
                            True, 
                            f"Successfully logged in with {creds['email']}",
                            {"email": creds['email'], "has_token": bool(self.jwt_token)}
                        )
                        break
                    else:
                        self.log_result(
                            f"User Login - {creds['email']}", 
                            False, 
                            "Login succeeded but no token received",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"User Login - {creds['email']}", 
                        False, 
                        f"Login failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"User Login - {creds['email']}", 
                    False, 
                    f"Request failed: {str(e)}"
                )
        
        if not login_successful:
            # Try with our registered test user
            try:
                response = requests.post(
                    f"{self.backend_url}/api/user/login",
                    json={
                        "email": self.test_user_data["email"],
                        "password": self.test_user_data["password"]
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'data' in data and 'accessToken' in data['data']:
                        self.jwt_token = data['data']['accessToken']
                        self.log_result(
                            "User Login - Test User", 
                            True, 
                            f"Successfully logged in with test user",
                            {"email": self.test_user_data["email"], "has_token": bool(self.jwt_token)}
                        )
                    else:
                        self.log_result(
                            "User Login - Test User", 
                            False, 
                            "Login succeeded but no token received",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        "User Login - Test User", 
                        False, 
                        f"Login failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
            except Exception as e:
                self.log_result(
                    "User Login - Test User", 
                    False, 
                    f"Request failed: {str(e)}"
                )
        
        # Test 2: Invalid password
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": "john@dyno.pt",
                    "password": "wrongpassword"
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 401 or response.status_code == 400:
                self.log_result(
                    "User Login - Invalid Password", 
                    True, 
                    "Correctly rejected login with invalid password",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "User Login - Invalid Password", 
                    False, 
                    f"Should return 401/400 for invalid password, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Login - Invalid Password", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 3: Non-existent email
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/login",
                json={
                    "email": "nonexistent@example.com",
                    "password": "anypassword"
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 401 or response.status_code == 400:
                self.log_result(
                    "User Login - Non-existent Email", 
                    True, 
                    "Correctly rejected login with non-existent email",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "User Login - Non-existent Email", 
                    False, 
                    f"Should return 401/400 for non-existent email, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "User Login - Non-existent Email", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_email_check(self):
        """Test GET /api/user/checkEmail"""
        print("\n=== Testing Email Check ===")
        
        # Test 1: Existing email
        try:
            response = requests.get(
                f"{self.backend_url}/api/user/checkEmail",
                params={"email": "john@dyno.pt"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Email Check - Existing Email", 
                    True, 
                    "Successfully checked existing email",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Email Check - Existing Email", 
                    False, 
                    f"Email check failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Email Check - Existing Email", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: Non-existing email
        try:
            response = requests.get(
                f"{self.backend_url}/api/user/checkEmail",
                params={"email": "nonexistent@example.com"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Email Check - Non-existing Email", 
                    True, 
                    "Successfully checked non-existing email",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Email Check - Non-existing Email", 
                    False, 
                    f"Email check failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Email Check - Non-existing Email", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_forgot_password(self):
        """Test POST /api/user/forgot-password"""
        print("\n=== Testing Forgot Password ===")
        
        # Test 1: Valid email
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/forgot-password",
                json={"email": "john@dyno.pt"},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Forgot Password - Valid Email", 
                    True, 
                    "Successfully processed forgot password request",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Forgot Password - Valid Email", 
                    False, 
                    f"Forgot password failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Forgot Password - Valid Email", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: Non-existent email (should still return success for security)
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/forgot-password",
                json={"email": "nonexistent@example.com"},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Forgot Password - Non-existent Email", 
                    True, 
                    "Correctly returned success for non-existent email (security feature)",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Forgot Password - Non-existent Email", 
                    False, 
                    f"Should return 200 for security, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Forgot Password - Non-existent Email", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_reset_password(self):
        """Test POST /api/user/reset-password"""
        print("\n=== Testing Reset Password ===")
        
        # Test with invalid/expired token
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/reset-password",
                json={
                    "token": "invalid_token_12345",
                    "email": "john@dyno.pt",
                    "newPassword": "newpass123"
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400 or response.status_code == 401:
                self.log_result(
                    "Reset Password - Invalid Token", 
                    True, 
                    "Correctly rejected reset with invalid token",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Reset Password - Invalid Token", 
                    False, 
                    f"Should return 400/401 for invalid token, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Reset Password - Invalid Token", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_google_signin(self):
        """Test POST /api/user/google-signin"""
        print("\n=== Testing Google Sign-In ===")
        
        # Test 1: Missing token
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/google-signin",
                json={},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400:
                self.log_result(
                    "Google Sign-In - Missing Token", 
                    True, 
                    "Correctly returned 400 for missing token",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Google Sign-In - Missing Token", 
                    False, 
                    f"Should return 400 for missing token, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Google Sign-In - Missing Token", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: Invalid ID token
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/google-signin",
                json={"idToken": "invalid_token_12345"},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 401 or response.status_code == 400:
                self.log_result(
                    "Google Sign-In - Invalid ID Token", 
                    True, 
                    "Correctly rejected invalid ID token",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Google Sign-In - Invalid ID Token", 
                    False, 
                    f"Should return 401/400 for invalid token, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Google Sign-In - Invalid ID Token", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 3: Invalid access token
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/google-signin",
                json={"accessToken": "invalid_access_token_12345"},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 401 or response.status_code == 400:
                self.log_result(
                    "Google Sign-In - Invalid Access Token", 
                    True, 
                    "Correctly rejected invalid access token",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "Google Sign-In - Invalid Access Token", 
                    False, 
                    f"Should return 401/400 for invalid token, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Google Sign-In - Invalid Access Token", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_social_connect(self):
        """Test POST /api/user/connectSocial"""
        print("\n=== Testing Social Connect ===")
        
        try:
            social_data = {
                "name": "Test Social User",
                "email": "social@test.com",
                "provider": "google",
                "photo": "https://example.com/photo.jpg"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/user/connectSocial",
                json=social_data,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Social Connect - Valid Data", 
                    True, 
                    "Successfully processed social connect request",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Social Connect - Valid Data", 
                    False, 
                    f"Social connect failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Social Connect - Valid Data", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_otp_flow(self):
        """Test OTP generation and confirmation"""
        print("\n=== Testing OTP Flow ===")
        
        # Test 1: Generate OTP
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/generateOTP",
                json={"email": "john@dyno.pt"},
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "OTP Generation - Valid Email", 
                    True, 
                    "Successfully generated OTP",
                    {"response": data}
                )
            else:
                self.log_result(
                    "OTP Generation - Valid Email", 
                    False, 
                    f"OTP generation failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "OTP Generation - Valid Email", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: Confirm OTP with invalid code
        try:
            response = requests.post(
                f"{self.backend_url}/api/user/confirmOTP",
                json={
                    "email": "john@dyno.pt",
                    "otp": "000000"
                },
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            
            if response.status_code == 400 or response.status_code == 401:
                self.log_result(
                    "OTP Confirmation - Invalid OTP", 
                    True, 
                    "Correctly rejected invalid OTP",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "OTP Confirmation - Invalid OTP", 
                    False, 
                    f"Should return 400/401 for invalid OTP, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "OTP Confirmation - Invalid OTP", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_profile_management(self):
        """Test profile management endpoints (requires auth)"""
        print("\n=== Testing Profile Management ===")
        
        if not self.jwt_token:
            self.log_result(
                "Profile Management", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        # Test 1: GET profile
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                f"{self.backend_url}/api/user/profile",
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Profile Management - GET Profile", 
                    True, 
                    "Successfully retrieved user profile",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Profile Management - GET Profile", 
                    False, 
                    f"Profile retrieval failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Profile Management - GET Profile", 
                False, 
                f"Request failed: {str(e)}"
            )
        
        # Test 2: PUT profile
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            update_data = {
                "name": "Updated Test User",
                "mobile": "+1987654321"
            }
            
            response = requests.put(
                f"{self.backend_url}/api/user/profile",
                json=update_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Profile Management - PUT Profile", 
                    True, 
                    "Successfully updated user profile",
                    {"response": data}
                )
            else:
                self.log_result(
                    "Profile Management - PUT Profile", 
                    False, 
                    f"Profile update failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Profile Management - PUT Profile", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def test_password_change(self):
        """Test PUT /api/user/changePassword (requires auth)"""
        print("\n=== Testing Password Change ===")
        
        if not self.jwt_token:
            self.log_result(
                "Password Change", 
                False, 
                "No JWT token available for authentication"
            )
            return
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            change_data = {
                "oldPassword": self.test_user_data["password"],
                "newPassword": "NewTestPassword123!"
            }
            
            response = requests.put(
                f"{self.backend_url}/api/user/changePassword",
                json=change_data,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Password Change - Valid Data", 
                    True, 
                    "Successfully changed password",
                    {"response": data}
                )
                # Update password for future tests
                self.test_user_data["password"] = change_data["newPassword"]
            else:
                self.log_result(
                    "Password Change - Valid Data", 
                    False, 
                    f"Password change failed with status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result(
                "Password Change - Valid Data", 
                False, 
                f"Request failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all authentication tests"""
        print("🚀 Starting DynoPay Authentication System Testing")
        print(f"Backend URL: {self.backend_url}")
        print("=" * 60)
        
        # Run all test methods
        self.test_user_registration()
        self.test_user_login()
        self.test_email_check()
        self.test_forgot_password()
        self.test_reset_password()
        self.test_google_signin()
        self.test_social_connect()
        self.test_otp_flow()
        self.test_profile_management()
        self.test_password_change()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🏁 AUTHENTICATION SYSTEM TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.errors:
            print(f"\n🔍 FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  • {error}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = AuthenticationSystemTester()
    tester.run_all_tests()