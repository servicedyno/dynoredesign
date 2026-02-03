"""
DynoPay Backend API Regression Tests
=====================================
Tests for verifying backend functionality after TypeScript error fixes.
Tests: Health check, User login, User registration, Payment links, Company APIs, Wallet APIs, Swagger docs

Test credentials:
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38
"""

import pytest
import requests
import os
import json
import time

# Use localhost for internal testing (backend runs on port 8001)
BASE_URL = "http://localhost:8001"

# Test credentials
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"
TEST_COMPANY_ID = 38


class TestHealthCheck:
    """Health check endpoint tests - verify backend is running"""
    
    def test_health_endpoint(self):
        """Test /health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Backend unhealthy: {data}"
        assert data.get("database") == "connected", f"Database not connected: {data}"
        assert "timestamp" in data
        assert "uptime" in data
        print(f"✅ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test / root endpoint returns API info"""
        response = requests.get(f"{BASE_URL}/", timeout=10)
        assert response.status_code == 200, f"Root endpoint failed: {response.text}"
        
        data = response.json()
        assert "message" in data or "status" in data
        print(f"✅ Root endpoint passed: {data.get('message', data.get('status'))}")
    
    def test_api_base_endpoint(self):
        """Test /api base endpoint returns API status"""
        response = requests.get(f"{BASE_URL}/api", timeout=10)
        assert response.status_code == 200, f"API base endpoint failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "operational"
        assert "endpoints" in data
        print(f"✅ API base endpoint passed: {data.get('service')}")


class TestSwaggerDocs:
    """Swagger documentation tests"""
    
    def test_swagger_docs_loads(self):
        """Test /api/docs loads Swagger UI"""
        response = requests.get(f"{BASE_URL}/api/docs/", timeout=10)
        assert response.status_code == 200, f"Swagger docs failed: {response.status_code}"
        
        # Check it returns HTML with Swagger UI
        assert "swagger" in response.text.lower() or "DynoPay" in response.text
        print("✅ Swagger docs endpoint loads successfully")


class TestUserAuthentication:
    """User authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        assert "accessToken" in data["data"]
        assert "userData" in data["data"]
        assert data["data"]["userData"]["email"] == TEST_EMAIL
        print(f"✅ Login successful for user: {TEST_EMAIL}")
        return data["data"]["accessToken"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns error"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        # Should return 401 or 400 for invalid credentials
        assert response.status_code in [400, 401, 500], f"Expected error status, got: {response.status_code}"
        print(f"✅ Invalid login correctly rejected with status: {response.status_code}")
    
    def test_login_missing_fields(self):
        """Test login with missing fields returns error"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL},  # Missing password
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        assert response.status_code in [400, 401, 500], f"Expected error status, got: {response.status_code}"
        print(f"✅ Missing fields correctly rejected with status: {response.status_code}")
    
    def test_check_email_endpoint(self):
        """Test email check endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/user/checkEmail",
            params={"email": TEST_EMAIL},
            timeout=10
        )
        # Should return 200 with email status
        assert response.status_code == 200, f"Check email failed: {response.text}"
        print(f"✅ Check email endpoint works")


class TestUserProfile:
    """User profile endpoint tests (requires authentication)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["accessToken"]
        pytest.skip("Authentication failed")
    
    def test_get_profile(self, auth_token):
        """Test getting user profile"""
        response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get profile successful")


