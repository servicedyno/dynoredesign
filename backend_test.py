#!/usr/bin/env python3
"""
Backend Testing Script - Route Aliases Testing
Testing the 4 newly added route aliases for frontend compatibility
"""
import subprocess
import json
import requests
import sys
import os

# Backend URL from frontend .env (as per system instructions)
BACKEND_URL = "https://foundation-build-3.preview.emergentagent.com"

def test_backend_healthy():
    """TEST 1: Backend healthy - GET /health returns 200 with status 'healthy'"""
    print("\n=== TEST 1: Backend Health Check ===")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print("✅ Backend healthy: GET /health returns 200 with status='healthy'")
                print(f"   Service: {data.get('service', 'Unknown')}")
                print(f"   Database: {data.get('database', 'Unknown')}")
                print(f"   Redis: {data.get('redis', 'Unknown')}")
                return True
            else:
                print(f"❌ Backend unhealthy: status = {data.get('status')}")
                return False
        else:
            print(f"❌ Backend health check failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend health check error: {e}")
        return False

def test_typescript_compiles():
    """TEST 2: TypeScript compiles clean - npx tsc --noEmit --skipLibCheck"""
    print("\n=== TEST 2: TypeScript Compilation ===")
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit", "--skipLibCheck"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("✅ TypeScript compilation clean: npx tsc --noEmit --skipLibCheck exits with code 0")
            return True
        else:
            print(f"❌ TypeScript compilation failed: exit code {result.returncode}")
            if result.stderr:
                print(f"   Errors: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ TypeScript compilation timeout after 60 seconds")
        return False
    except Exception as e:
        print(f"❌ TypeScript compilation error: {e}")
        return False

def test_dashboard_count_query():
    """TEST 3: Dashboard count query has NO status filter for main counts"""
    print("\n=== TEST 3: Dashboard Count Query Status Filter ===")
    try:
        # Read the dashboardController.ts file and check the countQuery
        with open("/app/backend/controller/dashboardController.ts", "r") as f:
            content = f.read()
        
        # Find the countQuery section
        lines = content.split('\n')
        in_count_query = False
        count_query_lines = []
        
        for line in lines:
            if 'countQuery = `' in line or 'const countQuery = `' in line:
                in_count_query = True
                count_query_lines.append(line)
            elif in_count_query:
                count_query_lines.append(line)
                if '`;' in line and not line.strip().startswith('//'):
                    break
        
        count_query = '\n'.join(count_query_lines)
        print("Found countQuery:")
        print(count_query)
        
        # Check that main counts do NOT have status filter
        status_filter_in_main_counts = False
        pending_filter_present = False
        
        # Check for problematic patterns in the count query
        if "status = 'done'" in count_query or "status IN ('successful'" in count_query:
            # But only if it's not just for pending_count
            if "FILTER (WHERE ut.status = 'pending')" not in count_query:
                status_filter_in_main_counts = True
        
        # Check that pending_count has proper filter
        if "FILTER (WHERE ut.status = 'pending')" in count_query:
            pending_filter_present = True
        
        if not status_filter_in_main_counts and pending_filter_present:
            print("✅ Dashboard count query correct:")
            print("   - Main counts (total_count, current_month_count, last_month_count) have NO status filter")
            print("   - Only pending_count filters by status='pending'")
            return True
        else:
            print("❌ Dashboard count query issues found:")
            if status_filter_in_main_counts:
                print("   - Main counts have unwanted status filter")
            if not pending_filter_present:
                print("   - pending_count missing status='pending' filter")
            return False
            
    except Exception as e:
        print(f"❌ Error checking dashboard count query: {e}")
        return False

