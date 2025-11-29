import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { BarChart } from 'react-native-charts-wrapper';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { useReportData, ReportPeriod, calculateYAxisMax } from '../src/hooks/useReportData';
import { formatDisplayDate, addDays, addWeeks, addMonths } from '../src/utils/date';
import { formatCurrency } from '../src/utils/currency';
import { Transaction } from '../src/types';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen(): React.JSX.Element {
  const { isAuthenticated } = useUser();
  const { t, isRTL, locale } = useI18n();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [date, setDate] = useState(new Date());
  
  const { 
    loading, 
    refreshing,
    error, 
    summary, 
    chartData, 
    categoryData, 
    transactions, 
    refresh 
  } = useReportData(period, date);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshRef.current();
      }
    }, [isAuthenticated])
  );

  const handlePrevious = () => {
    if (period === 'day') setDate(addDays(date, -1));
    else if (period === 'week') setDate(addWeeks(date, -1));
    else if (period === 'month') setDate(addMonths(date, -1));
  };

  const handleNext = () => {
    if (period === 'day') setDate(addDays(date, 1));
    else if (period === 'week') setDate(addWeeks(date, 1));
    else if (period === 'month') setDate(addMonths(date, 1));
  };

  // Transform chartData for react-native-charts-wrapper BarChart
  const transformBarChartData = () => {
    if (!chartData || !chartData.incomeData || !chartData.expenseData) {
      return null;
    }
    
    // Check that both arrays exist and have data, and they match in length
    if (chartData.incomeData.length === 0 && chartData.expenseData.length === 0) {
      return null;
    }
    
    if (chartData.incomeData.length !== chartData.expenseData.length) {
      return null;
    }
    
    const incomeValues = chartData.incomeData.map((value, index) => ({
      x: index,
      y: value || 0,
    }));
    
    const expenseValues = chartData.expenseData.map((value, index) => ({
      x: index,
      y: value || 0,
    }));
    
    // Calculate responsive bar width and spacing based on number of data points
    const dataPointCount = incomeValues.length;
    let barWidth: number;
    let groupSpace: number;
    let barSpace: number;
    
    if (dataPointCount === 2) {
      // Day view: two columns (Income, Expense) - larger bars with more spacing
      barWidth = 0.6;
      groupSpace = 0.2;
      barSpace = 0.15;
    } else if (dataPointCount <= 4) {
      // Few data points: larger bars with more spacing
      barWidth = 0.5;
      groupSpace = 0.15;
      barSpace = 0.1;
    } else if (dataPointCount <= 7) {
      // Medium data points (e.g., week view): balanced spacing
      barWidth = 0.4;
      groupSpace = 0.1;
      barSpace = 0.08;
    } else {
      // Many data points: tighter spacing
      barWidth = 0.35;
      groupSpace = 0.08;
      barSpace = 0.06;
    }
    
    return {
      dataSets: [
        {
          label: t('reports.income') || 'Income',
          values: incomeValues,
          config: {
            color: colors.income,
            barShadowColor: colors.income + '80',
            highlightAlpha: 90,
            highlightColor: colors.income + 'CC',
          },
        },
        {
          label: t('reports.expense') || 'Expense',
          values: expenseValues,
          config: {
            color: colors.expense,
            barShadowColor: colors.expense + '80',
            highlightAlpha: 90,
            highlightColor: colors.expense + 'CC',
          },
        },
      ],
      config: {
        barWidth,
        group: {
          fromX: 0,
          groupSpace,
          barSpace,
        },
      },
    };
  };

  // Transform categoryData for PieChart
  const transformPieChartData = () => {
    return categoryData.map(item => ({
      value: item.population,
      color: item.color,
      label: item.name,
    }));
  };

  // Calculate Y-axis maximum
  const yAxisMax = calculateYAxisMax(summary.income, summary.expense);

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector(colors)}>
      {(['day', 'week', 'month'] as ReportPeriod[]).map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.periodButton(colors), period === p && styles.periodButtonActive(colors)]}
          onPress={() => setPeriod(p)}
        >
          <Text style={[styles.periodButtonText(colors), period === p && styles.periodButtonTextActive]}>
            {p === 'day' ? (t('reports.daily') || 'Day') : 
             p === 'week' ? (t('reports.weekly') || 'Week') : 
             (t('reports.monthly') || 'Month')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDateNavigator = () => (
    <View style={[styles.dateNavigator, isRTL && styles.dateNavigatorRTL]}>
      <TouchableOpacity onPress={handlePrevious} style={styles.navButton(colors)}>
        <Icon name={isRTL ? "chevron-right" : "chevron-left"} size={28} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.dateText(colors)}>{formatDisplayDate(date, period)}</Text>
      <TouchableOpacity onPress={handleNext} style={styles.navButton(colors)}>
        <Icon name={isRTL ? "chevron-left" : "chevron-right"} size={28} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  const renderSummaryCards = () => (
    <View style={[styles.summaryContainer, isRTL && styles.summaryContainerRTL]}>
      <View style={styles.summaryCard(colors)}>
        <Text style={styles.summaryLabel(colors)}>{t('reports.income') || 'Income'}</Text>
        <Text style={[styles.summaryValue, { color: colors.income }]}>
          {formatCurrency(summary.income, { locale })}
        </Text>
      </View>
      <View style={styles.summaryCard(colors)}>
        <Text style={styles.summaryLabel(colors)}>{t('reports.expense') || 'Expense'}</Text>
        <Text style={[styles.summaryValue, { color: colors.expense }]}>
          {formatCurrency(summary.expense, { locale })}
        </Text>
      </View>
      <View style={styles.summaryCard(colors)}>
        <Text style={styles.summaryLabel(colors)}>{t('reports.balance') || 'Balance'}</Text>
        <Text style={[styles.summaryValue, { color: summary.balance < 0 ? colors.expense : colors.primary }]}>
          {formatCurrency(summary.balance, { locale })}
        </Text>
      </View>
    </View>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View style={[styles.transactionItem(colors), isRTL && styles.transactionItemRTL]}>
      <View style={styles.transactionLeft}>
        <View style={[
          styles.transactionIcon(colors), 
          { backgroundColor: item.type === 'INCOME' ? colors.income + '20' : colors.expense + '20' }
        ]}>
          <Icon 
            name={item.type === 'INCOME' ? 'arrow-downward' : 'arrow-upward'} 
            size={20} 
            color={item.type === 'INCOME' ? colors.income : colors.expense} 
          />
        </View>
        <View>
          <Text style={styles.transactionCategory(colors)}>{item.category?.name || 'Uncategorized'}</Text>
          <Text style={styles.transactionDate(colors)}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: item.type === 'INCOME' ? colors.income : colors.expense }
      ]}>
        {item.type === 'INCOME' ? '+' : '-'}{formatCurrency(parseFloat(item.amount.toString()), { locale })}
      </Text>
    </View>
  );

  // Show loading indicator
  const hasNoData = !chartData || chartData.incomeData.length === 0 && transactions.length === 0;
  if (loading && hasNoData) {
    return (
      <View style={[styles.container(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const barChartData = transformBarChartData();

  return (
    <ScrollView
      style={styles.container(colors)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={[styles.header(colors), isRTL && styles.headerRTL]}>
        <Text style={[styles.headerTitle(colors), isRTL && styles.headerTitleRTL]}>
          {t('reports.title')}
        </Text>
      </View>

      {renderPeriodSelector()}
      {renderDateNavigator()}
      {renderSummaryCards()}

      {/* Main Chart - Grouped Bar Chart */}
      <View style={styles.chartContainer(colors)}>
        <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
          {t('reports.overview') || 'Overview'}
        </Text>
        {barChartData ? (
          <BarChart
            style={styles.barChart}
            data={barChartData}
            xAxis={{
              valueFormatter: chartData.labels,
              granularity: 1,
              granularityEnabled: true,
              position: 'BOTTOM',
              textSize: 10,
              textColor: colors.textSecondary,
              axisLineColor: colors.border,
              gridColor: colors.border,
              avoidFirstLastClipping: true,
            }}
            yAxis={{
              left: {
                axisMinimum: 0,
                axisMaximum: yAxisMax,
                textSize: 10,
                textColor: colors.textSecondary,
                axisLineColor: colors.border,
                gridColor: colors.border + '40',
                valueFormatter: 'SDG #',
              },
              right: {
                enabled: false,
              },
            }}
            chartDescription={{ text: '' }}
            legend={{
              enabled: true,
              textSize: 12,
              form: 'SQUARE',
              formSize: 12,
              xEntrySpace: 10,
              yEntrySpace: 5,
              wordWrapEnabled: true, // Ensures legend text wraps properly to prevent overflow
            }}
            animation={{ durationX: 800, durationY: 800 }}
            drawValueAboveBar={true}
            highlightEnabled={true}
            dragEnabled={false}
            scaleEnabled={false}
            scaleXEnabled={false}
            scaleYEnabled={false}
            pinchZoom={false}
          />
        ) : (
          <View style={styles.chartEmptyContainer}>
            <Icon name="bar-chart" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText(colors)}>
              {t('reports.noChartData') || 'No chart data available for this period.'}
            </Text>
          </View>
        )}
      </View>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <View style={styles.chartContainer(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
            {t('reports.topExpenses') || 'Top Expenses'}
          </Text>
          <View style={styles.pieChartContainer}>
            <PieChart
              data={transformPieChartData()}
              radius={90}
              showText
              textColor={colors.text}
              textSize={12}
              focusOnPress
              showGradient
              donut
              innerRadius={60}
              innerCircleColor={colors.surface}
              centerLabelComponent={() => (
                <View style={styles.pieChartCenter}>
                  <Text style={styles.pieChartCenterText(colors)}>{t('reports.total') || 'Total'}</Text>
                  <Text style={styles.pieChartCenterValue(colors)}>
                    {formatCurrency(categoryData.reduce((sum, item) => sum + item.population, 0), { locale })}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section(colors)}>
        <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
          {t('reports.recentTransactions') || 'Recent Transactions'}
        </Text>
        {transactions.length > 0 ? (
          transactions.slice(0, 5).map(t => (
            <View key={t.id} style={{ marginBottom: 10 }}>
              {renderTransactionItem({ item: t })}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText(colors)}>
            {t('reports.noTransactions') || 'No transactions found for this period.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = {
  container: (colors: any) => ({
    flex: 1,
    backgroundColor: colors.background,
  }),
  centerContent: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  header: (colors: any) => ({
    backgroundColor: colors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  }),
  headerTitle: (colors: any) => ({
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text,
  }),
  headerTitleRTL: {
    textAlign: 'right' as const,
  },
  headerRTL: {
    alignItems: 'flex-end' as const,
  },
  periodSelector: (colors: any) => ({
    flexDirection: 'row' as const,
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  }),
  periodButton: (colors: any) => ({
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center' as const,
    borderRadius: 6,
  }),
  periodButtonActive: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  periodButtonText: (colors: any) => ({
    color: colors.textSecondary,
    fontWeight: '600' as const,
  }),
  periodButtonTextActive: {
    color: '#fff',
  },
  dateNavigator: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateNavigatorRTL: {
    flexDirection: 'row-reverse' as const,
  },
  navButton: (colors: any) => ({
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    elevation: 2,
  }),
  dateText: (colors: any) => ({
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  }),
  summaryContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  summaryContainerRTL: {
    flexDirection: 'row-reverse' as const,
  },
  summaryCard: (colors: any) => ({
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center' as const,
    backgroundColor: colors.surface,
    elevation: 2,
  }),
  summaryLabel: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  }),
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  chartContainer: (colors: any) => ({
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  }),
  section: (colors: any) => ({
    paddingHorizontal: 16,
    marginBottom: 20,
  }),
  sectionTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 12,
    color: colors.text,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  transactionItem: (colors: any) => ({
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  }),
  transactionItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
  transactionLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  transactionIcon: (colors: any) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }),
  transactionCategory: (colors: any) => ({
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text,
  }),
  transactionDate: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
  }),
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  emptyText: (colors: any) => ({
    textAlign: 'center' as const,
    color: colors.textSecondary,
    marginTop: 20,
  }),
  chartEmptyContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 40,
    minHeight: 240,
  },
  pieChartContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 20,
    width: '100%',
    maxWidth: screenWidth - 64, // Match chart container width calculation
  },
  pieChartCenter: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pieChartCenterText: (colors: any) => ({
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  }),
  pieChartCenterValue: (colors: any) => ({
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold' as const,
    marginTop: 4,
  }),
  barChart: {
    height: 240,
    width: screenWidth - 64, // Account for container margins (32px) and padding (32px)
    marginVertical: 12,
  },
};
