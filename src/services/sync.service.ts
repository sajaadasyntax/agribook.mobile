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
  PENDING_TRANSACTIONS: 'pending_transactions',
  LAST_SYNC_TIME: 'last_sync_time',
  BACKUP_DATA: 'backup_data',
};

export interface PendingTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  categoryId: string;
  description?: string;
  createdAt: string;
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

class SyncService {
  private isOnline: boolean = true;
  private listeners: ((isOnline: boolean) => void)[] = [];

  constructor() {
    this.initNetworkListener();
  }

  // Initialize network state listener
  private initNetworkListener(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      // Notify listeners of connectivity change
      if (wasOnline !== this.isOnline) {
        this.listeners.forEach(listener => listener(this.isOnline));
      }
    });
  }

  // Add connectivity change listener
  addConnectivityListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Check current network status
  async checkNetworkStatus(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  // Get current online status
  getIsOnline(): boolean {
    return this.isOnline;
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

  // ============ PENDING TRANSACTIONS (Offline Queue) ============

  // Add pending transaction (for offline mode)
  async addPendingTransaction(transaction: PendingTransaction): Promise<void> {
    try {
      const pending = await this.getPendingTransactions();
      pending.push(transaction);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_TRANSACTIONS,
        JSON.stringify(pending)
      );
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

  // Clear pending transactions after sync
  async clearPendingTransactions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_TRANSACTIONS);
    } catch (error) {
      console.error('Error clearing pending transactions:', error);
    }
  }

  // Get pending transactions count
  async getPendingCount(): Promise<number> {
    const pending = await this.getPendingTransactions();
    return pending.length;
  }

  // ============ SYNC METHODS ============

  // Update last sync time
  async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_SYNC_TIME,
        new Date().toISOString()
      );
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
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export const syncService = new SyncService();
export default syncService;

