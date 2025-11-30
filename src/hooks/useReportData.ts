import { useState, useEffect, useCallback } from 'react';
import { reportApi } from '../services/api.service';
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

// Get week days starting from Saturday
const getWeekDays = (): string[] => {
  return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
};

// Get date for a specific day of week (0 = Saturday, 1 = Sunday, etc.)
// weekStart is already Saturday, so we just add dayIndex days
const getDateForWeekDay = (weekStart: Date, dayIndex: number): Date => {
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + dayIndex);
  return date;
};

// Group transactions by week (1-4) for a month
// Weeks are calculated based on actual calendar weeks (Saturday to Friday)
const groupByWeek = (transactions: Transaction[], year: number, month: number): number[][] => {
  const weeks: number[][] = [[0, 0], [0, 0], [0, 0], [0, 0]]; // [income, expense] for each week
  
  // Get the first day of the month
  const firstDayOfMonth = new Date(year, month, 1);
  // Find the Saturday that starts the week containing the first day of the month
  const firstDayWeekStart = getStartOfWeek(firstDayOfMonth);
  
  transactions.forEach(t => {
    const transactionDate = new Date(t.createdAt);
    // Check if transaction is in the target month and year
    if (transactionDate.getMonth() === month && transactionDate.getFullYear() === year) {
      // Calculate which week of the month this transaction belongs to
      // by finding the Saturday that starts its week
      const transactionWeekStart = getStartOfWeek(transactionDate);
      
      // Calculate the difference in days between transaction week start and month week start
      const daysDiff = Math.floor((transactionWeekStart.getTime() - firstDayWeekStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate week index (0-3) based on which week of the month it falls in
      // Each week is 7 days, so divide by 7 and clamp to 0-3
      const weekIndex = Math.min(Math.max(0, Math.floor(daysDiff / 7)), 3);
      
      const amount = parseFloat(t.amount.toString());
      if (t.type === 'INCOME') {
        weeks[weekIndex][0] += amount;
      } else {
        weeks[weekIndex][1] += amount;
      }
    }
  });
  
  return weeks;
};

export const useReportData = (period: ReportPeriod, date: Date): UseReportDataResult => {
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

      if (period === 'day') {
        const dateStr = formatDate(date);
        const report = await reportApi.getDaily(dateStr);
        
        summary = {
          income: report.income,
          expense: report.expense,
          balance: report.balance,
        };
        transactions = report.transactions;
        categoryData = processTransactionsForCategories(transactions);
        
        // Day view: both income and expense in the same column (day)
        chartData = {
          labels: [formatDate(date)],
          incomeData: [report.income],
          expenseData: [report.expense],
        };

      } else if (period === 'week') {
        const weekStart = getStartOfWeek(date);
        const report = await reportApi.getWeekly(formatDate(weekStart));

        summary = {
          income: report.totalIncome,
          expense: report.totalExpense,
          balance: report.balance,
        };
        transactions = report.transactions;
        categoryData = processTransactionsForCategories(transactions);

        // Week view: 7 days starting from Saturday
        const weekDays = getWeekDays();
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

      } else if (period === 'month') {
        const report = await reportApi.getMonthly(date.getFullYear(), date.getMonth() + 1);

        summary = {
          income: report.totalIncome,
          expense: report.totalExpense,
          balance: report.balance,
        };
        transactions = report.transactions;
        categoryData = processTransactionsForCategories(transactions);

        // Month view: 4 weeks
        const weeks = groupByWeek(transactions, date.getFullYear(), date.getMonth());
        
        chartData = {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          incomeData: weeks.map(w => w[0]),
          expenseData: weeks.map(w => w[1]),
        };
      }

      setData({ summary, chartData, categoryData, transactions });
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, date]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { ...data, loading, refreshing, error, refresh: handleRefresh };
};
