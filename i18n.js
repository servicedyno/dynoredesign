import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const isServer = typeof window === "undefined";
const SUPPORTED_LANGUAGES = ["en", "pt", "fr", "es", "de", "nl"];
const DEFAULT_LANGUAGE = "en";

// Timezone → language mapping for fallback detection
const TIMEZONE_TO_LANG = {
  "America/Sao_Paulo": "pt", "America/Fortaleza": "pt", "America/Recife": "pt",
  "America/Bahia": "pt", "America/Belem": "pt", "America/Manaus": "pt",
  "Europe/Lisbon": "pt",
  "Europe/Madrid": "es", "America/Mexico_City": "es", "America/Bogota": "es",
  "America/Lima": "es", "America/Santiago": "es", "America/Argentina/Buenos_Aires": "es",
  "America/Caracas": "es", "America/Guatemala": "es", "America/Guayaquil": "es",
  "Europe/Paris": "fr", "Africa/Dakar": "fr", "Africa/Abidjan": "fr",
  "Africa/Douala": "fr", "America/Port-au-Prince": "fr",
  "Europe/Berlin": "de", "Europe/Vienna": "de", "Europe/Zurich": "de",
  "Europe/Amsterdam": "nl", "Europe/Brussels": "nl",
};

/**
 * Detect language from browser locale and timezone (synchronous fallback)
 */
function detectFromBrowser() {
  try {
    // Try navigator.language first
    const browserLang = (navigator.language || "").split("-")[0];
    if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;

    // Try timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_LANG[tz]) return TIMEZONE_TO_LANG[tz];
  } catch {}
  return DEFAULT_LANGUAGE;
}

