import { useState, useEffect, useCallback } from 'react';
import { reportApi } from '../services/api.service';
import syncService from '../services/sync.service';
import { Transaction, DailyReport, WeeklyReport, MonthlyReport } from '../types';
import { formatDate, getStartOfWeek } from '../utils/date';

export type ReportPeriod = 'day' | 'week' | 'month';

export interface ChartData {
  labels: string[];
  incomeData: number[];
  expenseData: number[];
}

export interface CategoryChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

export interface ReportSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface UseReportDataResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  summary: ReportSummary;
  chartData: ChartData;
  categoryData: CategoryChartData[];
  transactions: Transaction[];
  refresh: () => Promise<void>;
}

const COLORS = ['#4CAF50', '#2196F3', '#FFC107', '#F44336', '#9C27B0', '#00BCD4', '#FF9800', '#795548'];

// Calculate nice Y-axis maximum (1.2x of highest value with padding, rounded to nice numbers)
export const calculateYAxisMax = (income: number, expense: number): number => {
  const maxValue = Math.max(income, expense);
  
  if (maxValue === 0) return 100;
  
  // Use 1.2x multiplier for better chart visibility without excessive padding
  const paddedMax = maxValue * 1.2;
  
  // Find the appropriate scale (10, 50, 100, 500, 1000, 5000, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(paddedMax)));
  const normalized = paddedMax / magnitude;
  
  let niceValue: number;
  if (normalized <= 1) niceValue = 1;
  else if (normalized <= 2) niceValue = 2;
  else if (normalized <= 5) niceValue = 5;
  else niceValue = 10;
  
  return niceValue * magnitude;
};

// Get week days starting from Saturday with locale support
const getWeekDays = (locale?: string): string[] => {
  if (locale === 'ar') {
    return ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  }
  return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
};

// Get week labels for monthly view with locale support
const getWeekLabels = (locale?: string): string[] => {
  if (locale === 'ar') {
    return ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'];
  }
  return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
};

// Get date for a specific day of week (0 = Saturday, 1 = Sunday, etc.)
// weekStart is already Saturday, so we just add dayIndex days
const getDateForWeekDay = (weekStart: Date, dayIndex: number): Date => {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + dayIndex);
  return date;
};

// Group transactions by week (1-4) for a month
// Uses a simple day-of-month based calculation:
// Week 1: Days 1-7, Week 2: Days 8-14, Week 3: Days 15-21, Week 4: Days 22-31
const groupByWeek = (transactions: Transaction[], year: number, month: number): number[][] => {
  const weeks: number[][] = [[0, 0], [0, 0], [0, 0], [0, 0]]; // [income, expense] for each week
  
  if (!transactions || transactions.length === 0) {
    return weeks;
  }
  
  transactions.forEach(t => {
    const transactionDate = new Date(t.createdAt);
    
    // Check if transaction is in the target month and year
    if (transactionDate.getFullYear() === year && transactionDate.getMonth() === month) {
      // Get day of month (1-31)
      const dayOfMonth = transactionDate.getDate();
      
      // Calculate week index based on day of month
      // Days 1-7 = Week 0, Days 8-14 = Week 1, Days 15-21 = Week 2, Days 22-31 = Week 3
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
      
      const amount = parseFloat(t.amount.toString());
      if (!isNaN(amount)) {
        if (t.type === 'INCOME') {
          weeks[weekIndex][0] += amount;
        } else if (t.type === 'EXPENSE') {
          weeks[weekIndex][1] += amount;
        }
      }
    }
  });
  
  return weeks;
};

