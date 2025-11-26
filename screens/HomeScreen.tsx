import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { reportApi, transactionApi, categoryApi } from '../src/services/api.service';
import { FinancialSummary, MonthlyReport, Category, CreateTransactionDto } from '../src/types';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen(): JSX.Element {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useUser();
  const { t, isRTL } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  
  // Form states for income
  const [incomeCategory, setIncomeCategory] = useState<string>('');
  const [incomeAmount, setIncomeAmount] = useState<string>('');
  const [incomeDescription, setIncomeDescription] = useState<string>('');
  
  // Form states for expense
  const [expenseCategory, setExpenseCategory] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDescription, setExpenseDescription] = useState<string>('');

  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const incomeYPosition = useRef<number>(0);
  const expenseYPosition = useRef<number>(0);

  const scrollToIncome = () => {
    scrollViewRef.current?.scrollTo({ y: incomeYPosition.current, animated: true });
  };

  const scrollToExpense = () => {
    scrollViewRef.current?.scrollTo({ y: expenseYPosition.current, animated: true });
  };

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setLoading(true);
      const [summaryData, monthlyData, incomeCats, expenseCats] = await Promise.all([
        reportApi.getSummary(),
        reportApi.getMonthly(),
        categoryApi.getAll('INCOME'),
        categoryApi.getAll('EXPENSE'),
      ]);

      setSummary(summaryData);
      setMonthlyReport(monthlyData);
      setIncomeCategories(incomeCats);
      setExpenseCategories(expenseCats);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('app.error'), t('home.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, t]);

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

  const handleSaveIncome = async () => {
    if (!incomeCategory || !incomeAmount) {
      Alert.alert(t('app.error'), t('home.selectCategory'));
      return;
    }

    try {
      const data: CreateTransactionDto = {
        type: 'INCOME',
        amount: parseFloat(incomeAmount),
        categoryId: incomeCategory,
        description: incomeDescription || undefined,
      };

      await transactionApi.create(data);
      Alert.alert(t('app.success'), t('home.incomeSaved'));
      
      // Reset form
      setIncomeCategory('');
      setIncomeAmount('');
      setIncomeDescription('');
      
      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Error saving income:', error);
      Alert.alert(t('app.error'), t('home.errorSaving'));
    }
  };

  const handleSaveExpense = async () => {
    if (!expenseCategory || !expenseAmount) {
      Alert.alert(t('app.error'), t('home.selectCategory'));
      return;
    }

    try {
      const data: CreateTransactionDto = {
        type: 'EXPENSE',
        amount: parseFloat(expenseAmount),
        categoryId: expenseCategory,
        description: expenseDescription || undefined,
      };

      await transactionApi.create(data);
      Alert.alert(t('app.success'), t('home.expenseSaved'));
      
      // Reset form
      setExpenseCategory('');
      setExpenseAmount('');
      setExpenseDescription('');
      
      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert(t('app.error'), t('home.errorSaving'));
    }
  };

  const handleSaveAndNew = async (type: 'income' | 'expense') => {
    if (type === 'income') {
      await handleSaveIncome();
    } else {
      await handleSaveExpense();
    }
  };

  if (loading && !summary) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('app.loading')}</Text>
      </View>
    );
  }

  const chartData = monthlyReport?.monthlyTrend
    ? {
        labels: monthlyReport.monthlyTrend.map((m) => m.month),
        datasets: [
          {
            data: monthlyReport.monthlyTrend.map((m) => m.balance),
            color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      }
    : {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0], color: () => 'rgba(255, 152, 0, 1)', strokeWidth: 2 }],
      };

  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const balance = summary?.balance || 0;

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>{t('app.name')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Alerts')}>
          <Icon name="notifications" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Financial Summary */}
        <View style={styles.section}>
          <View style={[styles.financialCards, isRTL && styles.financialCardsRTL]}>
            <View style={[styles.financialCard, styles.incomeCard]}>
              <Text style={styles.financialLabel}>{t('home.totalIncome')}</Text>
              <Text style={[styles.financialAmount, styles.incomeAmount]}>
                ${totalIncome.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.financialCard, styles.expenseCard]}>
              <Text style={styles.financialLabel}>{t('home.totalExpense')}</Text>
              <Text style={[styles.financialAmount, styles.expenseAmount]}>
                ${totalExpense.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.financialCard, styles.balanceCard]}>
              <Text style={styles.financialLabel}>{t('home.balance')}</Text>
              <Text style={[styles.financialAmount, styles.balanceAmount]}>
                ${balance.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <View style={[styles.actionButtons, isRTL && styles.actionButtonsRTL]}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.addIncomeButton]}
              onPress={scrollToIncome}
            >
              <Icon name="add" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>{t('home.addIncome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.addExpenseButton]}
              onPress={scrollToExpense}
            >
              <Icon name="remove" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>{t('home.addExpense')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Trend */}
        {monthlyReport && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('home.monthlyTrend')}</Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={chartData}
                width={screenWidth - 40}
                height={280}
                chartConfig={{
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
                }}
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
            <View style={[styles.chartInfo, isRTL && styles.chartInfoRTL]}>
              <Text style={styles.chartLabel}>
                {t('home.profit')} ${monthlyReport.balance >= 0 ? '+' : ''}
                {monthlyReport.balance.toLocaleString()}
              </Text>
              <Text style={styles.chartLabel}>
                {t('home.month')}: {new Date(monthlyReport.year, monthlyReport.month - 1).toLocaleString('default', { month: 'short' })}
              </Text>
            </View>
          </View>
        )}

        {/* Income Entry */}
        <View 
          style={styles.section}
          onLayout={(event) => {
            incomeYPosition.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('home.incomeEntry')}</Text>
          <View style={styles.categoryButtons}>
            {incomeCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  incomeCategory === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setIncomeCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    incomeCategory === cat.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.fullInput, isRTL && styles.fullInputRTL]}
            placeholder="e.g., 1200"
            keyboardType="numeric"
            value={incomeAmount}
            onChangeText={setIncomeAmount}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TextInput
            style={[styles.fullInput, isRTL && styles.fullInputRTL]}
            placeholder={t('home.addDescription')}
            multiline
            value={incomeDescription}
            onChangeText={setIncomeDescription}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <View style={[styles.saveButtons, isRTL && styles.saveButtonsRTL]}>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveIncomeButton]}
              onPress={handleSaveIncome}
            >
              <Text style={styles.saveButtonText}>{t('home.saveIncome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveNewButton]}
              onPress={() => handleSaveAndNew('income')}
            >
              <Text style={styles.saveButtonText}>{t('home.saveNew')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expense Entry */}
        <View 
          style={styles.section}
          onLayout={(event) => {
            expenseYPosition.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('home.expenseEntry')}</Text>
          <View style={styles.categoryButtons}>
            {expenseCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  expenseCategory === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setExpenseCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    expenseCategory === cat.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.fullInput, isRTL && styles.fullInputRTL]}
            placeholder="e.g., 450"
            keyboardType="numeric"
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TextInput
            style={[styles.fullInput, isRTL && styles.fullInputRTL]}
            placeholder={t('home.addDescription')}
            multiline
            value={expenseDescription}
            onChangeText={setExpenseDescription}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <View style={[styles.saveButtons, isRTL && styles.saveButtonsRTL]}>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveExpenseButton]}
              onPress={handleSaveExpense}
            >
              <Text style={styles.saveButtonText}>{t('home.saveExpense')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveNewButton]}
              onPress={() => handleSaveAndNew('expense')}
            >
              <Text style={styles.saveButtonText}>{t('home.saveNew')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
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
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: '#4CAF50',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  appBarTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
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
    marginBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: 'right',
  },
  financialCards: {
    flexDirection: 'row',
    gap: 10,
  },
  financialCardsRTL: {
    flexDirection: 'row-reverse',
  },
  financialCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  balanceCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  financialLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  financialAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  incomeAmount: {
    color: '#4CAF50',
  },
  expenseAmount: {
    color: '#F44336',
  },
  balanceAmount: {
    color: '#4CAF50',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonsRTL: {
    flexDirection: 'row-reverse',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addIncomeButton: {
    backgroundColor: '#4CAF50',
  },
  addExpenseButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
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
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartInfoRTL: {
    flexDirection: 'row-reverse',
  },
  chartLabel: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  categoryButtonActive: {
    backgroundColor: '#4CAF50',
  },
  categoryButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  fullInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fullInputRTL: {
    textAlign: 'right',
  },
  saveButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButtonsRTL: {
    flexDirection: 'row-reverse',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIncomeButton: {
    backgroundColor: '#4CAF50',
  },
  saveExpenseButton: {
    backgroundColor: '#F44336',
  },
  saveNewButton: {
    backgroundColor: '#81C784',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