// Resolve initial language: saved preference > browser/timezone > default
function getInitialLanguage() {
  if (isServer) return DEFAULT_LANGUAGE;
  try {
    const saved = localStorage.getItem("lang");
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {}
  // No saved language — use browser/timezone detection as synchronous baseline
  return detectFromBrowser();
}

/**
 * Async IP-based geolocation detection (runs after init, upgrades language if no manual choice yet)
 * Uses backend proxy endpoint to avoid HTTPS→HTTP mixed-content browser blocks
 */
async function detectAndApplyGeoLocale() {
  if (isServer) return;
  try {
    // Only auto-detect if user never manually changed language
    const userChoseManually = localStorage.getItem("lang_manual") === "true";
    if (userChoseManually) return;

    // Call our backend endpoint which proxies to ip-api.com server-side
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const resp = await fetch(`${baseUrl}api/geo-detect`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status !== "success") return;

    // Import the mapping utility
    const { getLocaleFromCountry } = await import("./utils/geoLocale");
    const detectedLang = getLocaleFromCountry(data.countryCode);

    if (detectedLang && SUPPORTED_LANGUAGES.includes(detectedLang) && detectedLang !== i18n.language) {
      i18n.changeLanguage(detectedLang);
      localStorage.setItem("lang", detectedLang);
      console.log("[i18n] IP-based language detected →", detectedLang, `(${data.countryCode})`);
    }
  } catch (err) {
    // Silently ignore — sync detection already handled it
    console.log("[i18n] IP geo-detection skipped:", err?.message || err);
  }
}

const instance = i18n.use(LanguageDetector).use(initReactI18next);

instance.init({
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  debug: false,

  resources: {
    en: {
      common: require("./langs/locales/en/common.json"),
      auth: require("./langs/locales/en/auth.json"),
      dashboardLayout: require("./langs/locales/en/dashboardLayout.json"),
      profile: require("./langs/locales/en/profile.json"),
      notifications: require("./langs/locales/en/notifications.json"),
      apiScreen: require("./langs/locales/en/apiScreen.json"),
      walletScreen: require("./langs/locales/en/walletScreen.json"),
      companyDialog: require("./langs/locales/en/companyDialog.json"),
      companySettings: require("./langs/locales/en/companySettings.json"),
      transactions: require("./langs/locales/en/transactions.json"),
      createPaymentLinkScreen: require("./langs/locales/en/createPaymentLinkScreen.json"),
      paymentLinks: require("./langs/locales/en/paymentLinks.json"),
      helpAndSupport: require("./langs/locales/en/helpAndSupport.json"),
      landing: require("./langs/locales/en/landing.json"),
      fees: require("./langs/locales/en/fees.json"),
      apiStatus: require("./langs/locales/en/apiStatus.json"),
      termsConditions: require("./langs/locales/en/termsConditions.json"),
      privacyPolicy: require("./langs/locales/en/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/en/amlPolicy.json"),
      referrals: require("./langs/locales/en/referrals.json"),
    },
    pt: {
      common: require("./langs/locales/pt/common.json"),
      auth: require("./langs/locales/pt/auth.json"),
      dashboardLayout: require("./langs/locales/pt/dashboardLayout.json"),
      profile: require("./langs/locales/pt/profile.json"),
      notifications: require("./langs/locales/pt/notifications.json"),
      apiScreen: require("./langs/locales/pt/apiScreen.json"),
      walletScreen: require("./langs/locales/pt/walletScreen.json"),
      companyDialog: require("./langs/locales/pt/companyDialog.json"),
      companySettings: require("./langs/locales/pt/companySettings.json"),
      transactions: require("./langs/locales/pt/transactions.json"),
      createPaymentLinkScreen: require("./langs/locales/pt/createPaymentLinkScreen.json"),
      paymentLinks: require("./langs/locales/pt/paymentLinks.json"),
      helpAndSupport: require("./langs/locales/pt/helpAndSupport.json"),
      landing: require("./langs/locales/pt/landing.json"),
      fees: require("./langs/locales/pt/fees.json"),
      apiStatus: require("./langs/locales/pt/apiStatus.json"),
      termsConditions: require("./langs/locales/pt/termsConditions.json"),
      privacyPolicy: require("./langs/locales/pt/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/pt/amlPolicy.json"),
      referrals: require("./langs/locales/pt/referrals.json"),
    },
    fr: {
      common: require("./langs/locales/fr/common.json"),
      auth: require("./langs/locales/fr/auth.json"),
      dashboardLayout: require("./langs/locales/fr/dashboardLayout.json"),
      profile: require("./langs/locales/fr/profile.json"),
      notifications: require("./langs/locales/fr/notifications.json"),
      apiScreen: require("./langs/locales/fr/apiScreen.json"),
      walletScreen: require("./langs/locales/fr/walletScreen.json"),
      companyDialog: require("./langs/locales/fr/companyDialog.json"),
      companySettings: require("./langs/locales/fr/companySettings.json"),
      transactions: require("./langs/locales/fr/transactions.json"),
      createPaymentLinkScreen: require("./langs/locales/fr/createPaymentLinkScreen.json"),
      paymentLinks: require("./langs/locales/fr/paymentLinks.json"),
      helpAndSupport: require("./langs/locales/fr/helpAndSupport.json"),
      landing: require("./langs/locales/fr/landing.json"),
      fees: require("./langs/locales/fr/fees.json"),
      apiStatus: require("./langs/locales/fr/apiStatus.json"),
      termsConditions: require("./langs/locales/fr/termsConditions.json"),
      privacyPolicy: require("./langs/locales/fr/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/fr/amlPolicy.json"),
      referrals: require("./langs/locales/fr/referrals.json"),
    },
    es: {
      common: require("./langs/locales/es/common.json"),
      auth: require("./langs/locales/es/auth.json"),
      dashboardLayout: require("./langs/locales/es/dashboardLayout.json"),
      profile: require("./langs/locales/es/profile.json"),
      notifications: require("./langs/locales/es/notifications.json"),
      apiScreen: require("./langs/locales/es/apiScreen.json"),
      walletScreen: require("./langs/locales/es/walletScreen.json"),
      companyDialog: require("./langs/locales/es/companyDialog.json"),
      companySettings: require("./langs/locales/es/companySettings.json"),
      transactions: require("./langs/locales/es/transactions.json"),
      createPaymentLinkScreen: require("./langs/locales/es/createPaymentLinkScreen.json"),
      paymentLinks: require("./langs/locales/es/paymentLinks.json"),
      helpAndSupport: require("./langs/locales/es/helpAndSupport.json"),
      landing: require("./langs/locales/es/landing.json"),
      fees: require("./langs/locales/es/fees.json"),
      apiStatus: require("./langs/locales/es/apiStatus.json"),
      termsConditions: require("./langs/locales/es/termsConditions.json"),
      privacyPolicy: require("./langs/locales/es/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/es/amlPolicy.json"),
      referrals: require("./langs/locales/es/referrals.json"),
    },
    de: {
      common: require("./langs/locales/de/common.json"),
      auth: require("./langs/locales/de/auth.json"),
      dashboardLayout: require("./langs/locales/de/dashboardLayout.json"),
      profile: require("./langs/locales/de/profile.json"),
      notifications: require("./langs/locales/de/notifications.json"),
      apiScreen: require("./langs/locales/de/apiScreen.json"),
      walletScreen: require("./langs/locales/de/walletScreen.json"),
      companyDialog: require("./langs/locales/de/companyDialog.json"),
      companySettings: require("./langs/locales/de/companySettings.json"),
      transactions: require("./langs/locales/de/transactions.json"),
      createPaymentLinkScreen: require("./langs/locales/de/createPaymentLinkScreen.json"),
      paymentLinks: require("./langs/locales/de/paymentLinks.json"),
      helpAndSupport: require("./langs/locales/de/helpAndSupport.json"),
      landing: require("./langs/locales/de/landing.json"),
      fees: require("./langs/locales/de/fees.json"),
      apiStatus: require("./langs/locales/de/apiStatus.json"),
      termsConditions: require("./langs/locales/de/termsConditions.json"),
      amlPolicy: require("./langs/locales/de/amlPolicy.json"),
      privacyPolicy: require("./langs/locales/de/privacyPolicy.json"),
      referrals: require("./langs/locales/de/referrals.json"),
    },
    nl: {
      common: require("./langs/locales/nl/common.json"),
      auth: require("./langs/locales/nl/auth.json"),
      dashboardLayout: require("./langs/locales/nl/dashboardLayout.json"),
      profile: require("./langs/locales/nl/profile.json"),
      notifications: require("./langs/locales/nl/notifications.json"),
      apiScreen: require("./langs/locales/nl/apiScreen.json"),
      walletScreen: require("./langs/locales/nl/walletScreen.json"),
      companyDialog: require("./langs/locales/nl/companyDialog.json"),
      companySettings: require("./langs/locales/nl/companySettings.json"),
      transactions: require("./langs/locales/nl/transactions.json"),
      createPaymentLinkScreen: require("./langs/locales/nl/createPaymentLinkScreen.json"),
      paymentLinks: require("./langs/locales/nl/paymentLinks.json"),
      helpAndSupport: require("./langs/locales/nl/helpAndSupport.json"),
      landing: require("./langs/locales/nl/landing.json"),
      fees: require("./langs/locales/nl/fees.json"),
      apiStatus: require("./langs/locales/nl/apiStatus.json"),
      termsConditions: require("./langs/locales/nl/termsConditions.json"),
      amlPolicy: require("./langs/locales/nl/amlPolicy.json"),
      privacyPolicy: require("./langs/locales/nl/privacyPolicy.json"),
      referrals: require("./langs/locales/nl/referrals.json"),
    },
  },

  detection: {
    order: ["localStorage", "navigator"],
    lookupLocalStorage: "lang",
    caches: ["localStorage"],
    convertDetectedLanguage: (lng) => {
      const base = lng.split("-")[0];
      return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
    },
  },

  interpolation: {
    escapeValue: false,
  },

  react: {
    useSuspense: false, // safer for Next.js pages router
  },
});

// Persist language on every change & log
if (!isServer) {
  // Track whether this is the initial language set during init (before geo-detection)
  let _geoDetectionDone = false;

  i18n.on("languageChanged", (lng) => {
    console.log("[i18n] language changed →", lng);
    try {
      localStorage.setItem("lang", lng);
    } catch {}
  });

  // Run async IP-based detection after hydration
  // Check if user has a MANUALLY saved preference (not just the init default)
  const userChoseManually = (() => {
    try { return localStorage.getItem("lang_manual") === "true"; } catch { return false; }
  })();

  if (!userChoseManually) {
    // Always run geo-detection for users who haven't manually chosen a language
    // Delay slightly so app renders first, then upgrade language if IP says differently
    setTimeout(() => {
      detectAndApplyGeoLocale().finally(() => { _geoDetectionDone = true; });
    }, 500);
  }
}

export default i18n;