export const useReportData = (period: ReportPeriod, date: Date, locale?: string): UseReportDataResult => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    summary: ReportSummary;
    chartData: ChartData;
    categoryData: CategoryChartData[];
    transactions: Transaction[];
  }>({
    summary: { income: 0, expense: 0, balance: 0 },
    chartData: { labels: [], incomeData: [], expenseData: [] },
    categoryData: [],
    transactions: [],
  });

  // Clear data and set loading when period or date changes
  useEffect(() => {
    setData({
      summary: { income: 0, expense: 0, balance: 0 },
      chartData: { labels: [], incomeData: [], expenseData: [] },
      categoryData: [],
      transactions: [],
    });
    setLoading(true);
  }, [period, date]);

  const processTransactionsForCategories = (transactions: Transaction[]): CategoryChartData[] => {
    const categories: Record<string, number> = {};
    
    transactions.forEach(t => {
      if (t.type === 'EXPENSE') {
        const catName = t.category?.name || 'Uncategorized';
        categories[catName] = (categories[catName] || 0) + parseFloat(t.amount.toString());
      }
    });

    return Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, amount], index) => ({
        name,
        population: amount,
        color: COLORS[index % COLORS.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      }));
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let summary = { income: 0, expense: 0, balance: 0 };
      let chartData: ChartData = { labels: [], incomeData: [], expenseData: [] };
      let transactions: Transaction[] = [];
      let categoryData: CategoryChartData[] = [];

      // Check network status for offline fallback
      const isOnline = await syncService.checkNetworkStatus();

      if (period === 'day') {
        const dateStr = formatDate(date);
        
        if (isOnline) {
          try {
            const report = await reportApi.getDaily(dateStr);
            
            summary = {
              income: report.income,
              expense: report.expense,
              balance: report.balance,
            };
            transactions = report.transactions;
            
            // Cache for offline
            await syncService.cacheTransactions(transactions);
          } catch (apiError) {
            console.warn('API failed, using cached transactions:', apiError);
            transactions = await getOfflineTransactionsForDay(dateStr);
            summary = calculateSummaryFromTransactions(transactions);
          }
        } else {
          // Use cached transactions for offline mode
          transactions = await getOfflineTransactionsForDay(dateStr);
          summary = calculateSummaryFromTransactions(transactions);
        }
        
        categoryData = processTransactionsForCategories(transactions);
        
        // Day view: both income and expense in the same column (day)
        chartData = {
          labels: [formatDate(date)],
          incomeData: [summary.income],
          expenseData: [summary.expense],
        };

      } else if (period === 'week') {
        const weekStart = getStartOfWeek(date);
        
        if (isOnline) {
          try {
            const report = await reportApi.getWeekly(formatDate(weekStart));

            summary = {
              income: report.totalIncome,
              expense: report.totalExpense,
              balance: report.balance,
            };
            transactions = report.transactions;
            
            // Cache for offline
            await syncService.cacheTransactions(transactions);
            
            // Week view: 7 days starting from Saturday (with locale support)
            const weekDays = getWeekDays(locale);
            const incomeData: number[] = [];
            const expenseData: number[] = [];
            
            weekDays.forEach((_, dayIndex) => {
              const dayDate = getDateForWeekDay(weekStart, dayIndex);
              const dayKey = formatDate(dayDate);
              const dayInfo = report.dailyData[dayKey] || { income: 0, expense: 0 };
              
              incomeData.push(dayInfo.income);
              expenseData.push(dayInfo.expense);
            });
            
            chartData = {
              labels: weekDays,
              incomeData,
              expenseData,
            };
          } catch (apiError) {
            console.warn('API failed, using cached transactions:', apiError);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            transactions = await getOfflineTransactionsForRange(weekStart, weekEnd);
            summary = calculateSummaryFromTransactions(transactions);
            chartData = calculateWeekChartFromTransactions(transactions, weekStart, locale);
          }
        } else {
          // Use cached transactions for offline mode
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          transactions = await getOfflineTransactionsForRange(weekStart, weekEnd);
          summary = calculateSummaryFromTransactions(transactions);
          chartData = calculateWeekChartFromTransactions(transactions, weekStart, locale);
        }
        
        categoryData = processTransactionsForCategories(transactions);

      } else if (period === 'month') {
        if (isOnline) {
          try {
            const report = await reportApi.getMonthly(date.getFullYear(), date.getMonth() + 1);

            summary = {
              income: report.totalIncome,
              expense: report.totalExpense,
              balance: report.balance,
            };
            transactions = report.transactions;
            
            // Cache for offline
            await syncService.cacheTransactions(transactions);

            // Month view: 4 weeks (with locale support)
            const weeks = groupByWeek(transactions, date.getFullYear(), date.getMonth());
            
            chartData = {
              labels: getWeekLabels(locale),
              incomeData: weeks.map(w => w[0]),
              expenseData: weeks.map(w => w[1]),
            };
          } catch (apiError) {
            console.warn('API failed, using cached transactions:', apiError);
            transactions = await getOfflineTransactionsForMonth(date.getFullYear(), date.getMonth());
            summary = calculateSummaryFromTransactions(transactions);
            const weeks = groupByWeek(transactions, date.getFullYear(), date.getMonth());
            chartData = {
              labels: getWeekLabels(locale),
              incomeData: weeks.map(w => w[0]),
              expenseData: weeks.map(w => w[1]),
            };
          }
        } else {
          // Use cached transactions for offline mode
          transactions = await getOfflineTransactionsForMonth(date.getFullYear(), date.getMonth());
          summary = calculateSummaryFromTransactions(transactions);
          const weeks = groupByWeek(transactions, date.getFullYear(), date.getMonth());
          chartData = {
            labels: getWeekLabels(locale),
            incomeData: weeks.map(w => w[0]),
            expenseData: weeks.map(w => w[1]),
          };
        }
        
        categoryData = processTransactionsForCategories(transactions);
      }

      setData({ summary, chartData, categoryData, transactions });
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data');
      
      // Try to show cached data even on error
      try {
        const cachedTransactions = await syncService.getCachedTransactions();
        const cachedSummary = await syncService.getCachedSummary();
        if (cachedTransactions.length > 0 || cachedSummary) {
          setData({
            summary: cachedSummary || { income: 0, expense: 0, balance: 0 },
            chartData: { labels: [], incomeData: [], expenseData: [] },
            categoryData: processTransactionsForCategories(cachedTransactions),
            transactions: cachedTransactions,
          });
        }
      } catch (cacheErr) {
        console.error('Error loading cached data:', cacheErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, date, locale]);

  // Helper function to get offline transactions for a specific day
  const getOfflineTransactionsForDay = async (dateStr: string): Promise<Transaction[]> => {
    const cachedTransactions = await syncService.getCachedTransactions();
    return cachedTransactions.filter(t => {
      const transactionDate = formatDate(new Date(t.createdAt));
      return transactionDate === dateStr;
    });
  };

  // Helper function to get offline transactions for a date range
  const getOfflineTransactionsForRange = async (startDate: Date, endDate: Date): Promise<Transaction[]> => {
    const cachedTransactions = await syncService.getCachedTransactions();
    return cachedTransactions.filter(t => {
      const transactionDate = new Date(t.createdAt);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  // Helper function to get offline transactions for a specific month
  const getOfflineTransactionsForMonth = async (year: number, month: number): Promise<Transaction[]> => {
    const cachedTransactions = await syncService.getCachedTransactions();
    return cachedTransactions.filter(t => {
      const transactionDate = new Date(t.createdAt);
      return transactionDate.getFullYear() === year && transactionDate.getMonth() === month;
    });
  };

  // Helper function to calculate summary from transactions
  const calculateSummaryFromTransactions = (transactions: Transaction[]): ReportSummary => {
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
      const amount = parseFloat(t.amount.toString());
      if (t.type === 'INCOME') {
        income += amount;
      } else if (t.type === 'EXPENSE') {
        expense += amount;
      }
    });
    
    return { income, expense, balance: income - expense };
  };

  // Helper function to calculate week chart data from transactions
  const calculateWeekChartFromTransactions = (
    transactions: Transaction[], 
    weekStart: Date, 
    locale?: string
  ): ChartData => {
    const weekDays = getWeekDays(locale);
    const incomeData: number[] = Array(7).fill(0);
    const expenseData: number[] = Array(7).fill(0);
    
    transactions.forEach(t => {
      const transactionDate = new Date(t.createdAt);
      const dayIndex = Math.floor((transactionDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      
      if (dayIndex >= 0 && dayIndex < 7) {
        const amount = parseFloat(t.amount.toString());
        if (t.type === 'INCOME') {
          incomeData[dayIndex] += amount;
        } else if (t.type === 'EXPENSE') {
          expenseData[dayIndex] += amount;
        }
      }
    });
    
    return { labels: weekDays, incomeData, expenseData };
  };

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { ...data, loading, refreshing, error, refresh: handleRefresh };
};
