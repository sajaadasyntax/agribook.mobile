import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { reportApi } from '../src/services/api.service';
import { DailyReport, WeeklyReport, MonthlyReport, Statistics } from '../src/types';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen(): JSX.Element {
  const { isAuthenticated } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const [daily, weekly, monthly, stats] = await Promise.all([
        reportApi.getDaily(),
        reportApi.getWeekly(),
        reportApi.getMonthly(),
        reportApi.getStatistics(),
      ]);

      setDailyReport(daily);
      setWeeklyReport(weekly);
      setMonthlyReport(monthly);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleExportPDF = () => {
    Alert.alert(
      'Export PDF',
      'PDF export functionality will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  const handleExportExcel = () => {
    Alert.alert(
      'Export Excel',
      'Excel export functionality will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  // Enhanced chart configuration for mini charts
  const miniChartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Green theme matching app
    labelColor: (opacity = 1) => `rgba(97, 97, 97, ${opacity})`, // Dark gray labels for readability
    fillShadowGradient: '#4CAF50',
    fillShadowGradientOpacity: 0.3,
    barPercentage: 0.65,
    style: {
      borderRadius: 12,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      strokeWidth: 0.5,
      stroke: '#E0E0E0',
    },
    propsForLabels: {
      fontSize: 10,
      fontWeight: '500',
    },
  };

  // Enhanced chart configuration for detailed chart
  const detailedChartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#f8fff9',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Green theme matching app
    labelColor: (opacity = 1) => `rgba(66, 66, 66, ${opacity})`, // Darker labels for better readability
    fillShadowGradient: '#4CAF50',
    fillShadowGradientOpacity: 0.4,
    barPercentage: 0.7,
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: '5,5',
      strokeWidth: 1,
      stroke: '#E8E8E8',
    },
    propsForLabels: {
      fontSize: 11,
      fontWeight: '600',
    },
  };

  const getDailyChartData = () => {
    if (!dailyReport) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
      };
    }
    // For daily, we'll show the balance
    return {
      labels: ['Today'],
      datasets: [{ data: [dailyReport.balance] }],
    };
  };

  const getWeeklyChartData = () => {
    if (!weeklyReport) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
      };
    }
    const days = Object.keys(weeklyReport.dailyData).slice(0, 7);
    return {
      labels: days.map((d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
      // Calculate balance from income - expense since dailyData doesn't include balance
      datasets: [{ data: days.map((d) => {
        const dayData = weeklyReport.dailyData[d];
        return dayData.income - dayData.expense;
      }) }],
    };
  };

  const getMonthlyChartData = () => {
    if (!monthlyReport) {
      return {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0] }],
      };
    }
    return {
      labels: monthlyReport.monthlyTrend.map((m) => m.month),
      datasets: [{ data: monthlyReport.monthlyTrend.map((m) => m.balance) }],
    };
  };

  if (loading && !statistics) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
      </View>

      {/* Report Cards */}
      <View style={styles.section}>
        <View style={styles.reportCards}>
          {/* Daily Report */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Daily</Text>
            <View style={styles.miniChart}>
              <BarChart
                data={getDailyChartData()}
                width={screenWidth / 2 - 40}
                height={140}
                chartConfig={miniChartConfig}
                showValuesOnTopOfBars
                withInnerLines={false}
                withOuterLines={false}
                fromZero
                yAxisLabel="$"
                yAxisSuffix=""
                verticalLabelRotation={0}
                segments={3}
              />
            </View>
          </View>

          {/* Weekly Report */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Weekly</Text>
            <View style={styles.miniChart}>
              <BarChart
                data={getWeeklyChartData()}
                width={screenWidth / 2 - 40}
                height={140}
                chartConfig={miniChartConfig}
                showValuesOnTopOfBars
                withInnerLines={false}
                withOuterLines={false}
                fromZero
                yAxisLabel="$"
                yAxisSuffix=""
                verticalLabelRotation={0}
                segments={3}
              />
            </View>
          </View>

          {/* Monthly Report */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Monthly</Text>
            <View style={styles.miniChart}>
              <BarChart
                data={getMonthlyChartData()}
                width={screenWidth / 2 - 40}
                height={140}
                chartConfig={miniChartConfig}
                showValuesOnTopOfBars
                withInnerLines={false}
                withOuterLines={false}
                fromZero
                yAxisLabel="$"
                yAxisSuffix=""
                verticalLabelRotation={0}
                segments={3}
              />
            </View>
          </View>

          {/* Export Card */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Export</Text>
            <View style={styles.exportButtons}>
              <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
                <Icon name="picture-as-pdf" size={24} color="#fff" />
                <Text style={styles.exportButtonText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportButton, styles.excelButton]} onPress={handleExportExcel}>
                <Icon name="table-chart" size={24} color="#fff" />
                <Text style={styles.exportButtonText}>Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Detailed Reports Section */}
      {monthlyReport && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Reports</Text>
          <View style={styles.detailedChart}>
            <BarChart
              data={getMonthlyChartData()}
              width={screenWidth - 40}
              height={280}
              chartConfig={detailedChartConfig}
              showValuesOnTopOfBars
              withInnerLines={true}
              withOuterLines={true}
              fromZero
              yAxisLabel="$"
              yAxisSuffix=""
              verticalLabelRotation={0}
              segments={4}
              style={styles.chart}
            />
          </View>
        </View>
      )}

      {/* Summary Statistics */}
      {statistics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary Statistics</Text>
          <View style={styles.statistics}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Transactions</Text>
              <Text style={styles.statValue}>{statistics.totalTransactions}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Average Income</Text>
              <Text style={[styles.statValue, styles.positiveValue]}>
                ${statistics.averageIncome.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Average Expense</Text>
              <Text style={[styles.statValue, styles.negativeValue]}>
                ${statistics.averageExpense.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Net Profit</Text>
              <Text style={[styles.statValue, styles.positiveValue]}>
                ${statistics.netProfit.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  reportCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reportCard: {
    width: (screenWidth - 52) / 2,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 10,
    textAlign: 'center',
  },
  miniChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    gap: 8,
  },
  excelButton: {
    backgroundColor: '#81C784',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailedChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chart: {
    marginVertical: 4,
    borderRadius: 16,
  },
  statistics: {
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  positiveValue: {
    color: '#4CAF50',
  },
  negativeValue: {
    color: '#F44336',
  },
});