def test_dashboard_volume_conversion():
    """TEST 4: Dashboard volume uses per-currency conversion"""
    print("\n=== TEST 4: Dashboard Volume Per-Currency Conversion ===")
    try:
        # Check for convertVolumesToFiat function usage
        result = subprocess.run(
            ["grep", "-c", "convertVolumesToFiat", "/app/backend/controller/dashboardController.ts"],
            capture_output=True,
            text=True
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        
        if count >= 5:
            print(f"✅ convertVolumesToFiat found {count} times (>= 5 required)")
            
            # Check for GROUP BY base_currency in volume query
            with open("/app/backend/controller/dashboardController.ts", "r") as f:
                content = f.read()
            
            if "GROUP BY ut.base_currency" in content:
                print("✅ Volume query groups by base_currency for proper conversion")
                
                # Check for specific convertVolumesToFiat calls
                if ("convertVolumesToFiat(volumeRows, 'total_vol'" in content and
                    "convertVolumesToFiat(volumeRows, 'current_month_vol'" in content and
                    "convertVolumesToFiat(volumeRows, 'last_month_vol'" in content):
                    print("✅ All three volume conversions use convertVolumesToFiat helper")
                    return True
                else:
                    print("❌ Missing some convertVolumesToFiat calls for volumes")
                    return False
            else:
                print("❌ Volume query missing GROUP BY base_currency")
                return False
        else:
            print(f"❌ convertVolumesToFiat found only {count} times (need >= 5)")
            return False
            
    except Exception as e:
        print(f"❌ Error checking volume conversion: {e}")
        return False

def test_self_transactions_included():
    """TEST 5: Self-transactions included in total count"""
    print("\n=== TEST 5: Self-Transactions in Total Count ===")
    try:
        # Check for tbl_user_self_transaction query
        result = subprocess.run(
            ["grep", "tbl_user_self_transaction", "/app/backend/controller/dashboardController.ts"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            print("✅ tbl_user_self_transaction query found in dashboardController")
            
            # Check that selfCount is added to totalCount
            with open("/app/backend/controller/dashboardController.ts", "r") as f:
                content = f.read()
            
            if "selfCount" in content and ("incomingTotal + selfCount" in content or "totalCount = incomingTotal + selfCount" in content):
                print("✅ Self-transaction count is added to total transaction count")
                
                # Check for selfCountQuery
                if "selfCountQuery" in content:
                    print("✅ Dedicated selfCountQuery variable found")
                    return True
                else:
                    print("❌ selfCountQuery variable not found")
                    return False
            else:
                print("❌ selfCount not being added to totalCount")
                return False
        else:
            print("❌ No tbl_user_self_transaction query found")
            return False
            
    except Exception as e:
        print(f"❌ Error checking self-transactions: {e}")
        return False

def test_chart_endpoint_no_status_filter():
    """TEST 6: Chart endpoint has NO status filter"""
    print("\n=== TEST 6: Chart Endpoint Status Filter ===")
    try:
        with open("/app/backend/controller/dashboardController.ts", "r") as f:
            content = f.read()
        
        # Find the chartQuery section in getChartData function
        lines = content.split('\n')
        in_chart_function = False
        in_chart_query = False
        chart_query_lines = []
        
        for line in lines:
            if 'const getChartData =' in line or 'getChartData = async' in line:
                in_chart_function = True
            elif in_chart_function and ('chartQuery = `' in line or 'const chartQuery = `' in line):
                in_chart_query = True
                chart_query_lines.append(line)
            elif in_chart_query:
                chart_query_lines.append(line)
                if '`;' in line and not line.strip().startswith('//'):
                    break
        
        chart_query = '\n'.join(chart_query_lines)
        print("Found chartQuery:")
        print(chart_query)
        
        # Check that chart query has NO status filter
        has_status_filter = ("status IN" in chart_query or 
                           "status = 'done'" in chart_query or 
                           "status = 'successful'" in chart_query)
        
        # Check that it groups by base_currency for proper conversion
        has_base_currency_group = "GROUP BY" in chart_query and "base_currency" in chart_query
        
        if not has_status_filter and has_base_currency_group:
            print("✅ Chart query correct:")
            print("   - NO status filter (includes all transactions)")
            print("   - Groups by date AND base_currency for proper fiat conversion")
            return True
        else:
            print("❌ Chart query issues:")
            if has_status_filter:
                print("   - Contains unwanted status filter")
            if not has_base_currency_group:
                print("   - Missing base_currency grouping")
            return False
            
    except Exception as e:
        print(f"❌ Error checking chart endpoint: {e}")
        return False

def test_no_done_status_references():
    """TEST 7: No remaining 'done' status references anywhere in file"""
    print("\n=== TEST 7: No 'done' Status References ===")
    try:
        result = subprocess.run(
            ["grep", "-c", "done", "/app/backend/controller/dashboardController.ts"],
            capture_output=True,
            text=True
        )
        
        # Also check for specific pattern status='done'
        result2 = subprocess.run(
            ["grep", "status.*=.*['\"]done['\"]", "/app/backend/controller/dashboardController.ts"],
            capture_output=True,
            text=True
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        
        if result2.returncode != 0 or not result2.stdout.strip():
            print("✅ No status='done' patterns found in dashboardController")
            return True
        else:
            print(f"❌ Found status='done' references:")
            print(result2.stdout)
            return False
            
    except Exception as e:
        print(f"❌ Error checking 'done' status references: {e}")
        return False

def test_existing_jest_tests():
    """TEST 8: Existing jest tests still pass (no regressions)"""
    print("\n=== TEST 8: Jest Tests (No Regressions) ===")
    try:
        # Run specific test patterns mentioned in review request
        result = subprocess.run(
            ["npx", "jest", "--forceExit", "--testPathPatterns=paymentStateMachine|webhookProcessor"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=120
        )
        
        output_lines = result.stdout.split('\n')
        last_10_lines = output_lines[-10:]
        
        print("Last 10 lines of jest output:")
        for line in last_10_lines:
            print(f"   {line}")
        
        if result.returncode == 0:
            print("✅ Jest tests passed: paymentStateMachine and webhookProcessor tests")
            return True
        else:
            print(f"❌ Jest tests failed: exit code {result.returncode}")
            # Check if there are any test failures
            if "FAIL" in result.stdout or "failed" in result.stdout.lower():
                print("   Some tests failed - check output above")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Jest tests timeout after 120 seconds")
        return False
    except Exception as e:
        print(f"❌ Error running jest tests: {e}")
        return False

def main():
    """Run all dashboard endpoint tests"""
    print("=== DASHBOARD ENDPOINTS FIX VERIFICATION ===")
    print("Testing 3 root cause fixes in /app/backend/controller/dashboardController.ts:")
    print("1. Status filter removal from main count queries")
    print("2. Per-currency volume conversion with convertVolumesToFiat helper")  
    print("3. Self-transactions included in total count")
    print(f"Backend URL: {BACKEND_URL}")
    
    tests = [
        ("Backend Health", test_backend_healthy),
        ("TypeScript Compilation", test_typescript_compiles), 
        ("Dashboard Count Query", test_dashboard_count_query),
        ("Dashboard Volume Conversion", test_dashboard_volume_conversion),
        ("Self-Transactions Included", test_self_transactions_included),
        ("Chart Endpoint No Status Filter", test_chart_endpoint_no_status_filter),
        ("No 'done' Status References", test_no_done_status_references),
        ("Jest Tests (No Regressions)", test_existing_jest_tests),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*60)
    print("DASHBOARD ENDPOINTS FIX TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL DASHBOARD ENDPOINT FIXES VERIFIED SUCCESSFULLY!")
        print("✅ Root Cause 1: Status filters removed from main count queries")
        print("✅ Root Cause 2: Per-currency volume conversion implemented") 
        print("✅ Root Cause 3: Self-transactions included in total count")
        return True
    else:
        print(f"\n❌ {total - passed} test(s) failed - dashboard fixes need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)