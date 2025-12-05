import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { User, UserSettings } from '../types';
import { userApi, settingsApi, transactionApi, alertApi, reminderApi, categoryApi } from '../services/api.service';
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
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
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
    try {
      const userId = await tokenManager.getUserId();
      const accessToken = await tokenManager.getAccessToken();
      
      if (userId && accessToken) {
        const isOnline = await syncService.checkNetworkStatus();
        setIsOffline(!isOnline);
        
        if (isOnline) {
          try {
            // Use the /me endpoint for authenticated user data
            const userData = await userApi.getCurrentUser();
            setUser(userData);
            setSettings(userData.settings || null);
            
            // Cache settings for offline use
            if (userData.settings) {
              await syncService.cacheUserSettings(userData.settings);
            }
          } catch (error) {
            console.error('Error fetching user from server:', error);
            // Try to load from cache
            const cachedSettings = await loadCachedSettings();
            if (cachedSettings) {
              setSettings(cachedSettings);
              setUser({ id: userId, createdAt: '', updatedAt: '', settings: cachedSettings });
            } else {
              // Token might be invalid, clear it
              await tokenManager.clearTokens();
            }
          }
        } else {
          // Offline - load from cache
          const cachedSettings = await loadCachedSettings();
          if (cachedSettings) {
            setSettings(cachedSettings);
            setUser({ id: userId, createdAt: '', updatedAt: '', settings: cachedSettings });
          }
        }
        
        await updatePendingCount();
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
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

  // Start auto sync when settings indicate autoSync is enabled
  useEffect(() => {
    if (settings?.autoSync && user) {
      syncService.startAutoSync(async () => {
        await syncData();
      });
    } else {
      syncService.stopAutoSync();
    }

    return () => {
      syncService.stopAutoSync();
    };
  }, [settings?.autoSync, user]);

  const login = async (email?: string, phone?: string, password?: string): Promise<void> => {
    try {
      const result = await userApi.login(email, phone, password);
      setUser(result.user);
      setSettings(result.settings);
      
      // Cache settings for offline use
      await syncService.cacheUserSettings(result.settings);
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
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
    try {
      const result = await userApi.register(email, name, phone, password, companyName, logoFileUri, onUploadProgress);
      setUser(result.user);
      setSettings(result.settings);
      
      // Cache settings for offline use
      await syncService.cacheUserSettings(result.settings);
    } catch (error) {
      console.error('Error registering:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const refreshToken = await tokenManager.getRefreshToken();
      await userApi.logout(refreshToken || undefined);
    } catch (error) {
      console.error('Error during logout API call:', error);
    } finally {
      // Always clear local state and tokens
      await tokenManager.clearTokens();
      await syncService.clearAll();
      setUser(null);
      setSettings(null);
      setPendingCount(0);
    }
  };

  const logoutAll = async (): Promise<void> => {
    try {
      await userApi.logoutAll();
    } catch (error) {
      console.error('Error during logout all API call:', error);
    } finally {
      // Always clear local state and tokens
      await tokenManager.clearTokens();
      await syncService.clearAll();
      setUser(null);
      setSettings(null);
      setPendingCount(0);
    }
  };

  const updateUser = (updatedUser: User): void => {
    setUser(updatedUser);
  };

  const updateSettings = async (data: Partial<UserSettings>): Promise<void> => {
    const isOnline = await syncService.checkNetworkStatus();
    
    if (isOnline) {
      try {
        const updated = await settingsApi.update(data as any);
        setSettings(updated);
        
        // Cache updated settings
        await syncService.cacheUserSettings(updated);
      } catch (error) {
        console.error('Error updating settings online:', error);
        throw error;
      }
    } else {
      if (!settings) {
        throw new Error('Settings are not available offline. Please reconnect and try again.');
      }

      const updatedSettings = { ...settings, ...data };
      setSettings(updatedSettings as UserSettings);
      
      await syncService.cacheUserSettings(updatedSettings);
      
      await syncService.addPendingOperation({
        id: `settings_${Date.now()}`,
        type: 'UPDATE_SETTINGS',
        data,
      });
      
      await updatePendingCount();
    }
  };

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!user) {
      return;
    }

    const isOnline = await syncService.checkNetworkStatus();
    setIsOffline(!isOnline);

    if (isOnline) {
      try {
        const userData = await userApi.getCurrentUser();
        setUser(userData);
        setSettings(userData.settings || null);

        // Cache settings for offline use
        if (userData.settings) {
          await syncService.cacheUserSettings(userData.settings);
        }
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }

    await updatePendingCount();
  }, [updatePendingCount, user]);

  const syncData = useCallback(async (): Promise<boolean> => {
    const isOnline = await syncService.checkNetworkStatus();
    
    if (!isOnline) {
      return false;
    }
    
    await syncService.setSyncing(true);
    let success = true;
    
    try {
      // Get pending operations
      const pendingOperations = await syncService.getPendingOperations();
      
      // Process each pending operation
      for (const operation of pendingOperations) {
        try {
          switch (operation.type) {
            case 'UPDATE_SETTINGS':
              await settingsApi.update(operation.data);
              break;
            case 'CREATE_TRANSACTION':
              await transactionApi.create(operation.data);
              break;
            case 'UPDATE_TRANSACTION':
              await transactionApi.update(operation.data.id, operation.data);
              break;
            case 'DELETE_TRANSACTION':
              await transactionApi.delete(operation.data.id);
              break;
            case 'CREATE_ALERT':
              await alertApi.create(operation.data);
              break;
            case 'UPDATE_ALERT':
              await alertApi.markAsRead(operation.data.id);
              break;
            case 'DELETE_ALERT':
              await alertApi.delete(operation.data.id);
              break;
            case 'CREATE_REMINDER':
              await reminderApi.create(operation.data);
              break;
            case 'UPDATE_REMINDER':
              await reminderApi.update(operation.data.id, operation.data);
              break;
            case 'DELETE_REMINDER':
              await reminderApi.delete(operation.data.id);
              break;
            case 'CREATE_CATEGORY':
              // Create category on server, then remove from local pending cache
              await categoryApi.create(operation.data);
              // Remove the temporary offline category from cache (it will be replaced by server version on next refresh)
              await syncService.removeCategoryFromCache(operation.id);
              break;
            case 'DELETE_CATEGORY':
              await categoryApi.delete(operation.data.id);
              break;
            default:
              console.warn(`Unknown operation type: ${operation.type}`);
          }
          await syncService.removePendingOperation(operation.id);
        } catch (error) {
          console.error(`Error syncing operation ${operation.id}:`, error);
          
          if (syncService.shouldRetry(operation)) {
            await syncService.updatePendingOperation(operation.id, {
              retryCount: operation.retryCount + 1,
              lastError: error instanceof Error ? error.message : 'Unknown error',
            });
          } else {
            // Max retries reached, remove the operation
            await syncService.removePendingOperation(operation.id);
          }
          success = false;
        }
      }
      
      // Update last sync time
      await syncService.updateLastSyncTime();
      
      // Refresh user data from server
      if (user) {
        try {
          const userData = await userApi.getCurrentUser();
          setUser(userData);
          setSettings(userData.settings || null);
          
          if (userData.settings) {
            await syncService.cacheUserSettings(userData.settings);
          }
        } catch (error) {
          console.error('Error refreshing user after sync:', error);
        }
      }
      
      await updatePendingCount();
      await syncService.setLastError(null);
    } catch (error) {
      console.error('Error syncing data:', error);
      await syncService.setLastError(error instanceof Error ? error.message : 'Sync failed');
      success = false;
    } finally {
      await syncService.setSyncing(false);
    }
    
    return success;
  }, [updatePendingCount, user]);

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
