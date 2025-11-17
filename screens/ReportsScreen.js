import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [20, 45, 28, 80, 99, 43, 50],
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
    },
  };

  return (
    <ScrollView style={styles.container}>
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
                data={chartData}
                width={screenWidth / 2 - 40}
                height={120}
                chartConfig={chartConfig}
                showValuesOnTopOfBars
                withInnerLines={false}
                withOuterLines={false}
                fromZero
              />
            </View>
          </View>

          {/* Weekly Report */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Weekly</Text>
            <View style={styles.miniChart}>
              <BarChart
                data={chartData}
                width={screenWidth / 2 - 40}
                height={120}
                chartConfig={chartConfig}
                showValuesOnTopOfBars
                withInnerLines={false}
                withOuterLines={false}
                fromZero
              />
            </View>
          </View>

          {/* Monthly Report */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Monthly</Text>
            <View style={styles.miniChart}>
              <BarChart
                data={chartData}
                width={screenWidth / 2 - 40}
                height={120}
                chartConfig={chartConfig}
                showValuesOnTopOfBars
                withInnerLines={false}
                withOuterLines={false}
                fromZero
              />
            </View>
          </View>

          {/* Export Card */}
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>Export</Text>
            <View style={styles.exportButtons}>
              <TouchableOpacity style={styles.exportButton}>
                <Icon name="picture-as-pdf" size={24} color="#fff" />
                <Text style={styles.exportButtonText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportButton, styles.excelButton]}>
                <Icon name="table-chart" size={24} color="#fff" />
                <Text style={styles.exportButtonText}>Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Detailed Reports Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detailed Reports</Text>
        <View style={styles.detailedChart}>
          <BarChart
            data={{
              labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
              datasets: [
                {
                  data: [2000, 2500, 3000, 2800, 3200, 3500],
                },
              ],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            showValuesOnTopOfBars
            withInnerLines={true}
            withOuterLines={true}
            fromZero
            style={styles.chart}
          />
        </View>
      </View>

      {/* Summary Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary Statistics</Text>
        <View style={styles.statistics}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Transactions</Text>
            <Text style={styles.statValue}>156</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Average Income</Text>
            <Text style={[styles.statValue, styles.positiveValue]}>$1,245</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Average Expense</Text>
            <Text style={[styles.statValue, styles.negativeValue]}>$832</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Net Profit</Text>
            <Text style={[styles.statValue, styles.positiveValue]}>$4,130</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
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
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  miniChart: {
    alignItems: 'center',
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
  },
  chart: {
    marginVertical: 8,
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

