/**
 * XRP/RLUSD Destination Tag Validator
 * Validates destination tags for tag-based cryptocurrency chains
 */

/**
 * Validate XRP/RLUSD destination tag
 * Valid range: 0 to 4,294,967,295 (32-bit unsigned integer)
 * 
 * @param destinationTag - The destination tag to validate
 * @param required - Whether the tag is required (default: false)
 * @returns Validation result with error message if invalid
 */
export interface DestinationTagValidationResult {
  valid: boolean;
  error?: string;
  normalizedTag?: number | null;
}

export const validateDestinationTag = (
  destinationTag: unknown,
  required: boolean = false
): DestinationTagValidationResult => {
  // If tag is null/undefined and not required, it's valid
  if (destinationTag === null || destinationTag === undefined) {
    if (required) {
      return {
        valid: false,
        error: 'Destination tag is required for this transaction'
      };
    }
    return { valid: true, normalizedTag: null };
  }
  
  // Convert to number
  const tag = Number(destinationTag);
  
  // Check if it's a valid number
  if (isNaN(tag)) {
    return {
      valid: false,
      error: `Invalid destination tag: "${destinationTag}" is not a number`
    };
  }
  
  // Check if it's an integer
  if (!Number.isInteger(tag)) {
    return {
      valid: false,
      error: `Invalid destination tag: ${tag} must be an integer (no decimals)`
    };
  }
  
  // Check range (32-bit unsigned integer: 0 to 4,294,967,295)
  const MIN_TAG = 0;
  const MAX_TAG = 4294967295; // 2^32 - 1
  
  if (tag < MIN_TAG || tag > MAX_TAG) {
    return {
      valid: false,
      error: `Invalid destination tag: ${tag} is out of range (must be ${MIN_TAG}-${MAX_TAG})`
    };
  }
  
  // All checks passed
  return {
    valid: true,
    normalizedTag: tag
  };
};

/**
 * Check if a chain requires destination tags
 * @param currency - Currency/chain identifier
 * @returns true if chain uses destination tags
 */
export const isTagBasedChain = (currency: string): boolean => {
  const tagBasedChains = ['XRP', 'RLUSD'];
  return tagBasedChains.includes(currency.toUpperCase());
};

/**
 * Validate and normalize destination tag for a given currency
 * Throws error if validation fails
 * 
 * @param currency - Currency identifier
 * @param destinationTag - Destination tag to validate
 * @param required - Whether tag is required
 * @returns Normalized tag (number or null)
 * @throws Error if validation fails
 */
export const validateAndNormalizeDestinationTag = (
  currency: string,
  destinationTag: unknown,
  required: boolean = false
): number | null => {
  // Only validate for tag-based chains
  if (!isTagBasedChain(currency)) {
    return null;
  }
  
  const validation = validateDestinationTag(destinationTag, required);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  return validation.normalizedTag ?? null;
};

/**
 * Format destination tag for display
 * @param tag - Destination tag
 * @returns Formatted string
 */
export const formatDestinationTag = (tag: number | null | undefined): string => {
  if (tag === null || tag === undefined) {
    return 'None';
  }
  return tag.toString();
};

export default {
  validateDestinationTag,
  isTagBasedChain,
  validateAndNormalizeDestinationTag,
  formatDestinationTag,
};
