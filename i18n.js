import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const isServer = typeof window === "undefined";
const SUPPORTED_LANGUAGES = ["en", "pt", "fr", "es"];
const DEFAULT_LANGUAGE = "en";

// Resolve initial language: saved preference > browser locale > default
function getInitialLanguage() {
  if (isServer) return DEFAULT_LANGUAGE;
  try {
    const saved = localStorage.getItem("lang");
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {}
  return DEFAULT_LANGUAGE;
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
      apiStatus: require("./langs/locales/en/apiStatus.json"),
      termsConditions: require("./langs/locales/en/termsConditions.json"),
      privacyPolicy: require("./langs/locales/en/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/en/amlPolicy.json"),
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
      apiStatus: require("./langs/locales/pt/apiStatus.json"),
      termsConditions: require("./langs/locales/pt/termsConditions.json"),
      privacyPolicy: require("./langs/locales/pt/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/pt/amlPolicy.json"),
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
      apiStatus: require("./langs/locales/fr/apiStatus.json"),
      termsConditions: require("./langs/locales/fr/termsConditions.json"),
      privacyPolicy: require("./langs/locales/fr/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/fr/amlPolicy.json"),
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
      apiStatus: require("./langs/locales/es/apiStatus.json"),
      termsConditions: require("./langs/locales/es/termsConditions.json"),
      privacyPolicy: require("./langs/locales/es/privacyPolicy.json"),
      amlPolicy: require("./langs/locales/es/amlPolicy.json"),
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
  i18n.on("languageChanged", (lng) => {
    console.log("[i18n] language changed →", lng);
    try {
      localStorage.setItem("lang", lng);
    } catch {}
  });
}

export default i18n;
