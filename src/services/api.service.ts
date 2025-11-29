import apiClient from '../config/api';
import {
  User,
  UserSettings,
  Category,
  Transaction,
  CreateTransactionDto,
  FinancialSummary,
  Statistics,
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  Alert,
  CreateAlertDto,
  Reminder,
  CreateReminderDto,
  UpdateReminderDto,
  UpdateSettingsDto,
  VerifyPinDto,
  PaginatedResponse,
  CreateCategoryDto,
} from '../types';

// User API
export const userApi = {
  createOrGet: async (email?: string, name?: string, phone?: string, companyName?: string, logoUrl?: string): Promise<{ user: User; settings: UserSettings }> => {
    return apiClient.post('/users', { email, name, phone, companyName, logoUrl });
  },

  getById: async (id: string): Promise<User> => {
    return apiClient.get(`/users/${id}`);
  },

  update: async (data: { name?: string; phone?: string; companyName?: string; logoUrl?: string }, logoFileUri?: string | null): Promise<User> => {
    // If logoFileUri is provided, upload as file using FormData
    if (logoFileUri) {
      const formData = new FormData();
      
      // Add text fields
      if (data.name) formData.append('name', data.name);
      if (data.phone) formData.append('phone', data.phone);
      if (data.companyName) formData.append('companyName', data.companyName);
      
      // Add logo file
      const filename = logoFileUri.split('/').pop() || 'logo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('logo', {
        uri: logoFileUri,
        name: filename,
        type: type,
      } as any);
      
      return apiClient.putMultipart('/users', formData);
    }
    
    // Otherwise, send as JSON (backward compatible with base64 or for deletion)
    // If logoUrl is empty string, send null to delete
    const updateData = {
      ...data,
      logoUrl: data.logoUrl === '' ? null : data.logoUrl,
    };
    return apiClient.put('/users', updateData);
  },
};

// Category API
export const categoryApi = {
  getAll: async (type?: 'INCOME' | 'EXPENSE'): Promise<Category[]> => {
    return apiClient.get('/categories', type ? { type } : undefined);
  },

  getById: async (id: string): Promise<Category> => {
    return apiClient.get(`/categories/${id}`);
  },

  create: async (data: CreateCategoryDto): Promise<Category> => {
    return apiClient.post('/categories', data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiClient.delete(`/categories/${id}`);
  },
};

// Transaction API
export const transactionApi = {
  getAll: async (params?: {
    type?: 'INCOME' | 'EXPENSE';
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Transaction>> => {
    return apiClient.get('/transactions', params);
  },

  getById: async (id: string): Promise<Transaction> => {
    return apiClient.get(`/transactions/${id}`);
  },

  create: async (data: CreateTransactionDto): Promise<Transaction> => {
    return apiClient.post('/transactions', data);
  },

  update: async (id: string, data: Partial<CreateTransactionDto>): Promise<Transaction> => {
    return apiClient.put(`/transactions/${id}`, data);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiClient.delete(`/transactions/${id}`);
  },
};

// Report API
export const reportApi = {
  getSummary: async (startDate?: string, endDate?: string): Promise<FinancialSummary> => {
    return apiClient.get('/reports/summary', { startDate, endDate });
  },

  getDaily: async (date?: string): Promise<DailyReport> => {
    return apiClient.get('/reports/daily', date ? { date } : undefined);
  },

  getWeekly: async (weekStart?: string): Promise<WeeklyReport> => {
    return apiClient.get('/reports/weekly', weekStart ? { weekStart } : undefined);
  },

  getMonthly: async (year?: number, month?: number): Promise<MonthlyReport> => {
    return apiClient.get('/reports/monthly', { year, month });
  },

  getStatistics: async (startDate?: string, endDate?: string): Promise<Statistics> => {
    return apiClient.get('/reports/statistics', { startDate, endDate });
  },
};

// Alert API
export const alertApi = {
  getAll: async (isRead?: boolean, type?: 'WARNING' | 'ERROR' | 'INFO' | 'SUCCESS'): Promise<Alert[]> => {
    return apiClient.get('/alerts', { isRead, type });
  },

  getById: async (id: string): Promise<Alert> => {
    return apiClient.get(`/alerts/${id}`);
  },

  create: async (data: CreateAlertDto): Promise<Alert> => {
    return apiClient.post('/alerts', data);
  },

  markAsRead: async (id: string): Promise<Alert> => {
    return apiClient.patch(`/alerts/${id}/read`);
  },

  markAllAsRead: async (): Promise<{ message: string }> => {
    return apiClient.patch('/alerts/read-all');
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiClient.delete(`/alerts/${id}`);
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    try {
      const alerts = await apiClient.get('/alerts', { isRead: false });
      return { count: Array.isArray(alerts) ? alerts.length : 0 };
    } catch {
      return { count: 0 };
    }
  },
};

// Reminder API
export const reminderApi = {
  getAll: async (completed?: boolean, dueDate?: string): Promise<Reminder[]> => {
    return apiClient.get('/reminders', { completed, dueDate });
  },

  getById: async (id: string): Promise<Reminder> => {
    return apiClient.get(`/reminders/${id}`);
  },

  create: async (data: CreateReminderDto): Promise<Reminder> => {
    return apiClient.post('/reminders', data);
  },

  update: async (id: string, data: UpdateReminderDto): Promise<Reminder> => {
    return apiClient.put(`/reminders/${id}`, data);
  },

  toggle: async (id: string): Promise<Reminder> => {
    return apiClient.patch(`/reminders/${id}/toggle`);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiClient.delete(`/reminders/${id}`);
  },
};

// Settings API
export const settingsApi = {
  get: async (): Promise<UserSettings> => {
    return apiClient.get('/settings');
  },

  update: async (data: UpdateSettingsDto): Promise<UserSettings> => {
    return apiClient.put('/settings', data);
  },

  verifyPin: async (data: VerifyPinDto): Promise<{ valid: boolean }> => {
    return apiClient.post('/settings/verify-pin', data);
  },
};

