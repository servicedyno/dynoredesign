import axios from 'axios';

interface GeoLocationResult {
  country_code: string;
  country_name: string;
  city?: string;
  region?: string;
  ip: string;
  source: 'ip-api' | 'cloudflare' | 'fallback';
}

// Country names mapping for fallback
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

/**
 * Extract client IP from request
 * Handles proxies, load balancers, Cloudflare, etc.
 */
export const getClientIP = (req: any): string => {
  // Priority order for IP detection
  const ip = 
    req.headers?.['cf-connecting-ip'] ||           // Cloudflare
    req.headers?.['x-real-ip'] ||                  // Nginx proxy
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||  // Standard proxy
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1';
  
  // Remove IPv6 prefix if present
  return ip.replace('::ffff:', '');
};

/**
 * Detect customer country from IP address
 * Uses free ip-api.com service (no API key required, 45 req/min limit)
 * Falls back to Cloudflare headers if available
 */
export const getCountryFromIP = async (ip: string, headers?: any): Promise<GeoLocationResult | null> => {
  try {
    // First, try Cloudflare header (most reliable if using CF)
    const cfCountry = headers?.['cf-ipcountry'];
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      console.log(`[Geolocation] Country from Cloudflare header: ${cfCountry}`);
      return {
        country_code: cfCountry,
        country_name: COUNTRY_NAMES[cfCountry] || cfCountry,
        ip,
        source: 'cloudflare'
      };
    }

    // Skip API call for localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      console.log('[Geolocation] Private/localhost IP detected, cannot determine country');
      return null;
    }

    // Use ip-api.com (free, no key required, 45 requests/minute)
    console.log(`[Geolocation] Fetching country for IP: ${ip}`);
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000,
      params: {
        fields: 'status,countryCode,country,city,regionName,message'
      }
    });

    if (response.data.status === 'success') {
      console.log(`[Geolocation] Detected country: ${response.data.country} (${response.data.countryCode})`);
      return {
        country_code: response.data.countryCode,
        country_name: response.data.country,
        city: response.data.city,
        region: response.data.regionName,
        ip,
        source: 'ip-api'
      };
    }

    console.log(`[Geolocation] ip-api.com failed: ${response.data.message}`);
    return null;
    
  } catch (error: any) {
    console.error('[Geolocation] Failed to detect country:', error.message);
    return null;
  }
};

/**
 * Get country from request (combines IP extraction and geolocation)
 */
export const getCountryFromRequest = async (req: any): Promise<GeoLocationResult | null> => {
  const ip = getClientIP(req);
  return getCountryFromIP(ip, req.headers);
};

export default {
  getClientIP,
  getCountryFromIP,
  getCountryFromRequest,
};
