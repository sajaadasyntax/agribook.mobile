import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18n } from 'i18n-js';
import { I18nManager, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { useUser } from './UserContext';
import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';

const i18n = new I18n({
  en: enTranslations,
  ar: arTranslations,
});

i18n.enableFallback = true;
// Arabic-first: Set Arabic as the default locale
i18n.defaultLocale = 'ar';
i18n.locale = 'ar';

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
  // Arabic-first: Default to Arabic language and RTL layout
  const [locale, setLocaleState] = useState<'en' | 'ar'>('ar');
  const [isRTL, setIsRTL] = useState(true);

  // Force RTL on initial app load for Arabic-first experience
  useEffect(() => {
    // Ensure RTL is properly set at startup
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  }, []);

  useEffect(() => {
    // Initialize locale from user settings, defaulting to Arabic
    try {
      // If user has explicitly set a language preference, use it; otherwise default to Arabic
      const userLocale = settings?.language as 'en' | 'ar';
      const initialLocale = userLocale || 'ar'; // Arabic-first: default to Arabic
      
      setLocaleState(initialLocale);
      setIsRTL(initialLocale === 'ar');
      i18n.locale = initialLocale;
      
      // Update RTL layout based on locale
      const shouldBeRTL = initialLocale === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      }
    } catch (error) {
      // Fallback to Arabic if there's any error (Arabic-first)
      console.error('Error initializing locale:', error);
      setLocaleState('ar');
      setIsRTL(true);
      i18n.locale = 'ar';
    }
  }, [settings]);

  const setLocale = async (newLocale: 'en' | 'ar'): Promise<void> => {
    try {
      const shouldBeRTL = newLocale === 'ar';
      const needsRestart = I18nManager.isRTL !== shouldBeRTL;
      
      setLocaleState(newLocale);
      setIsRTL(shouldBeRTL);
      i18n.locale = newLocale;
      
      // Update RTL layout when language changes
      if (needsRestart) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      }
      
      // Save to user settings
      if (updateSettings) {
        await updateSettings({ language: newLocale });
      }
      
      // Restart app if RTL direction changed (required for proper layout)
      if (needsRestart) {
        Alert.alert(
          newLocale === 'ar' ? 'تم تغيير اللغة' : 'Language Changed',
          newLocale === 'ar' 
            ? 'سيتم إعادة تشغيل التطبيق لتطبيق التغييرات'
            : 'The app will restart to apply changes',
          [
            {
              text: newLocale === 'ar' ? 'حسناً' : 'OK',
              onPress: async () => {
                try {
                  await Updates.reloadAsync();
                } catch (e) {
                  // Fallback for development mode
                  console.log('Please restart the app manually to apply language changes');
                }
              },
            },
          ],
          { cancelable: false }
        );
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

