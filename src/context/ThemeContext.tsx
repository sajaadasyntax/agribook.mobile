import React, { createContext, useContext, ReactNode } from 'react';
import { useUser } from './UserContext';

interface ThemeColors {
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
  background: '#E8F5E9',
  surface: '#FFFFFF',
  primary: '#4CAF50',
  primaryLight: '#81C784',
  text: '#333333',
  textSecondary: '#666666',
  textInverse: '#FFFFFF',
  border: '#E0E0E0',
  cardBackground: '#FFFFFF',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
  income: '#4CAF50',
  expense: '#F44336',
  shadow: '#000000',
  inputBackground: '#F5F5F5',
  disabled: '#A5D6A7',
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1E1E1E',
  primary: '#66BB6A',
  primaryLight: '#81C784',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textInverse: '#121212',
  border: '#333333',
  cardBackground: '#1E1E1E',
  error: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726',
  income: '#66BB6A',
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

