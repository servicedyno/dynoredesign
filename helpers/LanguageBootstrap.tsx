import { useEffect } from "react";
import i18n from "@/i18n";

const SUPPORTED_LANGUAGES = ["en", "pt", "fr", "es"];

function updateHtmlLang(lang: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export default function LanguageBootstrap() {
  useEffect(() => {
    const saved = localStorage.getItem("lang");

    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      if (saved !== i18n.language) {
        i18n.changeLanguage(saved);
      }
      updateHtmlLang(saved);
    } else {
      // No saved preference — detect from browser locale
      const browserLang = navigator.language?.split("-")[0];
      if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) {
        i18n.changeLanguage(browserLang);
      }
      updateHtmlLang(i18n.language);
    }

    // Keep <html lang> in sync on every future language change
    const onLangChanged = (lng: string) => updateHtmlLang(lng);
    i18n.on("languageChanged", onLangChanged);
    return () => { i18n.off("languageChanged", onLangChanged); };
  }, []);

  return null;
}
