import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User, UserSettings } from '../types';
import { userApi, settingsApi } from '../services/api.service';

interface UserContextType {
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email?: string, name?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async (): Promise<void> => {
    try {
      const userId = await SecureStore.getItemAsync('userId');
      if (userId) {
        const userData = await userApi.getById(userId);
        // User response already includes settings from backend
        setUser(userData);
        setSettings(userData.settings || null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email?: string, name?: string, phone?: string): Promise<void> => {
    try {
      const result = await userApi.createOrGet(email, name, phone);
      await SecureStore.setItemAsync('userId', result.user.id);
      setUser(result.user);
      setSettings(result.settings);
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync('userId');
      setUser(null);
      setSettings(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateSettings = async (data: Partial<UserSettings>): Promise<void> => {
    try {
      const updated = await settingsApi.update(data as any);
      setSettings(updated);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (user) {
      try {
        const userData = await userApi.getById(user.id);
        // User response already includes settings from backend
        setUser(userData);
        setSettings(userData.settings || null);
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        settings,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateSettings,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

