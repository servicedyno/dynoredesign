import express from "express";
import {
  createTrialLink,
  getTrialLink,
  getTrialLinkByManagementToken,
  claimFunds,
  listTrialLinks,
} from "../controller/publicTrialController";

const publicTrialRouter = express.Router();

/**
 * Public Trial Payment Link Routes
 * No authentication required — these are public-facing endpoints
 * for the "Try Before You Sign Up" feature.
 */

// POST /api/public/create-trial-link — Create a new trial payment link
publicTrialRouter.post("/create-trial-link", createTrialLink);

// GET /api/public/trial/manage/:token — Get trial link via management token (email link)
publicTrialRouter.get("/trial/manage/:token", getTrialLinkByManagementToken);

// GET /api/public/trial/:slug — Get trial link details (for payment page)
publicTrialRouter.get("/trial/:slug", getTrialLink);

// POST /api/public/claim-funds — Claim funds from a paid trial link
publicTrialRouter.post("/claim-funds", claimFunds);

// GET /api/public/trial-links — List trial links created by this IP
publicTrialRouter.get("/trial-links", listTrialLinks);

export default publicTrialRouter;
