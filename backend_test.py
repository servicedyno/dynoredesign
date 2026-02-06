#!/usr/bin/env python3
"""
DynoPay Email Templates Overhaul - CODE ANALYSIS TESTING
Testing Agent for Backend Email Templates Review
Generated: 2026-02-06

This is a CODE ANALYSIS test (not live email testing) to verify:
1. helper/sendEmail.ts - 9 functions now use HTML template (not plain text)
2. Template quality - inline styles, table layout, logo URL
3. emailService.ts logo URL fix
4. Backend health check
"""

import json
import re
import requests
import sys
from typing import Dict, List, Tuple, Any

class EmailTemplatesTest:
    def __init__(self):
        self.base_url = "https://init-project-9.preview.emergentagent.com"
        self.results = {
            "test_1_plain_text_conversion": {},
            "test_2_template_quality": {},
            "test_3_logo_url_fix": {},
            "test_4_backend_health": {},
            "summary": {}
        }
        
    def test_1_helper_sendEmail_plain_text_conversion(self):
        """
        Test 1: Verify 9 email functions in helper/sendEmail.ts now use HTML template
        All functions should use dynoPayEmailTemplate() and pass htmlBody to mailTransporter
        """
        print("=== TEST 1: Plain Text to HTML Template Conversion ===")
        
        # Function names to check (from review request)
        functions_to_check = [
            "sendPaymentReceivedEmail",
            "sendTransactionConfirmedEmail", 
            "sendWeeklySummaryEmail",
            "sendPaymentPendingEmail",
            "sendPaymentConfirmingEmail",
            "sendPaymentPartialEmail",
            "sendPaymentPartialExpiredEmail",
            "sendSecurityAlertEmail",
            "sendAdminFeeReceivedEmail"
        ]
        
        # Read the sendEmail.ts file content (already loaded above)
        try:
            with open('/app/backend/helper/sendEmail.ts', 'r') as f:
                content = f.read()
        except Exception as e:
            self.results["test_1_plain_text_conversion"]["error"] = f"Failed to read sendEmail.ts: {e}"
            return False
        
        results = {}
        
        for func_name in functions_to_check:
            print(f"\n🔍 Checking {func_name}...")
            
            # Extract function body
            func_pattern = rf'const {func_name}\s*=\s*async\s*\([^)]*\)\s*=>\s*\{{(.*?)^\}};'
            func_match = re.search(func_pattern, content, re.MULTILINE | re.DOTALL)
            
            if not func_match:
                results[func_name] = {
                    "status": "ERROR",
                    "issue": "Function not found",
                    "uses_template": False,
                    "uses_html_body": False
                }
                continue
            
            func_body = func_match.group(1)
            
            # Check 1: Uses dynoPayEmailTemplate
            uses_template = "dynoPayEmailTemplate(" in func_body
            
            # Check 2: Passes htmlBody to mailTransporter (not raw text)
            uses_html_body = "body: htmlBody" in func_body and "body: message" not in func_body
            
            # Check for htmlContent variable
            has_html_content = "htmlContent" in func_body
            
            if uses_template and uses_html_body:
                status = "✅ PASS"
                issue = None
            elif uses_template and not uses_html_body:
                status = "❌ FAIL" 
                issue = "Uses template but still passes raw text to mailTransporter"
            elif not uses_template:
                status = "❌ FAIL"
                issue = "Does not use dynoPayEmailTemplate wrapper"
            else:
                status = "❌ FAIL"
                issue = "Unknown template usage pattern"
            
            results[func_name] = {
                "status": status,
                "issue": issue,
                "uses_template": uses_template,
                "uses_html_body": uses_html_body,
                "has_html_content": has_html_content
            }
            
            print(f"   {status}: Template={uses_template}, HtmlBody={uses_html_body}, Issue={issue}")
        
        # Calculate summary
        total_functions = len(functions_to_check)
        passed_functions = len([r for r in results.values() if r["status"] == "✅ PASS"])
        
        self.results["test_1_plain_text_conversion"] = {
            "functions_checked": results,
            "total_functions": total_functions,
            "passed_functions": passed_functions,
            "pass_rate": f"{passed_functions}/{total_functions} ({(passed_functions/total_functions*100):.1f}%)",
            "overall_status": "✅ PASS" if passed_functions == total_functions else "❌ FAIL"
        }
        
        print(f"\n📊 Test 1 Summary: {passed_functions}/{total_functions} functions converted to HTML template")
        return passed_functions == total_functions
    
    def test_2_template_quality_inline_styles(self):
        """
        Test 2: Verify dynoPayEmailTemplate uses table layout with inline styles
        Check for table role="presentation", inline style attributes, logo image, social icons, footer links
        """
        print("\n=== TEST 2: Template Quality - Inline Styles ===")
        
        try:
            with open('/app/backend/helper/sendEmail.ts', 'r') as f:
                content = f.read()
        except Exception as e:
            self.results["test_2_template_quality"]["error"] = f"Failed to read sendEmail.ts: {e}"
            return False
        
        # Extract dynoPayEmailTemplate function
        template_pattern = r'const dynoPayEmailTemplate\s*=\s*\([^)]*\)\s*=>\s*\{(.*?)^\};'
        template_match = re.search(template_pattern, content, re.MULTILINE | re.DOTALL)
        
        if not template_match:
            self.results["test_2_template_quality"]["error"] = "dynoPayEmailTemplate function not found"
            return False
        
        template_body = template_match.group(1)
        
        checks = {}
        
        # Check 1: Uses table role="presentation" for layout
        has_table_layout = 'role="presentation"' in template_body
        checks["table_layout"] = {
            "status": "✅ PASS" if has_table_layout else "❌ FAIL",
            "found": has_table_layout,
            "description": "Uses <table role=\"presentation\"> for layout (NOT div-based)"
        }
        
        # Check 2: Uses inline styles (not CSS classes)  
        has_inline_styles = 'style="' in template_body
        has_css_classes = 'class="' in template_body and 'class="wrapper"' not in template_body  # Allow some structural classes
        checks["inline_styles"] = {
            "status": "✅ PASS" if has_inline_styles and not has_css_classes else "❌ FAIL", 
            "found": has_inline_styles,
            "css_classes_found": has_css_classes,
            "description": "Uses inline style= attributes (NOT class= based styling)"
        }
        
        # Check 3: Contains logo image tag
        has_logo_img = '<img src="${DYNOPAY_LOGO_URL}"' in template_body or 'img src="${DYNOPAY_LOGO_URL}"' in template_body
        checks["logo_image"] = {
            "status": "✅ PASS" if has_logo_img else "❌ FAIL",
            "found": has_logo_img, 
            "description": "Contains <img src= tag for DynoPay logo"
        }
        
        # Check 4: Logo URL points to correct location
        correct_logo_url = "https://raw.githubusercontent.com/Moxxcompany/DynoFrontend/dharmik-new-design/assets/Images/auth/dynopay-logo.png"
        has_correct_logo = correct_logo_url in content
        checks["correct_logo_url"] = {
            "status": "✅ PASS" if has_correct_logo else "❌ FAIL",
            "found": has_correct_logo,
            "description": f"Logo URL points to: {correct_logo_url}"
        }
        
        # Check 5: Contains social media icons (flaticon CDN)
        has_social_icons = "flaticon.com" in template_body or "cdn-icons-png.flaticon.com" in template_body
        checks["social_media_icons"] = {
            "status": "✅ PASS" if has_social_icons else "❌ FAIL",
            "found": has_social_icons,
            "description": "Footer includes social media icon images from flaticon CDN"
        }
        
        # Check 6: Footer contains Privacy, Terms, Support links
        has_privacy_link = "privacy" in template_body.lower()
        has_terms_link = "terms" in template_body.lower() 
        has_support_link = "support" in template_body.lower()
        has_footer_links = has_privacy_link and has_terms_link and has_support_link
        checks["footer_links"] = {
            "status": "✅ PASS" if has_footer_links else "❌ FAIL", 
            "privacy_found": has_privacy_link,
            "terms_found": has_terms_link,
            "support_found": has_support_link,
            "description": "Footer includes Privacy, Terms, Support links"
        }
        
        # Print results
        for check_name, check_data in checks.items():
            print(f"   {check_data['status']}: {check_data['description']}")
            if "found" in check_data:
                print(f"      Found: {check_data['found']}")
        
        # Calculate summary
        total_checks = len(checks)
        passed_checks = len([c for c in checks.values() if c["status"] == "✅ PASS"])
        
        self.results["test_2_template_quality"] = {
            "checks": checks,
            "total_checks": total_checks,
            "passed_checks": passed_checks, 
            "pass_rate": f"{passed_checks}/{total_checks} ({(passed_checks/total_checks*100):.1f}%)",
            "overall_status": "✅ PASS" if passed_checks == total_checks else "❌ FAIL"
        }
        
        print(f"\n📊 Test 2 Summary: {passed_checks}/{total_checks} template quality checks passed")
        return passed_checks == total_checks
    
    def test_3_emailService_logo_url_fix(self):
        """
        Test 3: Verify emailService.ts logo URL is fixed
        Check DYNOPAY_LOGO_URL constant and verify old URL is removed
        """
        print("\n=== TEST 3: EmailService Logo URL Fix ===")
        
        try:
            with open('/app/backend/services/emailService.ts', 'r') as f:
                content = f.read()
        except Exception as e:
            self.results["test_3_logo_url_fix"]["error"] = f"Failed to read emailService.ts: {e}"
            return False
        
        checks = {}
        
        # Check 1: DYNOPAY_LOGO_URL constant has correct value
        correct_logo_url = "https://raw.githubusercontent.com/Moxxcompany/DynoFrontend/dharmik-new-design/assets/Images/auth/dynopay-logo.png"
        has_correct_constant = f'DYNOPAY_LOGO_URL = "{correct_logo_url}"' in content
        checks["logo_url_constant"] = {
            "status": "✅ PASS" if has_correct_constant else "❌ FAIL",
            "found": has_correct_constant,
            "description": f"DYNOPAY_LOGO_URL = '{correct_logo_url}'"
        }
        
        # Check 2: Old URL (DynocheckoutDarkMode) is NOT present
        old_url_removed = "DynocheckoutDarkMode" not in content
        checks["old_url_removed"] = {
            "status": "✅ PASS" if old_url_removed else "❌ FAIL", 
            "found": old_url_removed,
            "description": "Old URL 'DynocheckoutDarkMode' removed from file"
        }
        
        # Check 3: Test logo URL returns HTTP 200
        try:
            response = requests.head(correct_logo_url, timeout=10, allow_redirects=True)
            logo_url_accessible = response.status_code == 200
            status_code = response.status_code
        except Exception as e:
            logo_url_accessible = False
            status_code = f"Error: {e}"
        
        checks["logo_url_http_status"] = {
            "status": "✅ PASS" if logo_url_accessible else "❌ FAIL",
            "found": logo_url_accessible,
            "http_status": status_code,
            "description": "Logo URL returns HTTP 200 (accessible)"
        }
        
        # Print results
        for check_name, check_data in checks.items():
            print(f"   {check_data['status']}: {check_data['description']}")
            if "http_status" in check_data:
                print(f"      HTTP Status: {check_data['http_status']}")
        
        # Calculate summary
        total_checks = len(checks)
        passed_checks = len([c for c in checks.values() if c["status"] == "✅ PASS"])
        
        self.results["test_3_logo_url_fix"] = {
            "checks": checks,
            "total_checks": total_checks,
            "passed_checks": passed_checks,
            "pass_rate": f"{passed_checks}/{total_checks} ({(passed_checks/total_checks*100):.1f}%)",
            "overall_status": "✅ PASS" if passed_checks == total_checks else "❌ FAIL"
        }
        
        print(f"\n📊 Test 3 Summary: {passed_checks}/{total_checks} logo URL checks passed")
        return passed_checks == total_checks
    
    def test_4_backend_health_check(self):
        """
        Test 4: Verify backend health after email template changes
        Ensure backend didn't crash from the email overhaul changes
        """
        print("\n=== TEST 4: Backend Health Check ===")
        
        # Try login endpoint to verify backend is working (no /api/health endpoint exists)
        test_url = f"{self.base_url}/api/user/login"
        
        try:
            # Send invalid login to get expected 400 validation response
            response = requests.post(test_url, 
                                   json={"email": "test", "password": "test"}, 
                                   timeout=10,
                                   headers={"Content-Type": "application/json"})
            
            # Backend is healthy if it responds with proper validation (400 is expected)
            if response.status_code == 400:
                try:
                    response_data = response.json()
                    if "message" in response_data and "errors" in response_data:
                        status = "✅ PASS"
                        message = "Backend is healthy - API responding with proper validation"
                        health_data = {"api_working": True, "validation_working": True, "response": response_data}
                    else:
                        status = "❌ FAIL"
                        message = "Backend returned 400 but invalid response format"
                        health_data = {"api_working": True, "validation_working": False, "response": response_data}
                except:
                    status = "❌ FAIL"
                    message = "Backend returned 400 but non-JSON response"
                    health_data = {"api_working": True, "validation_working": False, "response": response.text[:200]}
            else:
                health_data = {"status_code": response.status_code, "response": response.text[:200]}
                status = "❌ FAIL"
                message = f"Backend returned unexpected HTTP {response.status_code}"
                
        except requests.exceptions.RequestException as e:
            health_data = {"error": str(e)}
            status = "❌ FAIL" 
            message = f"Failed to connect to backend: {e}"
        
        self.results["test_4_backend_health"] = {
            "test_url": test_url,
            "status": status,
            "message": message,
            "response_data": health_data,
            "overall_status": status
        }
        
        print(f"   {status}: {message}")
        if health_data:
            print(f"      Response: {json.dumps(health_data, indent=2, default=str)[:200]}...")
        
        return status == "✅ PASS"
    
    def run_all_tests(self):
        """
        Run all email template overhaul tests
        """
        print("🚀 DynoPay Email Templates Overhaul - CODE ANALYSIS TESTING")
        print("=" * 60)
        
        test_results = []
        
        # Test 1: Plain text to HTML template conversion
        result1 = self.test_1_helper_sendEmail_plain_text_conversion()
        test_results.append(("Test 1: Plain Text Conversion", result1))
        
        # Test 2: Template quality (inline styles, table layout)
        result2 = self.test_2_template_quality_inline_styles()
        test_results.append(("Test 2: Template Quality", result2))
        
        # Test 3: Logo URL fix in emailService.ts
        result3 = self.test_3_emailService_logo_url_fix()  
        test_results.append(("Test 3: Logo URL Fix", result3))
        
        # Test 4: Backend health
        result4 = self.test_4_backend_health_check()
        test_results.append(("Test 4: Backend Health", result4))
        
        # Overall summary
        total_tests = len(test_results)
        passed_tests = len([r for _, r in test_results if r])
        pass_rate = (passed_tests / total_tests) * 100
        
        print("\n" + "=" * 60)
        print("📊 FINAL TEST SUMMARY")
        print("=" * 60)
        
        for test_name, passed in test_results:
            status_icon = "✅" if passed else "❌"
            print(f"{status_icon} {test_name}")
        
        print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed ({pass_rate:.1f}%)")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - Email templates overhaul is working correctly!")
            overall_status = "SUCCESS"
        else:
            print("❌ SOME TESTS FAILED - Email templates need attention")
            overall_status = "FAILURE"
        
        self.results["summary"] = {
            "total_tests": total_tests,
            "passed_tests": passed_tests, 
            "pass_rate": f"{pass_rate:.1f}%",
            "overall_status": overall_status,
            "test_results": test_results
        }
        
        return overall_status == "SUCCESS"

def main():
    """
    Main test execution
    """
    tester = EmailTemplatesTest()
    success = tester.run_all_tests()
    
    # Save results to file
    with open('/app/email_templates_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2, default=str)
    
    print(f"\n💾 Test results saved to: /app/email_templates_test_results.json")
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()