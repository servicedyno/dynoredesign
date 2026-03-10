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
    // Apply detected language AFTER hydration to prevent SSR mismatch
    applyDetectedLanguage().then(() => {
      updateHtmlLang(i18n.language);
    });

    // Keep <html lang> in sync on every future language change
    const onLangChanged = (lng: string) => updateHtmlLang(lng);
    i18n.on("languageChanged", onLangChanged);
    return () => { i18n.off("languageChanged", onLangChanged); };
  }, []);

  return null;
}
