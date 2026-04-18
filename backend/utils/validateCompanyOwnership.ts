import express from "express";
import jwt from "jsonwebtoken";
import { companyModel } from "../models";
import { IUserType } from "../utils/types";
import { errorResponseHelper } from "../helper";

/**
 * Validates that a company_id belongs to the authenticated user.
 * Returns the company record if valid, or sends a 403 response and returns null.
 *
 * Usage:
 *   const company = await validateCompanyOwnership(req, res, company_id);
 *   if (!company) return; // 403 already sent
 */
export const validateCompanyOwnership = async (
  res: express.Response,
  companyId: string | number,
  userId: number | string
): Promise<Record<string, unknown> | null> => {
  const company = await companyModel.findOne({
    where: { company_id: companyId, user_id: userId },
  });

  if (!company) {
    errorResponseHelper(res, 403, "You don't have access to this company");
    return null;
  }

  return company.dataValues;
};
