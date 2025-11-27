import { useState, useEffect, useCallback } from 'react';
import { reportApi } from '../services/api.service';
import { Transaction, DailyReport, WeeklyReport, MonthlyReport } from '../types';
import { formatDate, getStartOfWeek } from '../utils/date';

export type ReportPeriod = 'day' | 'week' | 'month';

export interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
  }[];
  // For stacked charts
  incomeData?: number[];
  expenseData?: number[];
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
    chartData: { labels: [], datasets: [{ data: [] }] },
    categoryData: [],
    transactions: [],
  });

  // Clear data and set loading when period or date changes to prevent stale data during loading
  useEffect(() => {
    setData({
      summary: { income: 0, expense: 0, balance: 0 },
      chartData: { labels: [], datasets: [{ data: [] }] },
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
      .slice(0, 5) // Top 5 categories
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
      let chartData: ChartData = { labels: [], datasets: [{ data: [] }] };
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
        
        // For day view, chart could be hourly if available, or just summary bars
        // Currently just showing Income vs Expense (for stacked chart compatibility)
        chartData = {
          labels: ['Income', 'Expense'],
          datasets: [{ data: [report.income, report.expense] }],
          incomeData: [report.income, 0],
          expenseData: [0, report.expense],
        };

      } else if (period === 'week') {
        const weekStart = formatDate(getStartOfWeek(date));
        const report = await reportApi.getWeekly(weekStart);

        summary = {
          income: report.totalIncome,
          expense: report.totalExpense,
          balance: report.balance,
        };
        transactions = report.transactions;
        categoryData = processTransactionsForCategories(transactions);

        // Weekly chart: Mon-Sun balance or Income/Expense
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dailyData = days.map((_, index) => {
          // This is an approximation as keys might be dates. 
          // A better way is to map over sorted keys of dailyData
          // But dailyData is Record<string, ...>
          // Let's trust the sorted keys for now or map days
          return 0; // Placeholder logic
        });
        
        // Correct way for weekly chart - prepare for stacked chart
        const sortedDates = Object.keys(report.dailyData).sort();
        chartData = {
          labels: sortedDates.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
          datasets: [{
            data: sortedDates.map(d => report.dailyData[d].income - report.dailyData[d].expense)
          }],
          incomeData: sortedDates.map(d => report.dailyData[d].income),
          expenseData: sortedDates.map(d => report.dailyData[d].expense),
        };

      } else if (period === 'month') {
        const report = await reportApi.getMonthly(date.getFullYear(), date.getMonth() + 1);

        summary = {
          income: report.totalIncome,
          expense: report.totalExpense,
          balance: report.balance,
        };
        transactions = report.transactions;
        
        // Category data is already provided in monthly report but in a different format
        // We can re-process transactions to match the format or use the one provided
        // Let's process transactions to be consistent
        categoryData = processTransactionsForCategories(transactions);

        // Monthly chart: Daily breakdown with income and expense for stacked chart
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const dailyIncome = new Array(daysInMonth).fill(0);
        const dailyExpense = new Array(daysInMonth).fill(0);
        
        // Filter transactions to only include those in the current month/year
        const currentMonth = date.getMonth();
        const currentYear = date.getFullYear();
        
        transactions.forEach(t => {
          const transactionDate = new Date(t.createdAt);
          // Validate that transaction belongs to the current month and year
          if (transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear) {
            const day = transactionDate.getDate();
            // Ensure day is within valid range (1 to daysInMonth)
            if (day >= 1 && day <= daysInMonth) {
              const amount = parseFloat(t.amount.toString());
              if (t.type === 'INCOME') {
                dailyIncome[day - 1] += amount;
              } else {
                dailyExpense[day - 1] += amount;
              }
            }
          }
        });

        // Show every 5th day label for cleaner chart
        chartData = {
          labels: Array.from({ length: daysInMonth }, (_, i) => (i + 1) % 5 === 0 ? (i + 1).toString() : ''),
          datasets: [{ data: dailyIncome.map((inc, i) => inc - dailyExpense[i]) }],
          incomeData: dailyIncome,
          expenseData: dailyExpense,
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

