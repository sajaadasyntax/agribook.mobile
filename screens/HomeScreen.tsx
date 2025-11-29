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
import { Dimensions } from 'react-native';
import { BarChart } from 'react-native-charts-wrapper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { reportApi, transactionApi, categoryApi, alertApi } from '../src/services/api.service';
import { FinancialSummary, MonthlyReport, Category, CreateTransactionDto } from '../src/types';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useUser();
  const { t, isRTL } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  
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
      const [summaryData, monthlyData, incomeCats, expenseCats, alertCountData] = await Promise.all([
        reportApi.getSummary(),
        reportApi.getMonthly(),
        categoryApi.getAll('INCOME'),
        categoryApi.getAll('EXPENSE'),
        alertApi.getUnreadCount(),
      ]);

      setSummary(summaryData);
      setMonthlyReport(monthlyData);
      setIncomeCategories(incomeCats);
      setExpenseCategories(expenseCats);
      setUnreadAlertCount(alertCountData.count);
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
      <View style={[styles.container(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText(colors)}>{t('app.loading')}</Text>
      </View>
    );
  }

  // Transform chartData for react-native-charts-wrapper BarChart (grouped bars)
  const transformBarChartData = () => {
    if (!monthlyReport?.monthlyTrend || monthlyReport.monthlyTrend.length === 0) {
      return null;
    }
    
    const incomeValues = monthlyReport.monthlyTrend.map((m, index) => ({
      x: index,
      y: m.income,
    }));
    
    const expenseValues = monthlyReport.monthlyTrend.map((m, index) => ({
      x: index,
      y: m.expense,
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

  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const balance = summary?.balance || 0;

  return (
    <View style={styles.container(colors)}>
      <View style={[styles.appBar(colors), isRTL && styles.appBarRTL]}>
        <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>{t('app.name')}</Text>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Alerts')}
        >
          <Icon name="notifications" size={24} color={colors.textInverse} />
          {unreadAlertCount > 0 && (
            <View style={[styles.notificationBadge, isRTL && styles.notificationBadgeRTL]}>
              <Text style={styles.notificationBadgeText}>
                {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Financial Summary */}
        <View style={styles.section(colors)}>
          <View style={[styles.financialCards, isRTL && styles.financialCardsRTL]}>
            <View style={[styles.financialCard(colors), styles.incomeCard(colors)]}>
              <Text style={styles.financialLabel(colors)}>{t('home.totalIncome')}</Text>
              <Text style={[styles.financialAmount, styles.incomeAmount(colors)]}>
                ${totalIncome.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.financialCard(colors), styles.expenseCard(colors)]}>
              <Text style={styles.financialLabel(colors)}>{t('home.totalExpense')}</Text>
              <Text style={[styles.financialAmount, styles.expenseAmount(colors)]}>
                ${totalExpense.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.financialCard(colors), styles.balanceCard(colors)]}>
              <Text style={styles.financialLabel(colors)}>{t('home.balance')}</Text>
              <Text style={[styles.financialAmount, styles.balanceAmount(colors)]}>
                ${balance.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section(colors)}>
          <View style={[styles.actionButtons, isRTL && styles.actionButtonsRTL]}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.addIncomeButton(colors)]}
              onPress={scrollToIncome}
            >
              <Icon name="add" size={24} color={colors.textInverse} />
              <Text style={styles.actionButtonText}>{t('home.addIncome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.addExpenseButton(colors)]}
              onPress={scrollToExpense}
            >
              <Icon name="remove" size={24} color={colors.textInverse} />
              <Text style={styles.actionButtonText}>{t('home.addExpense')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Trend - Grouped Column Chart */}
        {monthlyReport && (() => {
          const barChartData = transformBarChartData();
          if (!barChartData) return null;
          
          const maxValue = Math.max(
            ...monthlyReport.monthlyTrend.map(m => Math.max(m.income, m.expense)),
            100
          ) * 1.2;
          const labels = monthlyReport.monthlyTrend.map(m => m.month);
          
          return (
            <View style={styles.section(colors)}>
              <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('home.monthlyTrend')}</Text>
              <View style={styles.chartContainer(colors)}>
                <BarChart
                  style={styles.barChart}
                  data={barChartData}
                  xAxis={{
                    valueFormatter: labels,
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
                      axisMaximum: maxValue,
                      textSize: 10,
                      textColor: colors.textSecondary,
                      axisLineColor: colors.border,
                      gridColor: colors.border + '40',
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
              <View style={[styles.chartInfo, isRTL && styles.chartInfoRTL]}>
                <Text style={styles.chartLabel(colors)}>
                  {t('home.profit')} ${monthlyReport.balance >= 0 ? '+' : ''}
                  {monthlyReport.balance.toLocaleString()}
                </Text>
                <Text style={styles.chartLabel(colors)}>
                  {t('home.month')}: {new Date(monthlyReport.year, monthlyReport.month - 1).toLocaleString('default', { month: 'short' })}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Income Entry */}
        <View 
          style={styles.section(colors)}
          onLayout={(event) => {
            incomeYPosition.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('home.incomeEntry')}</Text>
          <View style={styles.categoryButtons}>
            {incomeCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton(colors),
                  incomeCategory === cat.id && styles.categoryButtonActive(colors),
                ]}
                onPress={() => setIncomeCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryButtonText(colors),
                    incomeCategory === cat.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.fullInput(colors), isRTL && styles.fullInputRTL]}
            placeholder="e.g., 1200"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={incomeAmount}
            onChangeText={setIncomeAmount}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TextInput
            style={[styles.fullInput(colors), isRTL && styles.fullInputRTL]}
            placeholder={t('home.addDescription')}
            placeholderTextColor={colors.textSecondary}
            multiline
            value={incomeDescription}
            onChangeText={setIncomeDescription}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <View style={[styles.saveButtons, isRTL && styles.saveButtonsRTL]}>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveIncomeButton(colors)]}
              onPress={handleSaveIncome}
            >
              <Text style={styles.saveButtonText}>{t('home.saveIncome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveNewButton(colors)]}
              onPress={() => handleSaveAndNew('income')}
            >
              <Text style={styles.saveButtonText}>{t('home.saveNew')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expense Entry */}
        <View 
          style={styles.section(colors)}
          onLayout={(event) => {
            expenseYPosition.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('home.expenseEntry')}</Text>
          <View style={styles.categoryButtons}>
            {expenseCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton(colors),
                  expenseCategory === cat.id && styles.categoryButtonActive(colors),
                ]}
                onPress={() => setExpenseCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryButtonText(colors),
                    expenseCategory === cat.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.fullInput(colors), isRTL && styles.fullInputRTL]}
            placeholder="e.g., 450"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TextInput
            style={[styles.fullInput(colors), isRTL && styles.fullInputRTL]}
            placeholder={t('home.addDescription')}
            placeholderTextColor={colors.textSecondary}
            multiline
            value={expenseDescription}
            onChangeText={setExpenseDescription}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <View style={[styles.saveButtons, isRTL && styles.saveButtonsRTL]}>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveExpenseButton(colors)]}
              onPress={handleSaveExpense}
            >
              <Text style={styles.saveButtonText}>{t('home.saveExpense')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, styles.saveNewButton(colors)]}
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

const styles = {
  container: (colors: any) => ({
    flex: 1,
    backgroundColor: colors.background,
  }),
  centerContent: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  loadingText: (colors: any) => ({
    marginTop: 10,
    fontSize: 16,
    color: colors.textSecondary,
  }),
  appBar: (colors: any) => ({
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: colors.primary,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  }),
  appBarTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#fff',
  },
  appBarTitleRTL: {
    textAlign: 'right' as const,
  },
  appBarRTL: {
    flexDirection: 'row-reverse' as const,
  },
  notificationButton: {
    position: 'relative' as const,
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
  },
  notificationBadgeRTL: {
    right: undefined,
    left: 0,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
  scrollView: {
    flex: 1,
  },
  section: (colors: any) => ({
    backgroundColor: colors.surface,
    margin: 10,
    padding: 16,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  }),
  sectionTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 12,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  financialCards: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  financialCardsRTL: {
    flexDirection: 'row-reverse' as const,
  },
  financialCard: (colors: any) => ({
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
  }),
  incomeCard: (colors: any) => ({
    borderLeftWidth: 4,
    borderLeftColor: colors.income,
  }),
  expenseCard: (colors: any) => ({
    borderLeftWidth: 4,
    borderLeftColor: colors.expense,
  }),
  balanceCard: (colors: any) => ({
    borderLeftWidth: 4,
    borderLeftColor: colors.income,
  }),
  financialLabel: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  }),
  financialAmount: {
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
  incomeAmount: (colors: any) => ({
    color: colors.income,
  }),
  expenseAmount: (colors: any) => ({
    color: colors.expense,
  }),
  balanceAmount: (colors: any) => ({
    color: colors.income,
  }),
  actionButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  actionButtonsRTL: {
    flexDirection: 'row-reverse' as const,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addIncomeButton: (colors: any) => ({
    backgroundColor: colors.income,
  }),
  addExpenseButton: (colors: any) => ({
    backgroundColor: colors.expense,
  }),
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  chartContainer: (colors: any) => ({
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  }),
  chart: {
    marginVertical: 4,
    borderRadius: 16,
  },
  chartInfo: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: 8,
  },
  chartInfoRTL: {
    flexDirection: 'row-reverse' as const,
  },
  chartLabel: (colors: any) => ({
    fontSize: 14,
    color: colors.textSecondary,
  }),
  categoryButtons: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: (colors: any) => ({
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  }),
  categoryButtonActive: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  categoryButtonText: (colors: any) => ({
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500' as const,
  }),
  categoryButtonTextActive: {
    color: '#fff',
  },
  fullInput: (colors: any) => ({
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    color: colors.text,
  }),
  fullInputRTL: {
    textAlign: 'right' as const,
  },
  saveButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  saveButtonsRTL: {
    flexDirection: 'row-reverse' as const,
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveIncomeButton: (colors: any) => ({
    backgroundColor: colors.income,
  }),
  saveExpenseButton: (colors: any) => ({
    backgroundColor: colors.expense,
  }),
  saveNewButton: (colors: any) => ({
    backgroundColor: colors.primaryLight,
  }),
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  barChart: {
    height: 280,
    marginVertical: 12,
  },
};

