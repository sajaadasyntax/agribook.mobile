import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { User, UserSettings } from '../types';
import { tokenManager } from '../config/api';
import syncService from '../services/sync.service';

interface UserContextType {
  user: User | null;
  settings: UserSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  pendingCount: number;
  login: (email?: string, phone?: string, password?: string) => Promise<void>;
  register: (email?: string, name?: string, phone?: string, password?: string, companyName?: string, logoFileUri?: string, onUploadProgress?: (progress: number) => void) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  syncData: () => Promise<boolean>;
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
  const localUser: User = {
    id: 'local-client',
    name: 'Local workspace',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const localSettings: UserSettings = {
    id: 'local-settings',
    userId: 'local-client',
    language: 'en',
    darkMode: false,
    autoBackup: false,
    offlineMode: true,
    autoSync: false,
    pushNotifications: false,
    emailNotifications: false,
    expenseThresholdAlert: false,
    pinEnabled: false,
    fingerprintEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const [user, setUser] = useState<User | null>(localUser);
  const [settings, setSettings] = useState<UserSettings | null>(localSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const userRef = useRef<User | null>(null);
  const syncDataRef = useRef<() => Promise<boolean>>(async () => false);

  // Load cached settings
  const loadCachedSettings = useCallback(async (): Promise<UserSettings | null> => {
    try {
      const cached = await syncService.getCachedUserSettings();
      return cached;
    } catch (error) {
      console.error('Error loading cached settings:', error);
      return null;
    }
  }, []);

  // Update pending count
  const updatePendingCount = useCallback(async (): Promise<void> => {
    const count = await syncService.getPendingCount();
    setPendingCount(count);
  }, []);

  // Load user data
  const loadUser = useCallback(async (): Promise<void> => {
    const cachedSettings = await loadCachedSettings();
    if (cachedSettings) setSettings({ ...localSettings, ...cachedSettings, offlineMode: true, autoSync: false });
    await syncService.cacheUserSettings(cachedSettings || localSettings);
    setIsOffline(true);
    setIsLoading(false);
  }, [loadCachedSettings, updatePendingCount]);

  // Initialize
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Listen to connectivity changes
  useEffect(() => {
    const unsubscribe = syncService.addConnectivityListener((online) => {
      setIsOffline(!online);
      
      if (online && userRef.current) {
        syncDataRef.current();
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to sync status changes
  useEffect(() => {
    const unsubscribe = syncService.addSyncStatusListener((status) => {
      setPendingCount(status.pendingCount);
      setIsOffline(!status.isOnline);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email?: string, phone?: string, password?: string): Promise<void> => {
    setUser({ ...localUser, name: phone || email || localUser.name, updatedAt: new Date().toISOString() });
    setSettings(localSettings);
    await syncService.cacheUserSettings(localSettings);
  };

  const register = async (
    email?: string, 
    name?: string, 
    phone?: string, 
    password?: string,
    companyName?: string, 
    logoFileUri?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<void> => {
    setUser({ ...localUser, name: name || companyName || localUser.name, companyName, updatedAt: new Date().toISOString() });
    setSettings(localSettings);
    await syncService.cacheUserSettings(localSettings);
  };

  const logout = async (): Promise<void> => {
    await tokenManager.clearTokens();
    setUser(null);
    setSettings(null);
    setPendingCount(0);
  };

  const logoutAll = async (): Promise<void> => {
    await logout();
  };

  const updateUser = (updatedUser: User): void => {
    setUser(updatedUser);
  };

  const updateSettings = async (data: Partial<UserSettings>): Promise<void> => {
    if (!settings) return;
    const updatedSettings = { ...settings, ...data, offlineMode: true, autoSync: false };
    setSettings(updatedSettings as UserSettings);
    await syncService.cacheUserSettings(updatedSettings);
  };

  const refreshUser = useCallback(async (): Promise<void> => {
    setIsOffline(true);
    await updatePendingCount();
  }, [updatePendingCount]);

  const syncData = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  useEffect(() => {
    syncDataRef.current = syncData;
  }, [syncData]);

  return (
    <UserContext.Provider
      value={{
        user,
        settings,
        isLoading,
        isAuthenticated: !!user,
        isOffline,
        pendingCount,
        login,
        register,
        logout,
        logoutAll,
        updateSettings,
        updateUser,
        refreshUser,
        syncData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
