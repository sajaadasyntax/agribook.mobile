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
import { useReportData, ReportPeriod } from '../src/hooks/useReportData';
import { formatDisplayDate, addDays, addWeeks, addMonths } from '../src/utils/date';
import { Transaction } from '../src/types';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen(): React.JSX.Element {
  const { isAuthenticated } = useUser();
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

  // Use a ref to store the refresh function to avoid stale closure
  // while preventing double fetches when period/date changes
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      // Refresh when screen comes into focus
      // Use ref to get latest refresh function without including it in dependencies
      // to prevent re-running when period/date changes
      if (isAuthenticated) {
        refreshRef.current();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Transform chartData for react-native-charts-wrapper BarChart (grouped bars)
  const transformBarChartData = () => {
    if (!chartData.datasets[0]?.data.length || !chartData.incomeData || !chartData.expenseData) {
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
    
    return {
      dataSets: [
        {
          label: 'Income',
          values: incomeValues,
          config: {
            color: '#4CAF50',
            barShadowColor: '#66BB6A',
            highlightAlpha: 90,
            highlightColor: '#66BB6A',
          },
        },
        {
          label: 'Expense',
          values: expenseValues,
          config: {
            color: '#F44336',
            barShadowColor: '#EF5350',
            highlightAlpha: 90,
            highlightColor: '#EF5350',
          },
        },
      ],
      config: {
        barWidth: 0.4,
        group: {
          fromX: 0,
          groupSpace: 0.1,
          barSpace: 0.1,
        },
      },
    };
  };

  // Transform categoryData for react-native-gifted-charts PieChart
  const transformPieChartData = () => {
    return categoryData.map(item => ({
      value: item.population,
      color: item.color,
      label: item.name,
    }));
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['day', 'week', 'month'] as ReportPeriod[]).map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.periodButton, period === p && styles.periodButtonActive]}
          onPress={() => setPeriod(p)}
        >
          <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDateNavigator = () => (
    <View style={styles.dateNavigator}>
      <TouchableOpacity onPress={handlePrevious} style={styles.navButton}>
        <Icon name="chevron-left" size={28} color="#333" />
      </TouchableOpacity>
      <Text style={styles.dateText}>{formatDisplayDate(date)}</Text>
      <TouchableOpacity onPress={handleNext} style={styles.navButton}>
        <Icon name="chevron-right" size={28} color="#333" />
      </TouchableOpacity>
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
        <Text style={styles.summaryLabel}>Income</Text>
        <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>
          ${summary.income.toLocaleString()}
        </Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
        <Text style={styles.summaryLabel}>Expense</Text>
        <Text style={[styles.summaryValue, { color: '#C62828' }]}>
          ${summary.expense.toLocaleString()}
        </Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
        <Text style={styles.summaryLabel}>Balance</Text>
        <Text style={[styles.summaryValue, { color: '#1565C0' }]}>
          ${summary.balance.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <View style={[
          styles.transactionIcon, 
          { backgroundColor: item.type === 'INCOME' ? '#E8F5E9' : '#FFEBEE' }
        ]}>
          <Icon 
            name={item.type === 'INCOME' ? 'arrow-downward' : 'arrow-upward'} 
            size={20} 
            color={item.type === 'INCOME' ? '#2E7D32' : '#C62828'} 
          />
        </View>
        <View>
          <Text style={styles.transactionCategory}>{item.category?.name || 'Uncategorized'}</Text>
          <Text style={styles.transactionDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: item.type === 'INCOME' ? '#2E7D32' : '#C62828' }
      ]}>
        {item.type === 'INCOME' ? '+' : '-'}${parseFloat(item.amount.toString()).toLocaleString()}
      </Text>
    </View>
  );

  // Show loading indicator when loading and no data has been loaded yet
  // Since we clear data on period/date change, this will work correctly for period switches
  const hasNoData = chartData.datasets[0].data.length === 0 && transactions.length === 0;
  if (loading && hasNoData) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      {renderPeriodSelector()}
      {renderDateNavigator()}
      {renderSummaryCards()}

      {/* Main Chart - Grouped Column Chart */}
      {period !== 'day' && chartData.datasets[0].data.length > 0 && chartData.incomeData && chartData.expenseData && (() => {
        const barChartData = transformBarChartData();
        if (!barChartData) return null;
        
        const maxValue = Math.max(
          ...(chartData.incomeData || []).concat(chartData.expenseData || []),
          100
        ) * 1.2;
        
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <BarChart
              style={styles.barChart}
              data={barChartData}
              xAxis={{
                valueFormatter: chartData.labels,
                granularity: 1,
                granularityEnabled: true,
                position: 'BOTTOM',
                textSize: 10,
                textColor: '#666',
                axisLineColor: '#E0E0E0',
                gridColor: '#E0E0E0',
                avoidFirstLastClipping: true,
              }}
              yAxis={{
                left: {
                  axisMinimum: 0,
                  axisMaximum: maxValue,
                  textSize: 10,
                  textColor: '#666',
                  axisLineColor: '#E0E0E0',
                  gridColor: 'rgba(0, 0, 0, 0.1)',
                  valueFormatter: '$#',
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
                wordWrapEnabled: true,
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
          </View>
        );
      })()}

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Top Expenses</Text>
          <View style={styles.pieChartContainer}>
            <PieChart
              data={transformPieChartData()}
              radius={90}
              showText
              textColor="#333"
              textSize={12}
              focusOnPress
              showGradient
              donut
              innerRadius={60}
              innerCircleColor="#fff"
              centerLabelComponent={() => (
                <View style={styles.pieChartCenter}>
                  <Text style={styles.pieChartCenterText}>Total</Text>
                  <Text style={styles.pieChartCenterValue}>
                    ${categoryData.reduce((sum, item) => sum + item.population, 0).toLocaleString()}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length > 0 ? (
          transactions.slice(0, 5).map(t => (
            <View key={t.id} style={{ marginBottom: 10 }}>
              {renderTransactionItem({ item: t })}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No transactions found for this period.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#4CAF50',
  },
  periodButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  dateNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  pieChartCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieChartCenterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  pieChartCenterValue: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  barChart: {
    height: 240,
    marginVertical: 12,
  },
});
