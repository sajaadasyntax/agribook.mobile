import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Transaction, FinancialSummary, Category, Alert as AppAlert, Reminder } from '../types';

// Storage keys
const STORAGE_KEYS = {
  CACHED_TRANSACTIONS: 'cached_transactions',
  CACHED_SUMMARY: 'cached_summary',
  CACHED_CATEGORIES: 'cached_categories',
  CACHED_ALERTS: 'cached_alerts',
  CACHED_REMINDERS: 'cached_reminders',
  CACHED_USER_SETTINGS: 'cached_user_settings',
  PENDING_TRANSACTIONS: 'pending_transactions',
  PENDING_OPERATIONS: 'pending_operations',
  LAST_SYNC_TIME: 'last_sync_time',
  BACKUP_DATA: 'backup_data',
  SYNC_QUEUE: 'sync_queue',
};

// Auto sync intervals
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RETRY_INTERVAL = 30 * 1000; // 30 seconds
const MAX_RETRIES = 3;

export interface PendingTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  categoryId: string;
  description?: string;
  createdAt: string;
  retryCount?: number;
}

export interface PendingOperation {
  id: string;
  type: 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION' | 
        'CREATE_ALERT' | 'UPDATE_ALERT' | 'DELETE_ALERT' |
        'CREATE_REMINDER' | 'UPDATE_REMINDER' | 'DELETE_REMINDER' |
        'CREATE_CATEGORY' | 'DELETE_CATEGORY' |
        'UPDATE_SETTINGS';
  data: any;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface CachedData {
  transactions: Transaction[];
  summary: FinancialSummary | null;
  categories: Category[];
  alerts: AppAlert[];
  reminders: Reminder[];
}

export interface BackupData {
  timestamp: string;
  transactions: Transaction[];
  categories: Category[];
  alerts: AppAlert[];
  reminders: Reminder[];
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

type ConnectivityListener = (isOnline: boolean) => void;
type SyncStatusListener = (status: SyncStatus) => void;

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastError: string | null;
}

class SyncService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private connectivityListeners: ConnectivityListener[] = [];
  private syncStatusListeners: SyncStatusListener[] = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private lastError: string | null = null;

  constructor() {
    this.initNetworkListener();
  }

  // Initialize network state listener
  private initNetworkListener(): void {
    NetInfo.addEventListener(async (state: NetInfoState) => {
      const wasOnline = this.isOnline;
      // Check both connection and internet reachability
      // isConnected checks if device is connected to network (WiFi/cellular)
      // isInternetReachable checks if that network actually has internet access
      this.isOnline = (state.isConnected ?? false) && (state.isInternetReachable ?? false);
      
      // Notify listeners of connectivity change
      if (wasOnline !== this.isOnline) {
        this.connectivityListeners.forEach(listener => listener(this.isOnline));
        await this.notifySyncStatus();
        
        // If we came back online, trigger sync
        if (this.isOnline && !wasOnline) {
          this.scheduleRetrySync();
        }
      }
    });
  }

  // ============ LISTENERS ============

  // Add connectivity change listener
  addConnectivityListener(listener: ConnectivityListener): () => void {
    this.connectivityListeners.push(listener);
    return () => {
      this.connectivityListeners = this.connectivityListeners.filter(l => l !== listener);
    };
  }

