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
  Alert,
  Platform,
  processColor,
  SafeAreaView,
} from 'react-native';
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
import { exportToPDF, exportToExcel } from '../src/utils/exportReport';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen(): React.JSX.Element {
  const { isAuthenticated, user } = useUser();
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
  } = useReportData(period, date, locale);

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
    
    // For monthly reports, ensure we have 4 weeks of data
    // If we don't have exactly 4, pad with zeros or truncate to ensure consistency
    let incomeData = [...chartData.incomeData];
    let expenseData = [...chartData.expenseData];
    
    if (period === 'month') {
      const expectedLength = 4;
      // Pad or truncate to ensure we always have 4 weeks
      while (incomeData.length < expectedLength) {
        incomeData.push(0);
        expenseData.push(0);
      }
      
      if (incomeData.length > expectedLength) {
        incomeData = incomeData.slice(0, expectedLength);
        expenseData = expenseData.slice(0, expectedLength);
      }
    }
    
    // Check that both arrays exist and have data, and they match in length
    if (incomeData.length === 0 && expenseData.length === 0) {
      return null;
    }
    
    if (incomeData.length !== expenseData.length) {
      return null;
    }
    
    // Reverse data arrays for RTL to match reading direction
    // Chart library renders left-to-right, but RTL users read right-to-left
    // Note: Labels will be reversed separately in xAxis valueFormatter
    if (isRTL) {
      incomeData = incomeData.reverse();
      expenseData = expenseData.reverse();
    }
    
    const incomeValues = incomeData.map((value, index) => ({
      x: index,
      y: value || 0,
    }));
    
    const expenseValues = expenseData.map((value, index) => ({
      x: index,
      y: value || 0,
    }));
    
    // Calculate responsive bar width and spacing based on number of data points
    // CRITICAL: For grouped bar charts, the formula must satisfy:
    // (barWidth * numberOfDataSets) + (barSpace * numberOfDataSets) + groupSpace = 1.0
    // We have 2 data sets (income & expense), so: barWidth*2 + barSpace*2 + groupSpace = 1.0
    const dataPointCount = incomeValues.length;
    let barWidth: number;
    let groupSpace: number;
    let barSpace: number;
    
    if (dataPointCount === 4) {
      // Month view: 4 weeks - larger bars to fit both income/expense clearly
      // Formula: 0.35*2 + 0.05*2 + 0.2 = 0.7 + 0.1 + 0.2 = 1.0 ✓
      barWidth = 0.35;
      groupSpace = 0.2;
      barSpace = 0.05;
    } else if (dataPointCount === 7) {
      // Week view: 7 days - balanced bars to fit both income/expense in each day column
      // Formula: 0.3*2 + 0.05*2 + 0.3 = 0.6 + 0.1 + 0.3 = 1.0 ✓
      barWidth = 0.3;
      groupSpace = 0.3;
      barSpace = 0.05;
    } else if (dataPointCount <= 4) {
      // Few data points: larger bars with more spacing
      // Formula: 0.35*2 + 0.05*2 + 0.2 = 0.7 + 0.1 + 0.2 = 1.0 ✓
      barWidth = 0.35;
      groupSpace = 0.2;
      barSpace = 0.05;
    } else {
      // Many data points: tighter spacing
      // Formula: 0.25*2 + 0.05*2 + 0.4 = 0.5 + 0.1 + 0.4 = 1.0 ✓
      barWidth = 0.25;
      groupSpace = 0.4;
      barSpace = 0.05;
    }
    
    // Use colors with fallbacks - ensure they're always defined
    const incomeColor = colors.income || '#4CAF50';
    const expenseColor = colors.expense || '#F44336';
    
    // Define shadow colors (lighter variants)
    const incomeShadow = '#66BB6A'; // Lighter green
    const expenseShadow = '#EF5350'; // Lighter red
    
    // For react-native-charts-wrapper, Android needs processColor, iOS can use strings
    const getChartColor = (color: string) => {
      if (Platform.OS === 'android') {
        try {
          return processColor(color);
        } catch (e) {
          console.warn('Failed to process color:', color, e);
          return color;
        }
      }
      return color;
    };
    
    return {
      dataSets: [
        {
          label: t('reports.income') || 'Income',
          values: incomeValues,
          config: {
            color: getChartColor(incomeColor) as any,
            barShadowColor: getChartColor(incomeShadow) as any,
            highlightAlpha: 90,
            highlightColor: getChartColor(incomeShadow) as any,
          },
        },
        {
          label: t('reports.expense') || 'Expense',
          values: expenseValues,
          config: {
            color: getChartColor(expenseColor) as any,
            barShadowColor: getChartColor(expenseShadow) as any,
            highlightAlpha: 90,
            highlightColor: getChartColor(expenseShadow) as any,
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
        highlightAlpha: 90,
      },
    };
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
        <Icon name={isRTL ? "keyboard-arrow-right" : "keyboard-arrow-left"} size={28} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.dateText(colors)}>{formatDisplayDate(date, period)}</Text>
      <TouchableOpacity onPress={handleNext} style={styles.navButton(colors)}>
        <Icon name={isRTL ? "keyboard-arrow-left" : "keyboard-arrow-right"} size={28} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  const handleExportPDF = async () => {
    try {
      // Validate data before exporting
      if (!summary || !chartData || !transactions) {
        Alert.alert(
          t('app.error') || 'Error',
          t('reports.noDataToExport') || 'No data available to export. Please wait for the report to load.'
        );
        return;
      }
      
      if (loading) {
        Alert.alert(
          t('app.error') || 'Error',
          t('reports.loadingData') || 'Please wait for the report to finish loading.'
        );
        return;
      }
      
      await exportToPDF({
        period,
        date,
        summary,
        chartData,
        transactions,
        locale,
        companyName: user?.companyName || user?.name || undefined,
      });
      Alert.alert(
        t('app.success') || 'Success',
        t('reports.exportSuccess') || 'Report exported to PDF successfully'
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      const errorMessage = error instanceof Error ? error.message : (t('reports.exportError') || 'Failed to export report to PDF');
      Alert.alert(
        t('app.error') || 'Error',
        errorMessage
      );
    }
  };

  const handleExportExcel = async () => {
    try {
      // Validate data before exporting
      if (!summary || !chartData || !transactions) {
        Alert.alert(
          t('app.error') || 'Error',
          t('reports.noDataToExport') || 'No data available to export. Please wait for the report to load.'
        );
        return;
      }
      
      if (loading) {
        Alert.alert(
          t('app.error') || 'Error',
          t('reports.loadingData') || 'Please wait for the report to finish loading.'
        );
        return;
      }
      
      await exportToExcel({
        period,
        date,
        summary,
        chartData,
        transactions,
        locale,
        companyName: user?.companyName || user?.name || undefined,
      });
      Alert.alert(
        t('app.success') || 'Success',
        t('reports.exportSuccess') || 'Report exported to CSV successfully'
      );
    } catch (error) {
      console.error('Error exporting CSV:', error);
      const errorMessage = error instanceof Error ? error.message : (t('reports.exportError') || 'Failed to export report to CSV');
      Alert.alert(
        t('app.error') || 'Error',
        errorMessage
      );
    }
  };

  const renderExportButtons = () => (
    <View style={[styles.exportContainer, isRTL && styles.exportContainerRTL]}>
      <TouchableOpacity
        style={[styles.exportButton(colors), { backgroundColor: colors.expense }]}
        onPress={handleExportPDF}
      >
        <Icon name="picture-as-pdf" size={20} color="#fff" />
        <Text style={styles.exportButtonText}>PDF</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.exportButton(colors), { backgroundColor: colors.income }]}
        onPress={handleExportExcel}
      >
        <Icon name="table-chart" size={20} color="#fff" />
        <Text style={styles.exportButtonText}>CSV</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSummaryCards = () => (
    <View style={[styles.summaryContainer, isRTL && styles.summaryContainerRTL]}>
      <View style={[styles.summaryCard(colors), { backgroundColor: colors.income + '20' }]}>
        <Text style={styles.summaryLabel(colors)}>{t('reports.income') || 'Income'}</Text>
        <Text style={[styles.summaryValue, { color: colors.income }]}>
          {formatCurrency(summary.income, { locale })}
        </Text>
      </View>
      <View style={[styles.summaryCard(colors), { backgroundColor: colors.expense + '20' }]}>
        <Text style={styles.summaryLabel(colors)}>{t('reports.expense') || 'Expense'}</Text>
        <Text style={[styles.summaryValue, { color: colors.expense }]}>
          {formatCurrency(summary.expense, { locale })}
        </Text>
      </View>
      <View style={[styles.summaryCard(colors), { backgroundColor: colors.primary + '20' }]}>
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
  const hasNoData = !chartData || (chartData.incomeData.length === 0 && transactions.length === 0);
  if (loading && hasNoData) {
    return (
      <SafeAreaView style={[styles.safeArea(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const barChartData = transformBarChartData();
  
  // Get labels for xAxis - reverse for RTL to match reversed data
  const chartLabels = isRTL && chartData?.labels ? [...chartData.labels].reverse() : (chartData?.labels || []);

  return (
    <SafeAreaView style={styles.safeArea(colors)}>
      <ScrollView
        style={styles.container(colors)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={[styles.header(colors), isRTL && styles.headerRTL]}>
          <Text style={styles.headerTitle(colors)}>
            {t('reports.title')}
          </Text>
        </View>

      {renderPeriodSelector()}
      {renderDateNavigator()}
      {renderExportButtons()}
      {renderSummaryCards()}

      {/* Main Chart - Grouped Bar Chart */}
      {period !== 'day' && (
        <View style={styles.chartContainer(colors)}>
          <Text style={styles.sectionTitle(colors)}>
            {t('reports.overview') || 'Overview'}
          </Text>
          {barChartData ? (
            <>
              <BarChart
                style={styles.barChart}
                data={barChartData}
                xAxis={{
                  valueFormatter: chartLabels,
                  granularity: 1,
                  granularityEnabled: true,
                  position: 'BOTTOM',
                  textSize: 10,
                  textColor: colors.textSecondary,
                  axisLineColor: colors.border,
                  gridColor: colors.border,
                  avoidFirstLastClipping: true,
                  centerAxisLabels: true, // Center labels under bar groups
                  axisMinimum: 0, // Start at 0 for proper alignment
                  axisMaximum: chartLabels.length, // End at number of groups
                  labelCount: chartLabels.length, // Ensure all labels are shown
                  drawGridLines: true, // Show grid lines for visual anchoring
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
                  enabled: false, // Disable built-in legend, using custom legend below
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
              {/* Custom centered legend */}
              <View style={styles.chartLegend}>
                <View style={[styles.legendItem, isRTL && styles.legendItemRTL]}>
                  <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                  <Text style={styles.legendText(colors)}>{t('reports.income') || 'Income'}</Text>
                </View>
                <View style={[styles.legendItem, isRTL && styles.legendItemRTL]}>
                  <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
                  <Text style={styles.legendText(colors)}>{t('reports.expense') || 'Expense'}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.chartEmptyContainer}>
              <Icon name="bar-chart" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText(colors)}>
                {t('reports.noChartData') || 'No chart data available for this period.'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section(colors)}>
        <Text style={styles.sectionTitle(colors)}>
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
    </SafeAreaView>
  );
}

const styles = {
  safeArea: (colors: any) => ({
    flex: 1,
    backgroundColor: colors.background,
  }),
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
    textAlign: 'left' as const,
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
  exportContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  exportContainerRTL: {
  },
  exportButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    elevation: 2,
  }),
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  summaryContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  summaryContainerRTL: {
  },
  summaryCard: (colors: any) => ({
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center' as const,
  }),
  summaryLabel: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center' as const,
  }),
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  chartContainer: (colors: any) => ({
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
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
    textAlign: 'left' as const,
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
    textAlign: 'left' as const,
  }),
  transactionCategoryRTL: {
    textAlign: 'right' as const,
  },
  transactionDate: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left' as const,
  }),
  transactionDateRTL: {
    textAlign: 'right' as const,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    textAlign: 'right' as const,
  },
  transactionAmountRTL: {
    textAlign: 'left' as const,
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
  barChart: {
    height: 240,
    width: screenWidth - 64, // Account for container margins (32px) and padding (32px)
    marginBottom: 8,
    alignSelf: 'center' as const,
  },
  chartLegend: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  legendItemRTL: {
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  }),
};
