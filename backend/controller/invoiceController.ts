import express from "express";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { IUserType } from "../utils/types";
import invoiceModel from "../models/invoiceModel";
import { userTransactionModel, companyModel } from "../models";
import { apiLogger } from "../utils/loggers";

/**
 * Generate invoice number
 * Format: INV-YYYYMMDD-XXXXX
 */
const generateInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `INV-${year}${month}${day}`;

  // Get count of invoices created today
  const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const count = await invoiceModel.count({
    where: {
      invoice_date: {
        $gte: todayStart,
        $lt: todayEnd,
      },
    },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${datePrefix}-${sequence}`;
};

/**
 * Auto-generate invoice for a transaction
 * Called internally when transaction is completed
 * 
 * @param transactionId - The transaction ID
 * @param companyId - The company ID
 */
export const autoGenerateInvoice = async (
  transactionId: number,
  companyId: number
): Promise<any> => {
  try {
    // Check if invoice already exists
    const existingInvoice = await invoiceModel.findOne({
      where: { transaction_id: transactionId },
    });

    if (existingInvoice) {
      console.log(`Invoice already exists for transaction ${transactionId}`);
      return existingInvoice;
    }

    // Get transaction details
    const transaction = await userTransactionModel.findOne({
      where: { transaction_id: transactionId },
    });

    if (!transaction) {
      console.error(`Transaction ${transactionId} not found`);
      return null;
    }

    const txData = transaction.dataValues;

    // Get company details for customer info
    const company = await companyModel.findOne({
      where: { company_id: companyId },
    });

    if (!company) {
      console.error(`Company ${companyId} not found`);
      return null;
    }

    const companyData = company.dataValues;

    // Provider details (Dynotech Innovations, LDA)
    const providerInfo = {
      provider_name: "Dynotech Innovations, LDA",
      provider_address: "Rua Luís de Camões 1017, 7° Dt°\nMontijo 2870-154\nPortugal",
      provider_vat_id: "PT518713130",
    };

    // Customer details from company profile
    const customerAddress = [
      companyData.address_line1,
      companyData.address_line2,
      companyData.city,
      companyData.state,
      companyData.country,
      companyData.zip_code,
    ]
      .filter(Boolean)
      .join("\n");

    // Calculate fees
    const baseAmount = parseFloat(txData.base_amount || 0);
    const transactionFeePercent = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "2.0");
    const blockchainBufferPercent = 0.5; // Default blockchain buffer

    // Get fee tier configuration
    const amount = baseAmount;
    let fixedFee = 0;
    let bufferPercent = blockchainBufferPercent;

    // Apply fee tiers
    if (amount >= 5 && amount <= 100) {
      fixedFee = parseFloat(process.env.FEE_TIER_1_FIXED || "3");
      bufferPercent = parseFloat(process.env.FEE_TIER_1_BUFFER || "1.0");
    } else if (amount >= 101 && amount <= 500) {
      fixedFee = parseFloat(process.env.FEE_TIER_2_FIXED || "2");
      bufferPercent = parseFloat(process.env.FEE_TIER_2_BUFFER || "0.8");
    } else if (amount >= 501 && amount <= 1000) {
      fixedFee = parseFloat(process.env.FEE_TIER_3_FIXED || "1.5");
      bufferPercent = parseFloat(process.env.FEE_TIER_3_BUFFER || "0.5");
    } else if (amount >= 1001) {
      fixedFee = parseFloat(process.env.FEE_TIER_4_FIXED || "1");
      bufferPercent = parseFloat(process.env.FEE_TIER_4_BUFFER || "0.3");
    }

    // Calculate VAT (if applicable)
    let vatRate = 0;
    let vatAmount = 0;

    if (companyData.vat_verified && companyData.country) {
      // VAT applies to EU countries
      const euCountries = [
        "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
        "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL",
        "PT", "RO", "SE", "SI", "SK",
      ];

      if (euCountries.includes(companyData.country)) {
        // Get VAT rate from tax_rate table or use default
        vatRate = 23; // Portugal standard rate, should be fetched from tbl_tax_rate
        vatAmount = (baseAmount * vatRate) / 100;
      }
    }

    // Calculate totals
    const unitPrice = baseAmount;
    const totalUsd = baseAmount + fixedFee + vatAmount;
    const totalCrypto = totalUsd; // Should be converted based on exchange rate

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice record
    const invoiceData = {
      invoice_number: invoiceNumber,
      transaction_id: transactionId,
      company_id: companyId,
      ...providerInfo,
      customer_name: companyData.company_name,
      customer_address: customerAddress,
      customer_tax_id: companyData.vat_number || null,
      description: `Payment processing service - Transaction ${txData.transaction_reference || transactionId}`,
      unit_price: unitPrice,
      quantity: 1,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      fixed_fee: fixedFee,
      transaction_fee_percent: transactionFeePercent,
      blockchain_buffer_percent: bufferPercent,
      total_usd: totalUsd,
      total_crypto: totalCrypto,
      crypto_currency: txData.base_currency || "USD",
      payment_terms: "Payment due upon receipt",
      invoice_date: new Date(),
    };

    const invoice = await invoiceModel.create(invoiceData);

    console.log(`Invoice ${invoiceNumber} generated for transaction ${transactionId}`);

    return invoice;
  } catch (error) {
    console.error("Error generating invoice:", error);
    apiLogger.error(
      `Failed to generate invoice for transaction ${transactionId}`,
      { transactionId, companyId },
      new Error(error)
    );
    return null;
  }
};

/**
 * Get invoice for a transaction
 * GET /api/transactions/:id/invoice
 */
const getTransactionInvoice = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    // Get transaction to verify ownership
    const transaction = await userTransactionModel.findOne({
      where: {
        transaction_id: id,
        user_id: userData.user_id,
      },
    });

    if (!transaction) {
      return errorResponseHelper(res, 404, "Transaction not found");
    }

    // Get invoice
    const invoice = await invoiceModel.findOne({
      where: { transaction_id: id },
    });

    if (!invoice) {
      // Try to generate invoice if it doesn't exist and transaction is completed
      const txData = transaction.dataValues;
      if (txData.status === "done" && txData.company_id) {
        const generatedInvoice = await autoGenerateInvoice(
          parseInt(id),
          txData.company_id
        );

        if (generatedInvoice) {
          return successResponseHelper(
            res,
            200,
            "Invoice generated successfully",
            generatedInvoice.dataValues
          );
        }
      }

      return errorResponseHelper(
        res,
        404,
        "Invoice not found. Invoices are generated for completed transactions."
      );
    }

    successResponseHelper(
      res,
      200,
      "Invoice retrieved successfully",
      invoice.dataValues
    );
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.user_id, email: userData.email, transaction_id: id },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get all invoices for a user/company
 * GET /api/invoices
 */
const getAllInvoices = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { company_id, page = 1, limit = 10 } = req.query;

  try {
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where clause
    const whereClause: any = {};

    // Get user's companies to filter invoices
    const companies = await companyModel.findAll({
      where: { user_id: userData.user_id },
      attributes: ["company_id"],
    });

    const companyIds = companies.map((c: any) => c.dataValues.company_id);

    if (company_id) {
      // Verify user owns this company
      if (!companyIds.includes(parseInt(company_id as string))) {
        return errorResponseHelper(res, 403, "Access denied to this company");
      }
      whereClause.company_id = parseInt(company_id as string);
    } else {
      whereClause.company_id = { $in: companyIds };
    }

    // Get invoices with pagination
    const { count, rows } = await invoiceModel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit as string),
      offset: offset,
      order: [["invoice_date", "DESC"]],
    });

    const invoices = rows.map((invoice: any) => invoice.dataValues);

    successResponseHelper(res, 200, "Invoices retrieved successfully", {
      invoices,
      pagination: {
        total: count,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get invoice by invoice ID
 * GET /api/invoices/:id
 */
const getInvoiceById = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    const invoice = await invoiceModel.findOne({
      where: { invoice_id: id },
    });

    if (!invoice) {
      return errorResponseHelper(res, 404, "Invoice not found");
    }

    const invoiceData = invoice.dataValues;

    // Verify user owns the company
    const company = await companyModel.findOne({
      where: {
        company_id: invoiceData.company_id,
        user_id: userData.user_id,
      },
    });

    if (!company) {
      return errorResponseHelper(res, 403, "Access denied");
    }

    successResponseHelper(
      res,
      200,
      "Invoice retrieved successfully",
      invoiceData
    );
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.user_id, email: userData.email, invoice_id: id },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

export default {
  getTransactionInvoice,
  getAllInvoices,
  getInvoiceById,
  autoGenerateInvoice,
};

// Named export for use in other controllers
export { autoGenerateInvoice };
