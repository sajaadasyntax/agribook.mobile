import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import syncService, { SyncStatus } from '../services/sync.service';

interface ConnectivityContextType {
  /** Whether the device has network connectivity */
  isOnline: boolean;
  /** Whether the user prefers offline mode (setting) */
  offlineModeEnabled: boolean;
  /** Effective offline status (offline OR offlineMode enabled) */
  isEffectivelyOffline: boolean;
  /** Whether a sync operation is in progress */
  isSyncing: boolean;
  /** Number of pending operations waiting to sync */
  pendingCount: number;
  /** Last sync timestamp */
  lastSyncTime: string | null;
  /** Last sync error if any */
  lastError: string | null;
  /** Check current network status */
  checkNetworkStatus: () => Promise<boolean>;
  /** Set offline mode preference */
  setOfflineModeEnabled: (enabled: boolean) => void;
  /** Force a sync check */
  refreshSyncStatus: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export const useConnectivity = (): ConnectivityContextType => {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within ConnectivityProvider');
  }
  return context;
};

interface ConnectivityProviderProps {
  children: ReactNode;
  /** Initial offline mode preference from settings */
  initialOfflineMode?: boolean;
}

export const ConnectivityProvider: React.FC<ConnectivityProviderProps> = ({ 
  children, 
  initialOfflineMode = false 
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(initialOfflineMode);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Calculate effective offline status
  const isEffectivelyOffline = !isOnline || offlineModeEnabled;

  // Handle sync status updates
  const handleSyncStatusUpdate = useCallback((status: SyncStatus) => {
    setIsOnline(status.isOnline);
    setIsSyncing(status.isSyncing);
    setPendingCount(status.pendingCount);
    setLastSyncTime(status.lastSyncTime);
    setLastError(status.lastError);
  }, []);

  // Initial setup
  useEffect(() => {
    // Check initial network status
    syncService.checkNetworkStatus().then(setIsOnline);
    
    // Load initial pending count
    syncService.getPendingCount().then(setPendingCount);
    
    // Load last sync time
    syncService.getLastSyncTime().then(setLastSyncTime);
  }, []);

  // Listen to connectivity changes
  useEffect(() => {
    const unsubscribeConnectivity = syncService.addConnectivityListener((online) => {
      setIsOnline(online);
    });

    return () => unsubscribeConnectivity();
  }, []);

  // Listen to sync status changes
  useEffect(() => {
    const unsubscribeSyncStatus = syncService.addSyncStatusListener(handleSyncStatusUpdate);
    return () => unsubscribeSyncStatus();
  }, [handleSyncStatusUpdate]);

  // Check network status
  const checkNetworkStatus = useCallback(async (): Promise<boolean> => {
    const online = await syncService.checkNetworkStatus();
    setIsOnline(online);
    return online;
  }, []);

  // Refresh sync status
  const refreshSyncStatus = useCallback(async (): Promise<void> => {
    const [online, count, syncTime] = await Promise.all([
      syncService.checkNetworkStatus(),
      syncService.getPendingCount(),
      syncService.getLastSyncTime(),
    ]);
    setIsOnline(online);
    setPendingCount(count);
    setLastSyncTime(syncTime);
  }, []);

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        offlineModeEnabled,
        isEffectivelyOffline,
        isSyncing,
        pendingCount,
        lastSyncTime,
        lastError,
        checkNetworkStatus,
        setOfflineModeEnabled,
        refreshSyncStatus,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};

export default ConnectivityContext;

