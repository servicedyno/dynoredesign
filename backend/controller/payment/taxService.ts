/**
 * Checkout tax calculation. Extracted verbatim from paymentController.ts
 * (no behavior change).
 */
import axios from "axios";
import { taxRateModel } from "../../models";
import { getErrorMessage } from "../../helper";
import { cronLogger } from "../../utils/loggers";
import {
  FALLBACK_TAX_RATES,
  TAX_TYPE_ACRONYMS as TAX_ACRONYMS,
  COUNTRY_NAMES,
} from "../../utils/taxData";
import { TAX_DATA_API_URL, TAX_DATA_API_KEY } from "./paymentConfig";

/**
 * Calculate tax for checkout based on customer location
 * Called internally by getData when apply_tax is enabled
 */
export const calculateTaxForCheckout = async (
  countryCode: string,
  amount: number,
  currency: string
): Promise<{
  tax_enabled: boolean;
  tax_rate: number;
  tax_acronym: string;
  tax_amount: number;
  country_code: string;
  country_name: string;
  subtotal: number;
  total: number;
  currency: string;
} | null> => {
  try {
    const upperCountryCode = countryCode.toUpperCase();

    let taxRate = 0;
    let taxAcronym = TAX_ACRONYMS[upperCountryCode] || 'Tax';
    let countryName = COUNTRY_NAMES[upperCountryCode] || countryCode;

    // Define type for cached rate
    interface CachedTaxRate {
      dataValues: {
        standard_rate?: string | number;
        tax_acronym?: string;
        country_name?: string;
      };
    }

    // Check database cache first
    const cachedRate = await taxRateModel.findOne({
      where: { country_code: upperCountryCode }
    }) as CachedTaxRate | null;

    if (cachedRate) {
      taxRate = parseFloat(String(cachedRate.dataValues.standard_rate)) || 0;
      taxAcronym = String(cachedRate.dataValues.tax_acronym || taxAcronym);
      countryName = String(cachedRate.dataValues.country_name || countryName);
      cronLogger.info(`[Tax] Using cached rate for ${upperCountryCode}: ${taxRate}%`);
    } else if (TAX_DATA_API_KEY) {
      // Try to fetch from API
      try {
        const response = await axios.get(`${TAX_DATA_API_URL}/tax_rates`, {
          headers: { apikey: TAX_DATA_API_KEY },
          params: { country: upperCountryCode },
          timeout: 5000
        });

        if (response.data && response.data.standard_rate !== undefined) {
          taxRate = response.data.standard_rate;
          cronLogger.info(`[Tax] Fetched rate from API for ${upperCountryCode}: ${taxRate}%`);

          // Cache the result
          await taxRateModel.create({
            country_code: upperCountryCode,
            country_name: countryName,
            tax_acronym: taxAcronym,
            standard_rate: taxRate,
          }).catch(() => {}); // Ignore cache errors
        }
      } catch (apiError: unknown) {
        cronLogger.info(`[Tax] API error for ${upperCountryCode}, using fallback:`, getErrorMessage(apiError));
        taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
      }
    } else {
      // No API key, use fallback
      taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
      cronLogger.info(`[Tax] Using fallback rate for ${upperCountryCode}: ${taxRate}%`);
    }

    // Calculate tax
    const taxAmount = (amount * taxRate) / 100;
    const total = amount + taxAmount;

    return {
      tax_enabled: true,
      tax_rate: taxRate,
      tax_acronym: taxAcronym,
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      country_code: upperCountryCode,
      country_name: countryName,
      subtotal: parseFloat(amount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      currency
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cronLogger.error(`[Tax] Error calculating tax:`, errorMessage);
    return null;
  }
};
