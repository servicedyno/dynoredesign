/**
 * Two-Factor Authentication Controller
 * 
 * Endpoints:
 * - POST /2fa/setup — Initiate 2FA setup (returns QR + backup codes)
 * - POST /2fa/verify-setup — Verify and enable 2FA
 * - POST /2fa/validate — Validate 2FA token during login
 * - POST /2fa/disable — Disable 2FA
 * - POST /2fa/regenerate-backup-codes — Get new backup codes
 * - GET /2fa/status — Get 2FA status
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import {
  setup2FA,
  verify2FASetup,
  validate2FAToken,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
} from "../services/twoFactorService";
import { verifyPassword } from "../helper/passwordHelper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";

/**
 * POST /api/user/2fa/setup
 */
const setupEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const result = await setup2FA(userData.user_id, userData.email);

    successResponseHelper(res, 200, "2FA setup initiated. Scan QR code with your authenticator app, then verify with a code.", {
      qr_code: result.qr_code,
      secret: result.secret, // For manual entry
      backup_codes: result.backup_codes, // SHOW ONCE
      important: "Save your backup codes securely. They will not be shown again.",
    });
  } catch (e) {
    if ((e as Error).message.includes("already enabled")) {
      return errorResponseHelper(res, 409, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/verify-setup
 * Body: { token: "123456" }
 */
const verifySetupEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const { token } = req.body;

    if (!token) {
      return errorResponseHelper(res, 400, "Verification token is required");
    }

    await verify2FASetup(userData.user_id, token);

    successResponseHelper(res, 200, "2FA has been enabled successfully.", {
      enabled: true,
    });
  } catch (e) {
    if ((e as Error).message.includes("Invalid verification")) {
      return errorResponseHelper(res, 400, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/validate
 * Body: { user_id: number, token: "123456" }
 * Used during login when 2FA is required
 */
const validateEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const { user_id, token } = req.body;

    if (!user_id || !token) {
      return errorResponseHelper(res, 400, "user_id and token are required");
    }

    const result = await validate2FAToken(user_id, token);

    if (!result.valid) {
      return errorResponseHelper(res, 401, "Invalid 2FA code. Please try again.");
    }

    successResponseHelper(res, 200, "2FA verification successful", {
      valid: true,
      method: result.method,
    });
  } catch (e) {
    if ((e as Error).message.includes("locked")) {
      return errorResponseHelper(res, 429, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/disable
 * Body: { password: "current_password" }
 */
const disableEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const { password } = req.body;

    if (!password) {
      return errorResponseHelper(res, 400, "Password is required to disable 2FA");
    }

    // Verify password before disabling
    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const isValid = await verifyPassword(password, user.dataValues.password, userData.user_id);
    if (!isValid) {
      return errorResponseHelper(res, 401, "Invalid password");
    }

    await disable2FA(userData.user_id);

    successResponseHelper(res, 200, "2FA has been disabled.", { enabled: false });
  } catch (e) {
    if ((e as Error).message.includes("not currently enabled")) {
      return errorResponseHelper(res, 400, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/regenerate-backup-codes
 * Body: { password: "current_password" }
 */
const regenerateBackupCodesEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const { password } = req.body;

    if (!password) {
      return errorResponseHelper(res, 400, "Password is required");
    }

    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const isValid = await verifyPassword(password, user.dataValues.password, userData.user_id);
    if (!isValid) {
      return errorResponseHelper(res, 401, "Invalid password");
    }

    const codes = await regenerateBackupCodes(userData.user_id);

    successResponseHelper(res, 200, "New backup codes generated. Save them securely.", {
      backup_codes: codes,
      important: "Your old backup codes are now invalid. Save these new codes securely.",
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/2fa/status
 */
const statusEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const status = await get2FAStatus(userData.user_id);

    successResponseHelper(res, 200, "2FA status retrieved", status);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default {
  setupEndpoint,
  verifySetupEndpoint,
  validateEndpoint,
  disableEndpoint,
  regenerateBackupCodesEndpoint,
  statusEndpoint,
};
