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
  Image,
  Platform,
  processColor,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import { BarChart } from 'react-native-charts-wrapper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { reportApi, transactionApi, categoryApi, alertApi, reminderApi } from '../src/services/api.service';
import { FinancialSummary, MonthlyReport, Category, CreateTransactionDto } from '../src/types';
import { calculateYAxisMax } from '../src/hooks/useReportData';
import { formatCurrency } from '../src/utils/currency';
import { getAbsoluteLogoUrl } from '../src/utils/logoUrl';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useUser();
  const { t, isRTL, locale } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  const [upcomingReminderCount, setUpcomingReminderCount] = useState<number>(0);
  
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
      const [summaryData, monthlyData, incomeCats, expenseCats, alertCountData, remindersData] = await Promise.all([
        reportApi.getSummary(),
        reportApi.getMonthly(),
        categoryApi.getAll('INCOME'),
        categoryApi.getAll('EXPENSE'),
        alertApi.getUnreadCount(),
        reminderApi.getAll(false), // Get incomplete reminders
      ]);

      setSummary(summaryData);
      setMonthlyReport(monthlyData);
      setIncomeCategories(incomeCats);
      setExpenseCategories(expenseCats);
      setUnreadAlertCount(alertCountData.count);
      
      // Count upcoming reminders (not completed and due date is today or in the future)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const upcomingReminders = remindersData.filter((reminder) => {
        const dueDate = new Date(reminder.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return !reminder.completed && dueDate >= now;
      });
      setUpcomingReminderCount(upcomingReminders.length);
    } catch (error) {
      console.error('Error loading data:', error);
      
      // Provide more specific error message based on error type
      let errorMessage = t('home.errorLoading');
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        // Network/Connection errors (Frontend/Connectivity issue)
        if (errorMsg.includes('timeout') || errorMsg.includes('connection refused') || 
            errorMsg.includes('cannot resolve') || errorMsg.includes('network error') ||
            errorMsg.includes('econnrefused') || errorMsg.includes('enotfound')) {
          errorMessage = __DEV__
            ? `Network Error: ${error.message}\n\nPlease check:\n- Backend server is running\n- API URL is correct\n- Network connection is active`
            : 'Cannot connect to server. Please check your connection and ensure the backend is running.';
        } 
        // Authentication errors
        else if (errorMsg.includes('authentication') || errorMsg.includes('session expired') ||
                 errorMsg.includes('log in') || errorMsg.includes('401') || errorMsg.includes('403')) {
          errorMessage = __DEV__
            ? `Authentication Error: ${error.message}\n\nPlease check if you are logged in.`
            : 'Authentication required. Please log in again.';
        }
        // Server errors (Backend issue)
        else if (errorMsg.includes('internal server') || errorMsg.includes('database error') ||
                 errorMsg.includes('500') || errorMsg.includes('server error')) {
          errorMessage = 'Server Error: Backend encountered an issue. Please check backend logs.';
        }
        // Other errors - show the actual message
        else {
          errorMessage = `${t('home.errorLoading')}\n\n${error.message}`;
        }
      }
      
      Alert.alert(t('app.error'), errorMessage);
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
          label: 'Income',
          values: incomeValues,
          config: {
            color: getChartColor(incomeColor) as any,
            barShadowColor: getChartColor(incomeShadow) as any,
            highlightAlpha: 90,
            highlightColor: getChartColor(incomeShadow) as any,
          },
        },
        {
          label: 'Expense',
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
        {user?.logoUrl ? (
          <Image 
            source={{ uri: getAbsoluteLogoUrl(user.logoUrl) || user.logoUrl }} 
            style={styles.logoImage} 
            resizeMode="contain" 
            onError={(error) => {
              console.error('Logo load error in HomeScreen:', error);
            }}
          />
        ) : (
          <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>{t('app.name')}</Text>
        )}
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Alerts')}
        >
          <Icon name="notifications" size={24} color={colors.textInverse} />
          {(unreadAlertCount > 0 || upcomingReminderCount > 0) && (
            <View style={[styles.notificationBadge, isRTL && styles.notificationBadgeRTL]}>
              <Text style={styles.notificationBadgeText}>
                {(unreadAlertCount + upcomingReminderCount) > 99 ? '99+' : (unreadAlertCount + upcomingReminderCount)}
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
        {/* Financial Summary - Using Reports Summary Cards Style */}
        <View style={styles.section(colors)}>
          <View style={[styles.summaryContainer, isRTL && styles.summaryContainerRTL]}>
            <View style={[styles.summaryCard(colors), { backgroundColor: colors.income + '20' }]}>
              <Text style={styles.summaryLabel(colors)}>{t('home.totalIncome')}</Text>
              <Text style={[styles.summaryValue, { color: colors.income }]}>
                {formatCurrency(totalIncome, { locale })}
              </Text>
            </View>
            <View style={[styles.summaryCard(colors), { backgroundColor: colors.expense + '20' }]}>
              <Text style={styles.summaryLabel(colors)}>{t('home.totalExpense')}</Text>
              <Text style={[styles.summaryValue, { color: colors.expense }]}>
                {formatCurrency(totalExpense, { locale })}
              </Text>
            </View>
            <View style={[styles.summaryCard(colors), { backgroundColor: colors.primary + '20' }]}>
              <Text style={styles.summaryLabel(colors)}>{t('home.balance')}</Text>
              <Text style={[styles.summaryValue, { color: balance < 0 ? colors.expense : colors.primary }]}>
                {formatCurrency(balance, { locale })}
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
          
          // Calculate Y-axis maximum using the same function as ReportsScreen
          const maxIncome = Math.max(...monthlyReport.monthlyTrend.map(m => m.income), 0);
          const maxExpense = Math.max(...monthlyReport.monthlyTrend.map(m => m.expense), 0);
          const yAxisMax = calculateYAxisMax(maxIncome, maxExpense);
          
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
                  {t('home.profit')} {monthlyReport.balance >= 0 ? '+' : ''}
                  {formatCurrency(monthlyReport.balance, { locale })}
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
  logoImage: {
    width: 120,
    height: 40,
    maxWidth: 150,
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
  summaryContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 0,
    gap: 12,
    marginBottom: 0,
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
    backgroundColor: colors.surface,
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
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
    height: 240,
    width: screenWidth - 64, // Account for container margins (32px) and padding (32px)
    marginVertical: 12,
  },
};

