import express from "express";
import axios from "axios";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { taxRateModel } from "../models";
import { taxLogger } from "../utils/loggers";

// Tax acronyms by country (from implementation tasks)
const TAX_ACRONYMS: Record<string, string> = {
  // European Union (All use VAT)
  AT: "VAT", BE: "VAT", BG: "VAT", CY: "VAT", CZ: "VAT", DE: "VAT", DK: "VAT",
  EE: "VAT", ES: "VAT", FI: "VAT", FR: "VAT", GR: "VAT", HR: "VAT", HU: "VAT",
  IE: "VAT", IT: "VAT", LT: "VAT", LU: "VAT", LV: "VAT", MT: "VAT", NL: "VAT",
  PL: "VAT", PT: "VAT", RO: "VAT", SE: "VAT", SI: "VAT", SK: "VAT",
  // Rest of World
  AD: "NRT", AE: "TRN", AF: "TIN", AG: "TIN", AL: "TIN", AM: "TIN", AO: "TIN",
  AR: "CUIT", AU: "ABN", AW: "TIN", AZ: "TIN", BA: "TIN", BB: "TIN", BD: "BIN",
  BF: "IFU", BH: "VAT", BJ: "IFU", BO: "TIN", BR: "CNPJ/CPF", BS: "TIN",
  BY: "TIN", CA: "BN", CH: "VAT", CL: "RUT", CN: "TIN", CO: "NIT", CR: "TIN",
  DO: "RCN", DZ: "TIN", EC: "RUC", EG: "TIN", GB: "VAT", GE: "VAT", GH: "TIN",
  GT: "VAT", HK: "BR", ID: "NPWP", IL: "VAT", IN: "GST", IS: "VAT", JP: "CN",
  KE: "PIN", KR: "BRN", KZ: "BIN", LI: "VAT", MA: "TIN", MC: "NIF", MD: "VAT",
  ME: "TIN", MK: "TIN", MU: "VAT", MX: "RFC", MY: "TIN", NG: "TIN", NO: "VAT",
  NZ: "GST", OM: "VAT", PA: "RUC", PE: "RUC", PH: "TIN", PK: "STRN", PY: "TIN",
  RS: "TIN", RU: "INN", SA: "VAT", SG: "UEN", TH: "VAT", TR: "TIN", TW: "VAT",
  UA: "VAT", US: "EIN", UY: "RUT", VE: "RIF", VN: "TIN", ZA: "VAT",
};

// Country names mapping
const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland",
  FR: "France", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland",
  IT: "Italy", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SI: "Slovenia", SK: "Slovakia", GB: "United Kingdom", US: "United States",
  CA: "Canada", AU: "Australia", NZ: "New Zealand", IN: "India", JP: "Japan",
  CN: "China", BR: "Brazil", MX: "Mexico", AR: "Argentina", CH: "Switzerland",
  NO: "Norway", SG: "Singapore", HK: "Hong Kong", KR: "South Korea", ZA: "South Africa",
  AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel", TR: "Turkey",
  RU: "Russia", UA: "Ukraine", TH: "Thailand", MY: "Malaysia", ID: "Indonesia",
  PH: "Philippines", VN: "Vietnam", NG: "Nigeria", EG: "Egypt", KE: "Kenya",
  GH: "Ghana", MA: "Morocco", PK: "Pakistan", BD: "Bangladesh", CL: "Chile",
  CO: "Colombia", PE: "Peru", VE: "Venezuela", EC: "Ecuador",
};

const TAX_DATA_API_URL = process.env.TAX_DATA_API_URL || "https://api.apilayer.com/tax_data";
const TAX_DATA_API_KEY = process.env.TAX_DATA_API_KEY;