  // Add sync status listener
  addSyncStatusListener(listener: SyncStatusListener): () => void {
    this.syncStatusListeners.push(listener);
    // Immediately notify the new listener with current status
    this.notifySyncStatus().catch((error) => console.error('Failed to notify sync status', error));
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(l => l !== listener);
    };
  }

  // Notify all sync status listeners
  private async notifySyncStatus(): Promise<void> {
    const status: SyncStatus = {
      isOnline: this.isOnline,
      pendingCount: await this.getPendingCount(),
      isSyncing: this.isSyncing,
      lastSyncTime: await this.getLastSyncTime(),
      lastError: this.lastError,
    };
    this.syncStatusListeners.forEach(listener => listener(status));
  }

  // ============ AUTO SYNC ============

  // Start auto sync interval
  startAutoSync(syncCallback: () => Promise<void>): void {
    this.stopAutoSync();
    
    this.autoSyncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const pendingCount = await this.getPendingCount();
        if (pendingCount > 0) {
          await syncCallback();
        }
      }
    }, AUTO_SYNC_INTERVAL);
  }

  // Stop auto sync interval
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  // Schedule a retry sync after coming back online
  private scheduleRetrySync(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    
    this.retryTimeout = setTimeout(async () => {
      const pendingCount = await this.getPendingCount();
      if (pendingCount > 0 && this.isOnline) {
        // Emit event for sync needed
        await this.notifySyncStatus();
      }
    }, 2000); // 2 second delay after coming online
  }

  // Check current network status
  async checkNetworkStatus(): Promise<boolean> {
    const state = await NetInfo.fetch();
    // Check both connection and internet reachability
    // isConnected checks if device is connected to network (WiFi/cellular)
    // isInternetReachable checks if that network actually has internet access
    this.isOnline = (state.isConnected ?? false) && (state.isInternetReachable ?? false);
    return this.isOnline;
  }

  // Get current online status
  getIsOnline(): boolean {
    return this.isOnline;
  }

  // Get syncing status
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  // Set syncing status
  async setSyncing(syncing: boolean): Promise<void> {
    this.isSyncing = syncing;
    await this.notifySyncStatus();
  }

  // Set last error
  async setLastError(error: string | null): Promise<void> {
    this.lastError = error;
    await this.notifySyncStatus();
  }

  // ============ CACHING METHODS ============

  // Cache transactions
  async cacheTransactions(transactions: Transaction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_TRANSACTIONS,
        JSON.stringify(transactions)
      );
    } catch (error) {
      console.error('Error caching transactions:', error);
    }
  }

  // Get cached transactions
  async getCachedTransactions(): Promise<Transaction[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached transactions:', error);
      return [];
    }
  }

  // Get all transactions including pending (for offline display)
  // This combines cached transactions with pending transactions so they appear in reports/charts
  async getAllTransactionsIncludingPending(): Promise<Transaction[]> {
    try {
      const [cachedTransactions, pendingTransactions, cachedCategories] = await Promise.all([
        this.getCachedTransactions(),
        this.getPendingTransactions(),
        this.getCachedCategories(),
      ]);

      // Create a map of categories for quick lookup
      const categoryMap = new Map(cachedCategories.map(c => [c.id, c]));

      // Convert pending transactions to Transaction format for display
      const pendingAsTransactions: Transaction[] = pendingTransactions.map(pt => {
        const category = categoryMap.get(pt.categoryId);
        return {
          id: pt.id,
          type: pt.type,
          amount: pt.amount.toString(), // Convert number to string to match Transaction type
          categoryId: pt.categoryId,
          description: pt.description || null,
          createdAt: pt.createdAt,
          updatedAt: pt.createdAt,
          userId: 'pending', // Mark as pending
          receiptUrl: null,
          category: category || { id: pt.categoryId, name: 'Pending', type: pt.type, userId: 'pending', createdAt: pt.createdAt, updatedAt: pt.createdAt },
        } as Transaction;
      });

      // Combine and return all transactions
      return [...cachedTransactions, ...pendingAsTransactions];
    } catch (error) {
      console.error('Error getting all transactions including pending:', error);
      return [];
    }
  }

  // Calculate pending transactions summary (to adjust cached summary)
  async getPendingTransactionsSummary(): Promise<{ income: number; expense: number }> {
    try {
      const pendingTransactions = await this.getPendingTransactions();
      let income = 0;
      let expense = 0;

      pendingTransactions.forEach(t => {
        if (t.type === 'INCOME') {
          income += t.amount;
        } else if (t.type === 'EXPENSE') {
          expense += t.amount;
        }
      });

      return { income, expense };
    } catch (error) {
      console.error('Error calculating pending transactions summary:', error);
      return { income: 0, expense: 0 };
    }
  }

  // Cache financial summary
  async cacheSummary(summary: FinancialSummary): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_SUMMARY,
        JSON.stringify(summary)
      );
    } catch (error) {
      console.error('Error caching summary:', error);
    }
  }

  // Get cached summary
  async getCachedSummary(): Promise<FinancialSummary | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_SUMMARY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cached summary:', error);
      return null;
    }
  }

  // Cache categories
  async cacheCategories(categories: Category[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_CATEGORIES,
        JSON.stringify(categories)
      );
    } catch (error) {
      console.error('Error caching categories:', error);
    }
  }

  // Get cached categories
  async getCachedCategories(): Promise<Category[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_CATEGORIES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached categories:', error);
      return [];
    }
  }

  // Add a category to local cache (for offline-created categories)
  async addCategoryToCache(category: Category): Promise<void> {
    try {
      const categories = await this.getCachedCategories();
      // Check if category already exists
      if (!categories.find(c => c.id === category.id)) {
        categories.push(category);
        await this.cacheCategories(categories);
      }
    } catch (error) {
      console.error('Error adding category to cache:', error);
    }
  }

  // Remove a category from local cache
  async removeCategoryFromCache(categoryId: string): Promise<void> {
    try {
      const categories = await this.getCachedCategories();
      const filtered = categories.filter(c => c.id !== categoryId);
      await this.cacheCategories(filtered);
    } catch (error) {
      console.error('Error removing category from cache:', error);
    }
  }

  // Cache alerts
  async cacheAlerts(alerts: AppAlert[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_ALERTS,
        JSON.stringify(alerts)
      );
    } catch (error) {
      console.error('Error caching alerts:', error);
    }
  }

  // Get cached alerts
  async getCachedAlerts(): Promise<AppAlert[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_ALERTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached alerts:', error);
      return [];
    }
  }

  // Cache reminders
  async cacheReminders(reminders: Reminder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_REMINDERS,
        JSON.stringify(reminders)
      );
    } catch (error) {
      console.error('Error caching reminders:', error);
    }
  }

  // Get cached reminders
  async getCachedReminders(): Promise<Reminder[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_REMINDERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting cached reminders:', error);
      return [];
    }
  }

  // Cache user settings
  async cacheUserSettings(settings: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_USER_SETTINGS,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error('Error caching user settings:', error);
    }
  }

  // Get cached user settings
  async getCachedUserSettings(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_USER_SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cached user settings:', error);
      return null;
    }
  }

  // ============ PENDING TRANSACTIONS (Offline Queue) ============

  // Add pending transaction (for offline mode)
  async addPendingTransaction(transaction: PendingTransaction): Promise<void> {
    try {
      const pending = await this.getPendingTransactions();
      pending.push({
        ...transaction,
        retryCount: 0,
      });
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_TRANSACTIONS,
        JSON.stringify(pending)
      );
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error adding pending transaction:', error);
    }
  }

  // Get pending transactions
  async getPendingTransactions(): Promise<PendingTransaction[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting pending transactions:', error);
      return [];
    }
  }

  // Update pending transaction (for retry tracking)
  async updatePendingTransaction(id: string, updates: Partial<PendingTransaction>): Promise<void> {
    try {
      const pending = await this.getPendingTransactions();
      const index = pending.findIndex(t => t.id === id);
      if (index !== -1) {
        pending[index] = { ...pending[index], ...updates };
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_TRANSACTIONS,
          JSON.stringify(pending)
        );
      }
    } catch (error) {
      console.error('Error updating pending transaction:', error);
    }
  }

  // Remove specific pending transaction
  async removePendingTransaction(id: string): Promise<void> {
    try {
      const pending = await this.getPendingTransactions();
      const filtered = pending.filter(t => t.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_TRANSACTIONS,
        JSON.stringify(filtered)
      );
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error removing pending transaction:', error);
    }
  }

  // Clear pending transactions after sync
  async clearPendingTransactions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_TRANSACTIONS);
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error clearing pending transactions:', error);
    }
  }

  // Get pending transactions count
  async getPendingCount(): Promise<number> {
    const [pending, operations] = await Promise.all([
      this.getPendingTransactions(),
      this.getPendingOperations(),
    ]);
    return pending.length + operations.length;
  }

  // ============ PENDING OPERATIONS (Generic Queue) ============

  // Add pending operation
  async addPendingOperation(operation: Omit<PendingOperation, 'retryCount' | 'createdAt'>): Promise<void> {
    try {
      const operations = await this.getPendingOperations();
      operations.push({
        ...operation,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_OPERATIONS,
        JSON.stringify(operations)
      );
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error adding pending operation:', error);
    }
  }

  // Get pending operations
  async getPendingOperations(): Promise<PendingOperation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting pending operations:', error);
      return [];
    }
  }

  // Remove pending operation
  async removePendingOperation(id: string): Promise<void> {
    try {
      const operations = await this.getPendingOperations();
      const filtered = operations.filter(op => op.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_OPERATIONS,
        JSON.stringify(filtered)
      );
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error removing pending operation:', error);
    }
  }

  // Update pending operation
  async updatePendingOperation(id: string, updates: Partial<PendingOperation>): Promise<void> {
    try {
      const operations = await this.getPendingOperations();
      const index = operations.findIndex(op => op.id === id);
      if (index !== -1) {
        operations[index] = { ...operations[index], ...updates };
        await AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_OPERATIONS,
          JSON.stringify(operations)
        );
      }
    } catch (error) {
      console.error('Error updating pending operation:', error);
    }
  }

  // Clear all pending operations
  async clearPendingOperations(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_OPERATIONS);
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error clearing pending operations:', error);
    }
  }

  // Check if should retry operation
  shouldRetry(operation: PendingOperation): boolean {
    return operation.retryCount < MAX_RETRIES;
  }

  // ============ SYNC METHODS ============

  // Update last sync time
  async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_SYNC_TIME,
        new Date().toISOString()
      );
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error updating last sync time:', error);
    }
  }

  // Get last sync time
  async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  // ============ BACKUP METHODS ============

  // Create local backup
  async createBackup(data: Omit<BackupData, 'timestamp'>): Promise<void> {
    try {
      const backup: BackupData = {
        ...data,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.BACKUP_DATA,
        JSON.stringify(backup)
      );
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  // Get backup data
  async getBackup(): Promise<BackupData | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting backup:', error);
      return null;
    }
  }

  // Get backup timestamp
  async getBackupTime(): Promise<string | null> {
    const backup = await this.getBackup();
    return backup?.timestamp || null;
  }

  // Clear all cached data
  async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CACHED_TRANSACTIONS,
        STORAGE_KEYS.CACHED_SUMMARY,
        STORAGE_KEYS.CACHED_CATEGORIES,
        STORAGE_KEYS.CACHED_ALERTS,
        STORAGE_KEYS.CACHED_REMINDERS,
        STORAGE_KEYS.CACHED_USER_SETTINGS,
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Clear categories cache only
  async clearCategoriesCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_CATEGORIES);
    } catch (error) {
      console.error('Error clearing categories cache:', error);
    }
  }

  // Clear all data including pending items
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CACHED_TRANSACTIONS,
        STORAGE_KEYS.CACHED_SUMMARY,
        STORAGE_KEYS.CACHED_CATEGORIES,
        STORAGE_KEYS.CACHED_ALERTS,
        STORAGE_KEYS.CACHED_REMINDERS,
        STORAGE_KEYS.CACHED_USER_SETTINGS,
        STORAGE_KEYS.PENDING_TRANSACTIONS,
        STORAGE_KEYS.PENDING_OPERATIONS,
        STORAGE_KEYS.LAST_SYNC_TIME,
        STORAGE_KEYS.BACKUP_DATA,
      ]);
      await this.notifySyncStatus();
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  // Get all cached data
  async getAllCachedData(): Promise<CachedData> {
    const [transactions, summary, categories, alerts, reminders] = await Promise.all([
      this.getCachedTransactions(),
      this.getCachedSummary(),
      this.getCachedCategories(),
      this.getCachedAlerts(),
      this.getCachedReminders(),
    ]);
    return { transactions, summary, categories, alerts, reminders };
  }

  // Cache all data at once
  async cacheAllData(data: Partial<CachedData>): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (data.transactions) {
      promises.push(this.cacheTransactions(data.transactions));
    }
    if (data.summary) {
      promises.push(this.cacheSummary(data.summary));
    }
    if (data.categories) {
      promises.push(this.cacheCategories(data.categories));
    }
    if (data.alerts) {
      promises.push(this.cacheAlerts(data.alerts));
    }
    if (data.reminders) {
      promises.push(this.cacheReminders(data.reminders));
    }
    
    await Promise.all(promises);
  }
}

export const syncService = new SyncService();
export default syncService;
