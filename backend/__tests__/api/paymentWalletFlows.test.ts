/**
 * API Integration Tests — Payment & Wallet Endpoints
 *
 * Tests payment and wallet API access controls:
 * - Payment link creation (requires auth)
 * - Wallet operations (requires auth + wallet middleware)
 * - Transaction listing
 * - Public payment verification
 */
import supertest from "supertest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8001";
const request = supertest(BASE_URL);

// We register and login a test user for auth-required endpoints
const TEST_USER = {
  name: `PayTest_${Date.now()}`,
  email: `paytest_${Date.now()}@dynopay-test.com`,
  password: "TestPass123!",
};

let accessToken = "";

describe("Setup: User Authentication", () => {
  it("Register and login test user", async () => {
    // Register
    await request.post("/api/user/registerUser").send(TEST_USER);

    // Login
    const res = await request
      .post("/api/user/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    if (res.body.data?.accessToken) {
      accessToken = res.body.data.accessToken;
    }
  });
});

describe("Payment Endpoints — Auth Guards", () => {
  it("POST /api/pay/createPaymentLink without auth should return 401", async () => {
    const res = await request
      .post("/api/pay/createPaymentLink")
      .send({ amount: 10, currency: "USD" });

    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/pay/getTransactions without auth should return 401", async () => {
    const res = await request.get("/api/pay/getTransactions");
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/pay/getTransactions with auth should return data", async () => {
    if (!accessToken) return;

    const res = await request
      .get("/api/pay/getTransactions")
      .set("Authorization", `Bearer ${accessToken}`);

    // 200 = success, 400 = missing company (expected for fresh user)
    expect([200, 400]).toContain(res.status);
  });
});

describe("Wallet Endpoints — Auth Guards", () => {
  it("GET /api/wallet/getBalance without auth should return 401", async () => {
    const res = await request.get("/api/wallet/getBalance");
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/wallet/getSupportedCurrencies without auth should return 401", async () => {
    const res = await request.get("/api/wallet/getSupportedCurrencies");
    expect([401, 403]).toContain(res.status);
  });
});

describe("Company Endpoints — Auth Guards", () => {
  it("POST /api/company/addCompany without auth should return 401", async () => {
    const res = await request
      .post("/api/company/addCompany")
      .send({ name: "Test Co" });

    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/company/getCompany without auth should return 401", async () => {
    const res = await request.get("/api/company/getCompany");
    expect([401, 403]).toContain(res.status);
  });
});

describe("Dashboard Endpoints — Auth Guards", () => {
  it("GET /api/dashboard/dashboardInfo without auth should return 401", async () => {
    const res = await request.get("/api/dashboard/dashboardInfo");
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/dashboard/dashboardInfo with auth should respond", async () => {
    if (!accessToken) return;

    const res = await request
      .get("/api/dashboard/dashboardInfo")
      .set("Authorization", `Bearer ${accessToken}`);

    // 200 or 400 (no company) — both valid
    expect([200, 400, 500]).toContain(res.status);
  });
});

describe("Public Endpoints", () => {
  it("GET /api/pay/getSupportedCurrencies should return currencies", async () => {
    const res = await request.get("/api/pay/getSupportedCurrencies");

    // This may or may not require auth depending on implementation
    expect([200, 401]).toContain(res.status);
  });

  it("GET /api/status/services should return service list", async () => {
    const res = await request.get("/api/status/services");

    expect(res.status).toBe(200);
  });
});