// Fallback VAT rates for EU countries (standard rates as of 2024)
const FALLBACK_VAT_RATES: Record<string, number> = {
  AT: 20, BE: 21, BG: 20, CY: 19, CZ: 21, DE: 19, DK: 25, EE: 22, ES: 21,
  FI: 24, FR: 20, GR: 24, HR: 25, HU: 27, IE: 23, IT: 22, LT: 21, LU: 17,
  LV: 21, MT: 18, NL: 21, PL: 23, PT: 23, RO: 19, SE: 25, SI: 22, SK: 20,
  GB: 20, CH: 8.1, NO: 25, IS: 24, LI: 8.1, // Non-EU European
  US: 0, CA: 5, AU: 10, NZ: 15, JP: 10, SG: 9, IN: 18, // Other major countries
};

/**
 * Get VAT/Tax rate for a country (cache-first logic)
 * GET /api/tax/rate/:countryCode
 */
const getTaxRate = async (req: express.Request, res: express.Response) => {
  try {
    const { countryCode } = req.params;
    const upperCountryCode = countryCode.toUpperCase();

    // Validate country code
    if (!upperCountryCode || upperCountryCode.length !== 2) {
      return errorResponseHelper(res, 400, "Invalid country code. Must be 2-letter ISO code.");
    }

    // Step 1: Check cache (tbl_tax_rate)
    const cachedRate = await taxRateModel.findOne({
      where: { country_code: upperCountryCode },
    });

    if (cachedRate) {
      // Return cached data with consistent formatting
      return successResponseHelper(res, 200, "Tax rate retrieved from cache", {
        country_code: cachedRate.dataValues.country_code,
        country_name: cachedRate.dataValues.country_name,
        tax_acronym: cachedRate.dataValues.tax_acronym,
        standard_rate: parseFloat(cachedRate.dataValues.standard_rate),  // Ensure number format
        reduced_rates: cachedRate.dataValues.reduced_rates,
        cached: true,
      });
    }

    // Step 2: Try to fetch from APILayer
    let apiData: Record<string, unknown> | null = null;
    let apiSuccess = false;

    if (TAX_DATA_API_KEY) {
      try {
        const response = await axios.get(`${TAX_DATA_API_URL}/tax_rates`, {
          headers: {
            "apikey": TAX_DATA_API_KEY,
          },
          params: {
            country: upperCountryCode,
          },
          timeout: 10000,
        });

        if (response.data && !response.data.message) {
          apiData = response.data;
          apiSuccess = true;
        }
      } catch (apiError: unknown) {
        // Log API error but continue with fallback
        const err = apiError as { response?: { data?: { message?: string } }; message?: string };
        taxLogger.info(`Tax API error for ${upperCountryCode}:`, err.response?.data?.message || err.message);
      }
    }

    // Step 3: Use fallback data if API fails
    const taxAcronym = TAX_ACRONYMS[upperCountryCode] || "TAX";
    const countryName = COUNTRY_NAMES[upperCountryCode] || upperCountryCode;
    
    let standardRate: number = 0;
    let reducedRates: unknown = null;
    let source = "fallback";

    if (apiSuccess && apiData) {
      standardRate = Number(apiData.standard_rate || apiData.rate || 0);
      reducedRates = apiData.reduced_rates || null;
      source = "api";
    } else if (FALLBACK_VAT_RATES[upperCountryCode] !== undefined) {
      standardRate = FALLBACK_VAT_RATES[upperCountryCode];
      source = "fallback";
    }

    // Step 4: Save to cache
    const newTaxRate = await taxRateModel.create({
      country_code: upperCountryCode,
      country_name: countryName,
      tax_acronym: taxAcronym,
      standard_rate: standardRate,
      reduced_rates: reducedRates,
    });

    return successResponseHelper(res, 200, `Tax rate retrieved from ${source} and cached`, {
      country_code: newTaxRate.dataValues.country_code,
      country_name: newTaxRate.dataValues.country_name,
      tax_acronym: newTaxRate.dataValues.tax_acronym,
      standard_rate: parseFloat(newTaxRate.dataValues.standard_rate),  // Ensure number format
      reduced_rates: newTaxRate.dataValues.reduced_rates,
      cached: false,
      source,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

/**
 * Validate a Tax ID / VAT number
 * POST /api/tax/validate
 */
const validateTaxId = async (req: express.Request, res: express.Response) => {
  try {
    const { tax_id, country_code } = req.body;

    if (!tax_id || !country_code) {
      return errorResponseHelper(res, 400, "tax_id and country_code are required");
    }

    const upperCountryCode = country_code.toUpperCase();

    if (!TAX_DATA_API_KEY) {
      return errorResponseHelper(res, 500, "Tax Data API key not configured");
    }

    // Call APILayer to validate
    try {
      const response = await axios.get(`${TAX_DATA_API_URL}/validate`, {
        headers: {
          "apikey": TAX_DATA_API_KEY,
        },
        params: {
          vat_number: tax_id,
          country_code: upperCountryCode,
        },
        timeout: 10000,
      });

      const validationResult = response.data;

      return successResponseHelper(res, 200, "Tax ID validation completed", {
        tax_id,
        country_code: upperCountryCode,
        valid: validationResult.valid || false,
        company_name: validationResult.company_name || null,
        company_address: validationResult.company_address || null,
        format_valid: validationResult.format_valid || false,
        query_status: validationResult.query || "completed",
      });
    } catch (apiError: unknown) {
      const err = apiError as { response?: { data?: { message?: string }; status?: number }; message?: string };
      // Handle rate limiting gracefully
      if (err.response?.data?.message?.includes("exceeded")) {
        return successResponseHelper(res, 200, "Tax ID validation - API rate limit exceeded, please try again later", {
          tax_id,
          country_code: upperCountryCode,
          valid: null,
          format_valid: null,
          query_status: "rate_limited",
          note: "API rate limit exceeded. Validation could not be performed at this time.",
        });
      }

      // Handle specific API errors
      if (err.response?.status === 400) {
        return successResponseHelper(res, 200, "Tax ID validation completed", {
          tax_id,
          country_code: upperCountryCode,
          valid: false,
          format_valid: false,
          error: "Invalid tax ID format",
        });
      }

      if (err.response?.status === 401) {
        return errorResponseHelper(res, 500, "Tax Data API authentication failed");
      }

      throw apiError;
    }

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

/**
 * Get all tax acronyms by country
 * GET /api/tax/acronyms
 */
const getTaxAcronyms = async (_req: express.Request, res: express.Response) => {
  try {
    // Build response with country names
    const acronymsWithNames = Object.entries(TAX_ACRONYMS).map(([code, acronym]) => ({
      country_code: code,
      country_name: COUNTRY_NAMES[code] || code,
      tax_acronym: acronym,
    }));

    // Group by region
    const euCountries = ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", 
                        "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", 
                        "NL", "PL", "PT", "RO", "SE", "SI", "SK"];
    
    const grouped = {
      european_union: acronymsWithNames.filter(a => euCountries.includes(a.country_code)),
      rest_of_world: acronymsWithNames.filter(a => !euCountries.includes(a.country_code)),
    };

    return successResponseHelper(res, 200, "Tax acronyms retrieved", {
      total_countries: acronymsWithNames.length,
      acronyms: TAX_ACRONYMS,
      by_country: acronymsWithNames,
      grouped,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

/**
 * Get tax rate for a specific country by country name (lookup)
 * GET /api/tax/lookup?country=Portugal
 */
const lookupByCountryName = async (req: express.Request, res: express.Response) => {
  try {
    const { country } = req.query;

    if (!country || typeof country !== "string") {
      return errorResponseHelper(res, 400, "Country name is required");
    }

    // Find country code by name
    const countryLower = country.toLowerCase();
    const countryCode = Object.entries(COUNTRY_NAMES).find(
      ([_, name]) => name.toLowerCase() === countryLower
    )?.[0];

    if (!countryCode) {
      return errorResponseHelper(res, 404, `Country "${country}" not found. Use 2-letter ISO code instead.`);
    }

    // Redirect to getTaxRate logic
    req.params.countryCode = countryCode;
    return getTaxRate(req, res);

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

export default {
  getTaxRate,
  validateTaxId,
  getTaxAcronyms,
  lookupByCountryName,
};
