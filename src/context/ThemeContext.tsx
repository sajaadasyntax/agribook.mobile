import React, { createContext, useContext, ReactNode } from 'react';
import { useUser } from './UserContext';

// Export ThemeColors for use in typed styles
export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  primaryLight: string;
  text: string;
  textSecondary: string;
  textInverse: string;
  border: string;
  cardBackground: string;
  error: string;
  success: string;
  warning: string;
  income: string;
  expense: string;
  shadow: string;
  inputBackground: string;
  disabled: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  background: '#F4F0E8',
  surface: '#FFFDF8',
  primary: '#B8871C',
  primaryLight: '#D4AF37',
  text: '#17130D',
  textSecondary: '#6F6758',
  textInverse: '#FFFFFF',
  border: '#DED4C1',
  cardBackground: '#FFFDF8',
  error: '#A53A2A',
  success: '#2F6B4F',
  warning: '#B8871C',
  income: '#2F6B4F',
  expense: '#A53A2A',
  shadow: '#000000',
  inputBackground: '#F0EADF',
  disabled: '#C8BFAE',
};

const darkColors: ThemeColors = {
  background: '#15130F',
  surface: '#211E18',
  primary: '#D4AF37',
  primaryLight: '#E4C765',
  text: '#FFF8E8',
  textSecondary: '#C6BDAA',
  textInverse: '#15130F',
  border: '#453D2D',
  cardBackground: '#211E18',
  error: '#E47B68',
  success: '#79B08D',
  warning: '#D4AF37',
  income: '#79B08D',
  expense: '#E47B68',
  shadow: '#000000',
  inputBackground: '#2C281F',
  disabled: '#514936',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { settings } = useUser();
  const isDark = settings?.darkMode || false;
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