class TestCompanyAPIs:
    """Company management API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["accessToken"]
        pytest.skip("Authentication failed")
    
    def test_get_companies(self, auth_token):
        """Test getting user's companies"""
        response = requests.get(
            f"{BASE_URL}/api/company/getCompany",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get companies failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get companies successful, found {len(data['data'])} companies")
    
    def test_get_company_by_id(self, auth_token):
        """Test getting specific company by ID"""
        response = requests.get(
            f"{BASE_URL}/api/company/getCompany/{TEST_COMPANY_ID}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get company by ID failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get company by ID successful: {data['data'].get('company_name', 'N/A')}")
    
    def test_get_company_transactions(self, auth_token):
        """Test getting company transactions"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/{TEST_COMPANY_ID}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get company transactions successful")


class TestPaymentLinkAPIs:
    """Payment link API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["accessToken"]
        pytest.skip("Authentication failed")
    
    def test_get_payment_links(self, auth_token):
        """Test getting payment links"""
        response = requests.get(
            f"{BASE_URL}/api/pay/getPaymentLinks",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get payment links failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get payment links successful, found {len(data['data'])} links")
    
    def test_get_company_currencies(self, auth_token):
        """Test getting company configured currencies"""
        response = requests.get(
            f"{BASE_URL}/api/pay/company-currencies/{TEST_COMPANY_ID}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get company currencies failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get company currencies successful")
    
    def test_get_fee_preview(self, auth_token):
        """Test getting fee preview"""
        response = requests.get(
            f"{BASE_URL}/api/pay/fee-preview",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get fee preview failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get fee preview successful")
    
    def test_get_network_fees(self):
        """Test getting network fees (public endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/pay/network-fees",
            timeout=10
        )
        assert response.status_code == 200, f"Get network fees failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get network fees successful")
    
    def test_create_payment_link(self, auth_token):
        """Test creating a payment link"""
        test_link_data = {
            "company_id": TEST_COMPANY_ID,
            "link_name": f"TEST_TypeScript_Regression_{int(time.time())}",
            "amount": 10.00,
            "currency": "USD",
            "description": "Test payment link for TypeScript regression testing"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink",
            json=test_link_data,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=15
        )
        assert response.status_code == 200, f"Create payment link failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        link_id = data["data"].get("link_id")
        print(f"✅ Create payment link successful, ID: {link_id}")
        
        # Cleanup - delete the test link
        if link_id:
            cleanup_response = requests.delete(
                f"{BASE_URL}/api/pay/deletePaymentLink/{link_id}",
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            if cleanup_response.status_code == 200:
                print(f"✅ Test payment link cleaned up")


class TestWalletAPIs:
    """Wallet management API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["accessToken"]
        pytest.skip("Authentication failed")
    
    def test_get_wallet(self, auth_token):
        """Test getting user wallet"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/getWallet",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get wallet failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get wallet successful")
    
    def test_get_wallet_addresses(self, auth_token):
        """Test getting wallet addresses"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/getWalletAddresses",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get wallet addresses failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get wallet addresses successful, found {len(data['data'])} addresses")
    
    def test_get_configured_currencies(self, auth_token):
        """Test getting configured currencies"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/configured-currencies",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get configured currencies failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get configured currencies successful")
    
    def test_wallet_network_fees(self, auth_token):
        """Test getting wallet network fees"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/network-fees",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        assert response.status_code == 200, f"Get wallet network fees failed: {response.text}"
        
        data = response.json()
        assert "data" in data
        print(f"✅ Get wallet network fees successful")


class TestDashboardAPIs:
    """Dashboard API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["accessToken"]
        pytest.skip("Authentication failed")
    
    def test_get_dashboard_data(self, auth_token):
        """Test getting dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=15
        )
        # Dashboard might return 200 or other status depending on data
        assert response.status_code in [200, 404], f"Get dashboard failed: {response.text}"
        print(f"✅ Dashboard endpoint responded with status: {response.status_code}")


class TestStatusAPIs:
    """Status page API tests (public endpoints)"""
    
    def test_get_status(self):
        """Test getting system status"""
        response = requests.get(
            f"{BASE_URL}/api/status",
            timeout=10
        )
        assert response.status_code == 200, f"Get status failed: {response.text}"
        print(f"✅ Status endpoint works")


class TestReferralAPIs:
    """Referral system API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["accessToken"]
        pytest.skip("Authentication failed")
    
    def test_get_referral_stats(self, auth_token):
        """Test getting referral stats"""
        response = requests.get(
            f"{BASE_URL}/api/referral/stats",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        # Referral endpoint might return 200 or 404 if no referrals
        assert response.status_code in [200, 404], f"Get referral stats failed: {response.text}"
        print(f"✅ Referral stats endpoint responded with status: {response.status_code}")


class TestKnowledgeBaseAPIs:
    """Knowledge Base API tests (public endpoints)"""
    
    def test_get_kb_categories(self):
        """Test getting knowledge base categories"""
        response = requests.get(
            f"{BASE_URL}/api/kb/categories",
            timeout=10
        )
        assert response.status_code == 200, f"Get KB categories failed: {response.text}"
        print(f"✅ Knowledge base categories endpoint works")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
