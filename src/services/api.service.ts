import apiClient, { tokenManager } from '../config/api';
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
  AuthResponse,
  AuthTokens,
} from '../types';
import { prepareImageForUpload } from '../utils/imageUtils';

// User API
export const userApi = {
  login: async (email?: string, phone?: string, password?: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/users/login', { email, phone, password });
    
    // Store tokens
    if (response.tokens) {
      await tokenManager.setTokens(
        response.tokens.accessToken,
        response.tokens.refreshToken,
        response.tokens.accessTokenExpiresAt
      );
      await tokenManager.setUserId(response.user.id);
    }
    
    return response;
  },

  register: async (
    email?: string, 
    name?: string, 
    phone?: string, 
    password?: string,
    companyName?: string, 
    logoFileUri?: string | null,
    onUploadProgress?: (progress: number) => void
  ): Promise<AuthResponse> => {
    // If logoFileUri is provided, upload as file using FormData
    if (logoFileUri) {
      const formData = new FormData();
      
      // Add text fields
      if (email) formData.append('email', email);
      if (name) formData.append('name', name);
      if (phone) formData.append('phone', phone);
      if (password) formData.append('password', password);
      if (companyName) formData.append('companyName', companyName);
      
      // Add logo file using proper URI parsing
      const imageFile = prepareImageForUpload(logoFileUri);
      formData.append('logo', imageFile as any);
      
      const response = await apiClient.postMultipart<AuthResponse>('/users/register', formData, onUploadProgress);
      
      // Store tokens
      if (response.tokens) {
        await tokenManager.setTokens(
          response.tokens.accessToken,
          response.tokens.refreshToken,
          response.tokens.accessTokenExpiresAt
        );
        await tokenManager.setUserId(response.user.id);
      }
      
      return response;
    }
    
    // Otherwise, send as JSON
    const response = await apiClient.post<AuthResponse>('/users/register', { email, name, phone, password, companyName });
    
    // Store tokens
    if (response.tokens) {
      await tokenManager.setTokens(
        response.tokens.accessToken,
        response.tokens.refreshToken,
        response.tokens.accessTokenExpiresAt
      );
      await tokenManager.setUserId(response.user.id);
    }
    
    return response;
  },

  // Legacy method for backward compatibility (deprecated)
  createOrGet: async (
    email?: string, 
    name?: string, 
    phone?: string, 
    companyName?: string, 
    logoFileUri?: string | null,
    onUploadProgress?: (progress: number) => void
  ): Promise<AuthResponse> => {
    // If logoFileUri is provided, upload as file using FormData
    if (logoFileUri) {
      const formData = new FormData();
      
      // Add text fields
      if (email) formData.append('email', email);
      if (name) formData.append('name', name);
      if (phone) formData.append('phone', phone);
      if (companyName) formData.append('companyName', companyName);
      
      // Add logo file using proper URI parsing
      const imageFile = prepareImageForUpload(logoFileUri);
      formData.append('logo', imageFile as any);
      
      const response = await apiClient.postMultipart<AuthResponse>('/users', formData, onUploadProgress);
      
      // Store tokens
      if (response.tokens) {
        await tokenManager.setTokens(
          response.tokens.accessToken,
          response.tokens.refreshToken,
          response.tokens.accessTokenExpiresAt
        );
        await tokenManager.setUserId(response.user.id);
      }
      
      return response;
    }
    
    // Otherwise, send as JSON (backward compatible)
    const response = await apiClient.post<AuthResponse>('/users', { email, name, phone, companyName });
    
    // Store tokens
    if (response.tokens) {
      await tokenManager.setTokens(
        response.tokens.accessToken,
        response.tokens.refreshToken,
        response.tokens.accessTokenExpiresAt
      );
      await tokenManager.setUserId(response.user.id);
    }
    
    return response;
  },

  getById: async (id: string): Promise<User> => {
    return apiClient.get(`/users/${id}`);
  },

  getCurrentUser: async (): Promise<User> => {
    return apiClient.get('/users/me');
  },

  update: async (
    data: { name?: string; phone?: string; companyName?: string; logoUrl?: string }, 
    logoFileUri?: string | null,
    onUploadProgress?: (progress: number) => void
  ): Promise<User> => {
    // If logoFileUri is provided, upload as file using FormData
    if (logoFileUri) {
      const formData = new FormData();
      
      // Add text fields
      if (data.name) formData.append('name', data.name);
      if (data.phone) formData.append('phone', data.phone);
      if (data.companyName) formData.append('companyName', data.companyName);
      
      // Add logo file using proper URI parsing
      const imageFile = prepareImageForUpload(logoFileUri);
      formData.append('logo', imageFile as any);
      
      return apiClient.putMultipart('/users', formData, onUploadProgress);
    }
    
    // Otherwise, send as JSON (backward compatible with base64 or for deletion)
    // If logoUrl is empty string, send null to delete
    const updateData = {
      ...data,
      logoUrl: data.logoUrl === '' ? null : data.logoUrl,
    };
    return apiClient.put('/users', updateData);
  },

  logout: async (refreshToken?: string): Promise<void> => {
    try {
      await apiClient.post('/users/logout', { refreshToken });
    } finally {
      await tokenManager.clearTokens();
    }
  },

  logoutAll: async (): Promise<void> => {
    try {
      await apiClient.post('/users/logout-all');
    } finally {
      await tokenManager.clearTokens();
    }
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; accessTokenExpiresAt: string }> => {
    const response = await apiClient.post<{ accessToken: string; accessTokenExpiresAt: string }>('/users/refresh-token', { refreshToken });
    
    // Update stored access token
    const currentRefreshToken = await tokenManager.getRefreshToken();
    if (currentRefreshToken) {
      await tokenManager.setTokens(response.accessToken, currentRefreshToken, response.accessTokenExpiresAt);
    }
    
    return response;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/users/change-password', { currentPassword, newPassword });
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
