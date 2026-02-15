import express from "express";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { IUserType } from "../utils/types";
import invoiceModel from "../models/invoiceModel";
import taxRateModel from "../models/taxRateModel";
import { userTransactionModel, companyModel, userModel } from "../models";
import { apiLogger } from "../utils/loggers";
import { generateInvoicePDF } from "../services/pdfService";
import { sendInvoiceGeneratedEmail } from "../services/emailService";
import { getFeeTiers, getTransactionFeePercent } from "../utils/feeConfigUtils";
import { getCompanyBaseCurrency, getCurrencySymbol, convertToFiat } from "../utils/currencyUtils";

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
): Promise<unknown> => {
  try {
    // Check if invoice already exists
    const existingInvoice = await invoiceModel.findOne({
      where: { transaction_id: transactionId },
    });

    if (existingInvoice) {
      apiLogger.info(`Invoice already exists for transaction ${transactionId}`);
      return existingInvoice;
    }

    // Get transaction details
    const transaction = await userTransactionModel.findOne({
      where: { transaction_id: transactionId },
    });

    if (!transaction) {
      apiLogger.error(`Transaction ${transactionId} not found`);
      return null;
    }

    const txData = transaction.dataValues;

    // Get company details for customer info
    const company = await companyModel.findOne({
      where: { company_id: companyId },
    });

    if (!company) {
      apiLogger.error(`Company ${companyId} not found`);
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

    // Calculate fees using centralized fee configuration
    const baseAmount = parseFloat(txData.base_amount || 0);
    const transactionFeePercent = getTransactionFeePercent();
    const feeTiers = getFeeTiers();

    // Find applicable fee tier based on amount
    const amount = baseAmount;
    let fixedFee = 0;

    for (const tier of feeTiers) {
      if (amount >= tier.min && (tier.max === null || amount <= tier.max)) {
        fixedFee = tier.fixed;
        break;
      }
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
        // Get VAT rate from tbl_tax_rate dynamically
        try {
          const taxRate = await taxRateModel.findOne({
            where: { country_code: companyData.country },
          });

          if (taxRate) {
            const taxData = taxRate.dataValues;
            vatRate = parseFloat(taxData.standard_rate || 0);
            apiLogger.info(`VAT rate for ${companyData.country}: ${vatRate}%`);
          } else {
            // Fallback to default rate if not in database
            vatRate = 23; // Default EU VAT rate
            apiLogger.info(`Using default VAT rate for ${companyData.country}: ${vatRate}%`);
          }
        } catch (error) {
          apiLogger.error("Error fetching VAT rate:", error);
          vatRate = 23; // Fallback
        }

        vatAmount = (baseAmount * vatRate) / 100;
      }
    }

    // Get company's preferred display currency
    const preferredCurrency = await getCompanyBaseCurrency(companyId);
    
    // Convert amounts to preferred currency if not USD
    let displayBaseAmount = baseAmount;
    let displayFixedFee = fixedFee;
    let displayVatAmount = vatAmount;
    
    if (preferredCurrency !== 'USD' && preferredCurrency !== (txData.base_currency || 'USD')) {
      try {
        const result = await convertToFiat('USD', preferredCurrency, 1);
        if (result.amount) {
          const rate = result.amount;
          displayBaseAmount = baseAmount * rate;
          displayFixedFee = fixedFee * rate;
          displayVatAmount = vatAmount * rate;
        }
      } catch (convErr) {
        apiLogger.warn(`[Invoice] Currency conversion to ${preferredCurrency} failed, using base amounts`);
      }
    }

    // Calculate totals in preferred currency
    const unitPrice = displayBaseAmount;
    const totalAmount = displayBaseAmount + displayFixedFee + displayVatAmount;

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
      vat_amount: displayVatAmount,
      fixed_fee: displayFixedFee,
      transaction_fee_percent: transactionFeePercent,
      blockchain_buffer_percent: 0,
      total_usd: totalAmount,
      total_crypto: totalAmount,
      crypto_currency: preferredCurrency,
      payment_terms: "Payment due upon receipt",
      invoice_date: new Date(),
    };

    const invoice = await invoiceModel.create(invoiceData);

    apiLogger.info(`Invoice ${invoiceNumber} generated for transaction ${transactionId}`);

    // Send invoice notification email
    try {
      const user = await userModel.findOne({
        where: { user_id: txData.user_id },
      });

      if (user) {
        const userData = user.dataValues;
        const invoiceUrl = `${process.env.SERVER_URL}/api/invoices/${invoice.dataValues.invoice_id}`;
        
        await sendInvoiceGeneratedEmail(userData.email, userData.name, {
          invoice_number: invoiceNumber,
          transaction_id: transactionId,
          total_usd: totalAmount,
          currency: preferredCurrency,
          invoice_date: new Date(),
          invoice_url: invoiceUrl,
        });

        apiLogger.info(`Invoice email sent to ${userData.email}`);
      }
    } catch (emailError) {
      apiLogger.error("Failed to send invoice email:", emailError);
      // Don't fail invoice generation if email fails
    }

    return invoice;
  } catch (error) {
    apiLogger.error("Error generating invoice:", error);
    apiLogger.error(
      `Failed to generate invoice for transaction ${transactionId}`,
      { transactionId, companyId },
      error instanceof Error ? error : new Error(String(error))
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
            (generatedInvoice as unknown as { dataValues: Record<string, unknown> }).dataValues
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

      handleControllerError(res, e, apiLogger);
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
    const whereClause: Record<string, unknown> = {};

    // Get user's companies to filter invoices
    const companies = await companyModel.findAll({
      where: { user_id: userData.user_id },
      attributes: ["company_id"],
    });

    const companyIds = companies.map((c: { dataValues: { company_id: number } }) => (c as unknown as { dataValues: { company_id: number } }).dataValues.company_id);

    // If user has no companies, return empty result
    if (companyIds.length === 0) {
      return successResponseHelper(res, 200, "Invoices retrieved successfully", {
        invoices: [],
        pagination: {
          total: 0,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: 0,
        },
      });
    }

    if (company_id) {
      // Verify user owns this company
      if (!companyIds.includes(parseInt(company_id as string))) {
        return errorResponseHelper(res, 403, "Access denied to this company");
      }
      whereClause.company_id = parseInt(company_id as string);
    } else {
      whereClause.company_id = { [Op.in]: companyIds };
    }

    // Get invoices with pagination
    const { count, rows } = await invoiceModel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit as string),
      offset: offset,
      order: [["invoice_date", "DESC"]],
    });

    const invoices = rows.map((invoice: { dataValues: Record<string, unknown> }) => (invoice as unknown as { dataValues: Record<string, unknown> }).dataValues);

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

      handleControllerError(res, e, apiLogger);
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

    // Sanitize response - hide internal fee breakdown details
    const sanitizedInvoice = {
      invoice_id: invoiceData.invoice_id,
      invoice_number: invoiceData.invoice_number,
      transaction_id: invoiceData.transaction_id,
      company_id: invoiceData.company_id,
      provider_name: invoiceData.provider_name,
      provider_address: invoiceData.provider_address,
      provider_tax_id: invoiceData.provider_tax_id,
      customer_name: invoiceData.customer_name,
      customer_address: invoiceData.customer_address,
      customer_tax_id: invoiceData.customer_tax_id,
      description: invoiceData.description,
      unit_price: invoiceData.unit_price,
      quantity: invoiceData.quantity,
      vat_rate: invoiceData.vat_rate,
      vat_amount: invoiceData.vat_amount,
      // Only show total processing fee, not breakdown
      processing_fee: parseFloat((invoiceData.fixed_fee || 0).toFixed(2)),
      total_usd: invoiceData.total_usd,
      total_crypto: invoiceData.total_crypto,
      crypto_currency: invoiceData.crypto_currency,
      payment_terms: invoiceData.payment_terms,
      invoice_date: invoiceData.invoice_date,
      status: invoiceData.status,
      createdAt: invoiceData.createdAt,
    };

    successResponseHelper(
      res,
      200,
      "Invoice retrieved successfully",
      sanitizedInvoice
    );
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * Download invoice as PDF
 * GET /api/invoices/:id/pdf
 */
const downloadInvoicePDF = async (
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

    // Generate PDF
    const pdfStream = generateInvoicePDF(invoiceData);

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoiceData.invoice_number}.pdf`
    );

    // Pipe PDF stream to response
    pdfStream.pipe(res);
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

export default {
  getTransactionInvoice,
  getAllInvoices,
  getInvoiceById,
  autoGenerateInvoice,
  downloadInvoicePDF,
};
