/**
 * KYC Routes
 */

import { Router } from "express";
import { auth } from "../middleware/authMiddleware";
import kycController from "../controller/kycController";

const router = Router();

/**
 * @route   GET /api/kyc/status
 * @desc    Get KYC status for authenticated user
 * @access  Private (requires JWT)
 */
router.get("/status", auth, kycController.getKYCStatus);

/**
 * @route   GET /api/kyc/requirements
 * @desc    Get KYC requirements and document list
 * @access  Private (requires JWT)
 */
router.get("/requirements", auth, kycController.getKYCRequirements);

/**
 * @route   POST /api/kyc/submit
 * @desc    Start KYC verification session with Veriff
 * @access  Private (requires JWT)
 */
router.post("/submit", auth, kycController.startKYCVerification);

/**
 * @route   POST /api/kyc/webhook
 * @desc    Webhook endpoint for Veriff verification decisions
 * @access  Public (verified by HMAC signature)
 */
router.post("/webhook", kycController.handleVeriffWebhook);

export default router;
