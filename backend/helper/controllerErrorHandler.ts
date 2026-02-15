import { Response } from "express";
import { getErrorMessage, errorResponseHelper } from "../helper";
import { Logger } from "winston";

/**
 * Standard controller error handler. Extracts message, logs with context, sends 500.
 * Replaces the repeated 7-line catch block pattern across all controllers.
 * 
 * Usage:
 *   } catch (e) {
 *     handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
 *   }
 */
export function handleControllerError(
  res: Response,
  e: unknown,
  logger: Logger,
  context: Record<string, unknown> = {}
): void {
  const message = getErrorMessage(e);
  logger.error(message, context, new Error(e as string));
  errorResponseHelper(res, 500, message);
}

/**
 * Same as handleControllerError but returns the result (for early-return patterns).
 */
export function handleControllerErrorReturn(
  res: Response,
  e: unknown,
  logger: Logger,
  context: Record<string, unknown> = {}
) {
  const message = getErrorMessage(e);
  logger.error(message, context, new Error(e as string));
  return errorResponseHelper(res, 500, message);
}
