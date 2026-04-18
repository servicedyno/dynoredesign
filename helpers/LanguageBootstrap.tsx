import { useEffect } from "react";
import i18n from "@/i18n";
import { applyDetectedLanguage } from "@/i18n";

function updateHtmlLang(lang: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export default function LanguageBootstrap() {
  useEffect(() => {
    // i18n is already initialised with the correct synchronous language
    // (localStorage / browser locale). We only need to:
    // 1. Run async geo-detection for first-time visitors (no manual choice)
    // 2. Keep <html lang> in sync on future changes
    applyDetectedLanguage().then(() => {
      updateHtmlLang(i18n.language);
    });

    const onLangChanged = (lng: string) => updateHtmlLang(lng);
    i18n.on("languageChanged", onLangChanged);
    return () => { i18n.off("languageChanged", onLangChanged); };
  }, []);

  return null;
}
