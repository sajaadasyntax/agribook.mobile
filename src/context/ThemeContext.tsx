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
  background: '#FDE8EA',
  surface: '#FFFFFF',
  primary: '#DD1C31',
  primaryLight: '#E85A6B',
  text: '#333333',
  textSecondary: '#666666',
  textInverse: '#FFFFFF',
  border: '#E0E0E0',
  cardBackground: '#FFFFFF',
  error: '#B71C1C',
  success: '#DD1C31',
  warning: '#FF9800',
  income: '#DD1C31',
  expense: '#B71C1C',
  shadow: '#000000',
  inputBackground: '#F5F5F5',
  disabled: '#F5A3AC',
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1E1E1E',
  primary: '#E85A6B',
  primaryLight: '#F5A3AC',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textInverse: '#121212',
  border: '#333333',
  cardBackground: '#1E1E1E',
  error: '#EF5350',
  success: '#E85A6B',
  warning: '#FFA726',
  income: '#E85A6B',
  expense: '#EF5350',
  shadow: '#000000',
  inputBackground: '#2C2C2C',
  disabled: '#424242',
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

