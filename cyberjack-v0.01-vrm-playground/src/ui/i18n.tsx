import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ru from '../../locales/ru.json';
import en from '../../locales/en.json';

type Locale = 'ru' | 'en';
type TranslationDict = typeof ru;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const translations: Record<Locale, TranslationDict> = { ru, en };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('cyberjack_locale');
    return (saved === 'en' ? 'en' : 'ru') as Locale;
  });

  useEffect(() => {
    localStorage.setItem('cyberjack_locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[locale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export function getLanguageDirective(locale: Locale): string {
  return locale === 'ru'
    ? 'Отвечай на русском языке.'
    : 'Respond in English.';
}
