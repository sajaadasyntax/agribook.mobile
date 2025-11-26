import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import { useUser } from './UserContext';
import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';

const i18n = new I18n({
  en: enTranslations,
  ar: arTranslations,
});

i18n.enableFallback = true;
i18n.defaultLocale = 'en';

interface I18nContextType {
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
  setLocale: (locale: 'en' | 'ar') => Promise<void>;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const { settings, updateSettings } = useUser();
  const [locale, setLocaleState] = useState<'en' | 'ar'>('en');
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    // Initialize locale from device or user settings
    try {
      const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
      const userLocale = (settings?.language as 'en' | 'ar') || deviceLocale;
      
      // Set locale to Arabic if user preference or device is Arabic
      const initialLocale = (userLocale === 'ar' || deviceLocale === 'ar') ? 'ar' : 'en';
      setLocaleState(initialLocale);
      setIsRTL(initialLocale === 'ar');
      i18n.locale = initialLocale;
    } catch (error) {
      // Fallback to English if there's any error
      console.error('Error initializing locale:', error);
      setLocaleState('en');
      setIsRTL(false);
      i18n.locale = 'en';
    }
  }, [settings]);

  const setLocale = async (newLocale: 'en' | 'ar'): Promise<void> => {
    try {
      setLocaleState(newLocale);
      setIsRTL(newLocale === 'ar');
      i18n.locale = newLocale;
      
      // Save to user settings
      if (updateSettings) {
        await updateSettings({ language: newLocale });
      }
    } catch (error) {
      console.error('Error updating locale:', error);
    }
  };

  const t = (key: string, options?: Record<string, unknown>): string => {
    return i18n.t(key, options);
  };

  return (
    <I18nContext.Provider
      value={{
        t,
        locale,
        setLocale,
        isRTL,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

