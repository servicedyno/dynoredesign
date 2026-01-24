/**
 * Veriff Identity Verification Service
 * Documentation: https://devdocs.veriff.com/apidocs
 */

import axios, { AxiosInstance } from "axios";
import CryptoJS from "crypto-js";

// Veriff API Configuration
const VERIFF_API_BASE_URL = "https://stationapi.veriff.com";
const VERIFF_API_VERSION = "v1";

interface VeriffConfig {
  apiKey: string;
  apiSecret: string;
}

interface CreateSessionParams {
  verification: {
    callback: string;
    person: {
      firstName?: string;
      lastName?: string;
      idNumber?: string;
    };
    vendorData?: string;
    timestamp?: string;
  };
}

interface CreateSessionResponse {
  status: string;
  verification: {
    id: string;
    url: string;
    vendorData: string;
    host: string;
    status: string;
    sessionToken: string;
  };
}

interface VerificationDecision {
  status: string;
  verification: {
    id: string;
    code: number;
    person: {
      firstName: string;
      lastName: string;
      idNumber: string;
      dateOfBirth: string;
      nationality: string;
      addresses: any[];
    };
    document: {
      number: string;
      type: string;
      country: string;
      validFrom: string;
      validUntil: string;
    };
    status: string;
    decision: string;
    decisionTime: string;
    acceptanceTime: string;
    reason: string;
    reasonCode: number;
    comments: any[];
  };
}

class VeriffService {
  private apiKey: string;
  private apiSecret: string;
  private axiosInstance: AxiosInstance;

  constructor(config: VeriffConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    this.axiosInstance = axios.create({
      baseURL: `${VERIFF_API_BASE_URL}/${VERIFF_API_VERSION}`,
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": this.apiKey,
      },
    });
  }

  /**
   * Generate signature for API requests
   * Required for POST requests to Veriff API
   * Uses crypto-js for HMAC-SHA256 signature generation
   */
  private generateSignature(payload: any): string {
    const payloadString = JSON.stringify(payload);
    const signature = CryptoJS.HmacSHA256(payloadString, this.apiSecret).toString(CryptoJS.enc.Hex);
    return signature.toLowerCase();
  }

  /**
   * Create a new verification session
   * This generates a unique session URL for the user to complete verification
   */
  async createSession(params: {
    userId: number;
    companyId: number;
    firstName?: string;
    lastName?: string;
    callbackUrl: string;
  }): Promise<CreateSessionResponse> {
    try {
      const payload: CreateSessionParams = {
        verification: {
          callback: params.callbackUrl,
          person: {
            firstName: params.firstName,
            lastName: params.lastName,
          },
          vendorData: JSON.stringify({
            user_id: params.userId,
            company_id: params.companyId,
          }),
          timestamp: new Date().toISOString(),
        },
      };

      const signature = this.generateSignature(payload);

      const response = await this.axiosInstance.post<CreateSessionResponse>(
        "/sessions",
        payload,
        {
          headers: {
            "X-HMAC-SIGNATURE": signature,
          },
        }
      );

      console.log("Veriff session created:", response.data.verification.id);
      return response.data;

    } catch (error: any) {
      console.error("Veriff create session error:", error.response?.data || error.message);
      throw new Error(
        `Failed to create Veriff session: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Get verification decision/status
   * Check the current status of a verification
   */
  async getVerificationDecision(
    verificationId: string
  ): Promise<VerificationDecision> {
    try {
      const response = await this.axiosInstance.get<VerificationDecision>(
        `/sessions/${verificationId}/decision`,
        {
          headers: {
            "X-AUTH-CLIENT": this.apiKey,
          },
        }
      );

      console.log("Veriff decision retrieved:", verificationId);
      return response.data;

    } catch (error: any) {
      console.error("Veriff get decision error:", error.response?.data || error.message);
      throw new Error(
        `Failed to get Veriff decision: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Verify webhook signature
   * Ensures webhook requests are authentic
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload);
      return signature.toLowerCase() === expectedSignature;
    } catch (error) {
      console.error("Webhook signature verification error:", error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   * Extract relevant information from Veriff webhook
   */
  parseWebhookPayload(payload: any): {
    verificationId: string;
    status: string;
    decision: string;
    decisionCode: string;
    reason: string;
    vendorData: any;
  } {
    const verification = payload.verification || {};
    
    let vendorData = {};
    try {
      vendorData = JSON.parse(verification.vendorData || "{}");
    } catch (e) {
      console.error("Failed to parse vendor data:", e);
    }

    return {
      verificationId: verification.id || "",
      status: verification.status || "unknown",
      decision: verification.decision || "unknown",
      decisionCode: verification.code?.toString() || "",
      reason: verification.reason || "",
      vendorData,
    };
  }

  /**
   * Map Veriff decision to KYC status
   */
  mapDecisionToStatus(decision: string): string {
    const statusMap: { [key: string]: string } = {
      approved: "approved",
      declined: "rejected",
      resubmission_requested: "resubmission_requested",
      expired: "expired",
      abandoned: "abandoned",
    };

    return statusMap[decision] || "pending";
  }
}

// Singleton instance
let veriffServiceInstance: VeriffService | null = null;

/**
 * Initialize Veriff service with credentials
 */
export const initVeriffService = (apiKey: string, apiSecret: string): VeriffService => {
  veriffServiceInstance = new VeriffService({ apiKey, apiSecret });
  return veriffServiceInstance;
};

/**
 * Get Veriff service instance
 */
export const getVeriffService = (): VeriffService => {
  if (!veriffServiceInstance) {
    // Try to initialize from environment variables
    const apiKey = process.env.VERIFF_API_KEY;
    const apiSecret = process.env.VERIFF_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("Veriff API credentials not configured. Please set VERIFF_API_KEY and VERIFF_API_SECRET in environment variables.");
    }

    veriffServiceInstance = new VeriffService({ apiKey, apiSecret });
  }

  return veriffServiceInstance;
};

export default VeriffService;
