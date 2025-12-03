// User Types
export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  settings?: UserSettings | null;
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResponse {
  user: User;
  settings: UserSettings;
  tokens: AuthTokens;
}

export interface LoginDto {
  email?: string;
  phone?: string;
  password?: string;
}

export interface RegisterDto {
  email?: string;
  name?: string;
  phone?: string;
  password?: string;
  companyName?: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  language: string;
  darkMode: boolean;
  autoBackup: boolean;
  offlineMode: boolean;
  autoSync: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  expenseThresholdAlert: boolean;
  expenseThreshold?: number | null;
  pinEnabled: boolean;
  fingerprintEnabled: boolean;
  pin?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Category Types
export type CategoryType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Transaction Types
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  description?: string | null;
  categoryId: string;
  userId: string;
  receiptUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  category: Category;
}

export interface CreateTransactionDto {
  type: TransactionType;
  amount: number;
  categoryId: string;
  description?: string;
  receiptUrl?: string;
}

// Report Types
export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  incomeCount: number;
  expenseCount: number;
}

export interface Statistics {
  totalTransactions: number;
  averageIncome: number;
  averageExpense: number;
  netProfit: number;
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
}

export interface DailyReport {
  date: string;
  transactions: Transaction[];
  income: number;
  expense: number;
  balance: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  dailyData: Record<string, { income: number; expense: number; transactions: Transaction[] }>;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactions: Transaction[];
}

export interface MonthlyReport {
  year: number;
  month: number;
  categoryData: Record<string, { income: number; expense: number; count: number }>;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  transactions: Transaction[];
}

// Alert Types
export type AlertType = 'WARNING' | 'ERROR' | 'INFO' | 'SUCCESS';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  userId: string;
  isRead: boolean;
  createdAt: string;
}

export interface CreateAlertDto {
  type: AlertType;
  message: string;
}

// Reminder Types - Real-world problem-solving types
export type ReminderType = 
  | 'TASK'           // Simple task/to-do reminder
  | 'PAYMENT_DUE'    // Reminder to pay a bill (rent, utilities, suppliers)
  | 'INCOME_DUE'     // Reminder to collect payment from customers
  | 'BUDGET_ALERT'   // Alert when category spending exceeds threshold
  | 'GENERAL'        // Legacy
  | 'TRANSACTION'    // Legacy  
  | 'THRESHOLD';     // Legacy

export type ReminderPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  dueTime?: string | null;
  completed: boolean;
  userId: string;
  reminderType: ReminderType;
  priority: ReminderPriority;
  
  // For payment/income reminders
  amount?: number | null;
  categoryId?: string | null;
  
  // For budget alerts
  thresholdAmount?: number | null;
  currentSpent?: number | null;
  
  // Recurrence
  recurrence: Recurrence;
  recurrenceEndDate?: string | null;
  lastTriggered?: string | null;
  
  // Notification settings
  notifyDaysBefore: number;
  snoozedUntil?: string | null;
  
  // Legacy fields
  transactionType?: TransactionType | null;
  transactionAmount?: number | null;
  
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderDto {
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  reminderType?: ReminderType;
  priority?: ReminderPriority;
  
  amount?: number;
  categoryId?: string;
  thresholdAmount?: number;
  
  recurrence?: Recurrence;
  recurrenceEndDate?: string;
  notifyDaysBefore?: number;
  
  // Legacy
  transactionType?: TransactionType;
  transactionAmount?: number;
}

export interface UpdateReminderDto {
  title?: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  completed?: boolean;
  reminderType?: ReminderType;
  priority?: ReminderPriority;
  
  amount?: number;
  categoryId?: string;
  thresholdAmount?: number;
  
  recurrence?: Recurrence;
  recurrenceEndDate?: string;
  notifyDaysBefore?: number;
  snoozedUntil?: string;
  
  // Legacy
  transactionType?: TransactionType;
  transactionAmount?: number;
}

// Category Management Types
export interface CreateCategoryDto {
  name: string;
  type: CategoryType;
  description?: string;
}

// Settings Types
export interface UpdateSettingsDto {
  language?: 'en' | 'ar';
  darkMode?: boolean;
  autoBackup?: boolean;
  offlineMode?: boolean;
  autoSync?: boolean;
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  expenseThresholdAlert?: boolean;
  expenseThreshold?: number;
  pinEnabled?: boolean;
  pin?: string;
  fingerprintEnabled?: boolean;
}

export interface VerifyPinDto {
  pin: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

