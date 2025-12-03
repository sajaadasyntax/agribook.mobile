import React, { useState, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { reportApi, transactionApi, categoryApi, alertApi, reminderApi } from '../src/services/api.service';
import syncService from '../src/services/sync.service';
import { FinancialSummary, Category, CreateTransactionDto } from '../src/types';
import { formatCurrency } from '../src/utils/currency';

export default function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated, isOffline, settings } = useUser();
  const { t, isRTL, locale } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
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
      
      // Load categories with offline fallback
      const loadCategoriesWithFallback = async (): Promise<{ income: Category[]; expense: Category[] }> => {
        try {
          // Check actual network status first
          const isCurrentlyOnline = await syncService.checkNetworkStatus();
          const shouldUseOffline = !isCurrentlyOnline || isOffline || settings?.offlineMode;
          
          if (shouldUseOffline) {
            // Load from cache when offline
            const cachedCategories = await syncService.getCachedCategories();
            return {
              income: cachedCategories.filter(cat => cat.type === 'INCOME'),
              expense: cachedCategories.filter(cat => cat.type === 'EXPENSE'),
            };
          } else {
            // Load from API when online
            try {
              // Fetch all categories at once to avoid duplicate calls
              const allCats = await categoryApi.getAll();
              
              // Cache all categories for offline use
              await syncService.cacheCategories(allCats);
              
              return {
                income: allCats.filter(cat => cat.type === 'INCOME'),
                expense: allCats.filter(cat => cat.type === 'EXPENSE'),
              };
            } catch (apiError) {
              // API failed, try cache as fallback
              console.warn('API call failed, falling back to cache:', apiError);
              const cachedCategories = await syncService.getCachedCategories();
              
              if (cachedCategories.length > 0) {
                return {
                  income: cachedCategories.filter(cat => cat.type === 'INCOME'),
                  expense: cachedCategories.filter(cat => cat.type === 'EXPENSE'),
                };
              } else {
                throw apiError; // No cache available, throw original error
              }
            }
          }
        } catch (error) {
          console.error('Error loading categories:', error);
          // Return empty arrays as fallback
          return { income: [], expense: [] };
        }
      };

      // Load categories with offline support
      const { income: incomeCats, expense: expenseCats } = await loadCategoriesWithFallback();

      // Load other data in parallel
      const [summaryData, alertCountData, remindersData] = await Promise.all([
        reportApi.getSummary(),
        alertApi.getUnreadCount(),
        reminderApi.getAll(false), // Get incomplete reminders
      ]);

      setSummary(summaryData);
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
  }, [isAuthenticated, user, isOffline, settings, t]);

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

  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const balance = summary?.balance || 0;

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoid(colors)}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container(colors)}>
        <View style={[styles.appBar(colors), isRTL && styles.appBarRTL]}>
          <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>{t('app.name')}</Text>
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
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
    </KeyboardAvoidingView>
  );
}

const styles = {
  keyboardAvoid: (colors: any) => ({
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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
    textAlign: 'left' as const,
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
    textAlign: 'left' as const,
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
    textAlign: 'center' as const,
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
};

