import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { categoryApi, transactionApi } from '../src/services/api.service';
import syncService from '../src/services/sync.service';
import { Category, CreateTransactionDto } from '../src/types';

export default function AddScreen(): React.JSX.Element {
  const { isAuthenticated, isOffline, settings, pendingCount } = useUser();
  const { t, isRTL } = useI18n();
  const { colors } = useTheme();
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoadingCategories(true);
      const type = entryType === 'income' ? 'INCOME' : 'EXPENSE';
      
      if (isOffline || settings?.offlineMode) {
        // Load from cache when offline
        const cachedCategories = await syncService.getCachedCategories();
        const filteredCategories = cachedCategories.filter(cat => cat.type === type);
        setCategories(filteredCategories);
      } else {
        // Load from API when online
        const cats = await categoryApi.getAll(type);
        setCategories(cats);
        
        // Cache categories for offline use
        const allCats = await categoryApi.getAll();
        await syncService.cacheCategories(allCats);
      }
      
      setSelectedCategory('');
    } catch (error) {
      console.error('Error loading categories:', error);
      
      // Try to load from cache on error
      try {
        const type = entryType === 'income' ? 'INCOME' : 'EXPENSE';
        const cachedCategories = await syncService.getCachedCategories();
        const filteredCategories = cachedCategories.filter(cat => cat.type === type);
        if (filteredCategories.length > 0) {
          setCategories(filteredCategories);
        } else {
          Alert.alert(
            t('app.error') || 'Error', 
            t('add.loadCategoriesFailed') || 'Failed to load categories. Please try again.'
          );
        }
      } catch (cacheError) {
        Alert.alert(
          t('app.error') || 'Error', 
          t('add.loadCategoriesFailed') || 'Failed to load categories'
        );
      }
    } finally {
      setLoadingCategories(false);
    }
  }, [entryType, isAuthenticated, isOffline, settings?.offlineMode, t]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const generateOfflineId = (): string => {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const resetForm = (): void => {
    setAmount('');
    setNotes('');
    setSelectedCategory('');
  };

  type OfflineTransactionPayload = {
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    categoryId: string;
    description?: string;
    categorySnapshot?: Category;
  };

  const persistOfflineTransaction = async (
    payload: OfflineTransactionPayload,
    successMessage?: string
  ): Promise<void> => {
    const offlineId = generateOfflineId();
    await syncService.addPendingTransaction({
      id: offlineId,
      type: payload.type,
      amount: payload.amount,
      categoryId: payload.categoryId,
      description: payload.description,
      createdAt: new Date().toISOString(),
    });

    const cachedTransactions = await syncService.getCachedTransactions();
    const snapshotCategory =
      payload.categorySnapshot || categories.find((c) => c.id === payload.categoryId);

    const newTransaction = {
      id: offlineId,
      type: payload.type,
      amount: String(payload.amount),
      categoryId: payload.categoryId,
      userId: '',
      description: payload.description ?? null,
      receiptUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category:
        snapshotCategory ||
        ({
          id: payload.categoryId,
          name: '',
          type: payload.type,
          createdAt: '',
          updatedAt: '',
        } as Category),
    };

    await syncService.cacheTransactions([newTransaction, ...cachedTransactions]);

    if (successMessage) {
      Alert.alert(t('app.success') || 'Success', successMessage);
    }
  };

  const handleSave = async () => {
    if (!selectedCategory || !amount) {
      Alert.alert(
        t('app.error') || 'Error', 
        t('add.selectCategoryAndAmount') || 'Please select a category and enter an amount'
      );
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(
        t('app.error') || 'Error', 
        t('add.validAmount') || 'Please enter a valid amount'
      );
      return;
    }

    const transactionType = entryType.toUpperCase() as 'INCOME' | 'EXPENSE';

    try {
      setLoading(true);
      
      if (isOffline || settings?.offlineMode) {
        await persistOfflineTransaction(
          {
            type: transactionType,
            amount: amountNum,
            categoryId: selectedCategory,
            description: notes || undefined,
            categorySnapshot: categories.find((c) => c.id === selectedCategory),
          },
          t('add.savedOffline') || 'Transaction saved offline. It will sync when you are online.'
        );
      } else {
        // Online - save directly to API
        const data: CreateTransactionDto = {
          type: transactionType,
          amount: amountNum,
          categoryId: selectedCategory,
          description: notes || undefined,
        };

        await transactionApi.create(data);
        Alert.alert(
          t('app.success') || 'Success', 
          t('add.transactionSaved') || 'Transaction saved successfully'
        );
      }

      resetForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      
      // If online save fails, offer to save offline
      const offlineSnapshot: OfflineTransactionPayload = {
        type: transactionType,
        amount: amountNum,
        categoryId: selectedCategory,
        description: notes || undefined,
        categorySnapshot: categories.find((c) => c.id === selectedCategory),
      };

      Alert.alert(
        t('app.error') || 'Error',
        t('add.saveFailed') || 'Failed to save transaction. Would you like to save it offline?',
        [
          {
            text: t('app.cancel') || 'Cancel',
            style: 'cancel',
          },
          {
            text: t('add.saveOffline') || 'Save Offline',
            onPress: async () => {
              try {
                if (!offlineSnapshot.categoryId) {
                  Alert.alert(t('app.error') || 'Error', t('add.category') || 'Category required');
                  return;
                }

                await persistOfflineTransaction(
                  offlineSnapshot,
                  t('add.savedOffline') || 'Transaction saved offline.'
                );

                resetForm();
              } catch (offlineError) {
                console.error('Error saving offline:', offlineError);
                Alert.alert(
                  t('app.error') || 'Error', 
                  t('add.offlineSaveFailed') || 'Failed to save offline'
                );
              }
            },
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    await handleSave();
    // Form is already reset, just need to keep entry type
  };

  return (
    <ScrollView style={styles.container(colors)}>
      <View style={styles.header(colors)}>
        <Text style={[styles.headerTitle, isRTL && styles.headerTitleRTL]}>
          {t('add.title') || 'Add Transaction'}
        </Text>
        {(isOffline || settings?.offlineMode) && (
          <View style={styles.offlineBadge}>
            <Icon name="cloud-off" size={16} color={colors.textInverse} />
            <Text style={styles.offlineBadgeText}>
              {t('settings.offline') || 'Offline'}
            </Text>
          </View>
        )}
      </View>

      {/* Pending sync indicator */}
      {pendingCount > 0 && (
        <View style={styles.pendingBanner(colors)}>
          <Icon name="sync-problem" size={20} color={colors.warning} />
          <Text style={styles.pendingText(colors)}>
            {t('settings.pendingItems', { count: pendingCount }) || 
              `${pendingCount} item(s) pending sync`}
          </Text>
        </View>
      )}

      {/* Type Selector */}
      <View style={styles.section(colors)}>
        <View style={[styles.typeSelector, isRTL && styles.typeSelectorRTL]}>
          <TouchableOpacity
            style={[styles.typeButton(colors), entryType === 'income' && styles.typeButtonActive(colors)]}
            onPress={() => {
              setEntryType('income');
              setSelectedCategory('');
            }}
          >
            <Icon name="add" size={24} color={entryType === 'income' ? colors.textInverse : colors.income} />
            <Text
              style={[
                styles.typeButtonText(colors),
                entryType === 'income' && styles.typeButtonTextActive,
              ]}
            >
              {t('add.income') || 'Income'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton(colors), entryType === 'expense' && styles.typeButtonActiveExpense(colors)]}
            onPress={() => {
              setEntryType('expense');
              setSelectedCategory('');
            }}
          >
            <Icon name="remove" size={24} color={entryType === 'expense' ? colors.textInverse : colors.expense} />
            <Text
              style={[
                styles.typeButtonText(colors),
                styles.typeButtonTextExpense(colors),
                entryType === 'expense' && styles.typeButtonTextActive,
              ]}
            >
              {t('add.expense') || 'Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Entry Form */}
      <View style={styles.section(colors)}>
        <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
          {entryType === 'income' 
            ? (t('add.incomeEntry') || 'Income Entry')
            : (t('add.expenseEntry') || 'Expense Entry')
          }
        </Text>

        {/* Category Selection */}
        <Text style={[styles.label(colors), isRTL && styles.labelRTL]}>
          {t('add.category') || 'Category'}
        </Text>
        {loadingCategories ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : categories.length === 0 ? (
          <View style={styles.noCategoriesContainer}>
            <Icon name="category" size={40} color={colors.textSecondary} />
            <Text style={styles.noCategoriesText(colors)}>
              {t('add.noCategories') || 'No categories available'}
            </Text>
            {(isOffline || settings?.offlineMode) && (
              <Text style={styles.noCategoriesHint(colors)}>
                {t('add.connectToLoadCategories') || 'Connect to internet to load categories'}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.categoryButtons}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton(colors),
                  selectedCategory === cat.id && styles.categoryButtonActive(colors),
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryButtonText(colors),
                    selectedCategory === cat.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Amount Input */}
        <Text style={[styles.label(colors), isRTL && styles.labelRTL]}>
          {t('add.amount') || 'Amount'}
        </Text>
        <TextInput
          style={[styles.input(colors), isRTL && styles.inputRTL]}
          placeholder={entryType === 'income' 
            ? (t('add.amountPlaceholderIncome') || 'e.g., 1200')
            : (t('add.amountPlaceholderExpense') || 'e.g., 450')
          }
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          textAlign={isRTL ? 'right' : 'left'}
        />

        {/* Notes Input */}
        <Text style={[styles.label(colors), isRTL && styles.labelRTL]}>
          {t('add.notes') || 'Notes'}
        </Text>
        <TextInput
          style={[styles.input(colors), styles.textArea, isRTL && styles.inputRTL]}
          placeholder={t('add.notesPlaceholder') || 'Add description'}
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          textAlign={isRTL ? 'right' : 'left'}
        />

        {/* Save Buttons */}
        <View style={[styles.saveButtons, isRTL && styles.saveButtonsRTL]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              entryType === 'income' ? styles.saveIncomeButton(colors) : styles.saveExpenseButton(colors),
              loading && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                {(isOffline || settings?.offlineMode) && (
                  <Icon name="cloud-off" size={18} color={colors.textInverse} style={styles.saveButtonIcon} />
                )}
                <Text style={styles.saveButtonText}>
                  {t('add.save') || 'Save'} {entryType === 'income' 
                    ? (t('add.income') || 'Income')
                    : (t('add.expense') || 'Expense')
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, styles.saveNewButton(colors), loading && styles.saveButtonDisabled]}
            onPress={handleSaveAndNew}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {t('add.saveAndNew') || 'Save & New'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = {
  container: (colors: any) => ({
    flex: 1,
    backgroundColor: colors.background,
  }),
  header: (colors: any) => ({
    backgroundColor: colors.primary,
    padding: 16,
    paddingTop: 50,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  }),
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#fff',
  },
  headerTitleRTL: {
    textAlign: 'right' as const,
  },
  offlineBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  pendingBanner: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.warning + '20',
    padding: 12,
    margin: 10,
    borderRadius: 8,
    gap: 8,
  }),
  pendingText: (colors: any) => ({
    color: colors.warning,
    fontSize: 14,
    flex: 1,
  }),
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
    marginBottom: 16,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  typeSelector: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  typeSelectorRTL: {
    flexDirection: 'row-reverse' as const,
  },
  typeButton: (colors: any) => ({
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    gap: 8,
  }),
  typeButtonActive: (colors: any) => ({
    backgroundColor: colors.income,
    borderColor: colors.income,
  }),
  typeButtonActiveExpense: (colors: any) => ({
    backgroundColor: colors.expense,
    borderColor: colors.expense,
  }),
  typeButtonText: (colors: any) => ({
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.income,
  }),
  typeButtonTextExpense: (colors: any) => ({
    color: colors.expense,
  }),
  typeButtonTextActive: {
    color: '#fff',
  },
  label: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  }),
  labelRTL: {
    textAlign: 'right' as const,
  },
  loader: {
    marginVertical: 12,
  },
  noCategoriesContainer: {
    alignItems: 'center' as const,
    paddingVertical: 24,
  },
  noCategoriesText: (colors: any) => ({
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
  }),
  noCategoriesHint: (colors: any) => ({
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  }),
  categoryButtons: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 8,
  },
  categoryButton: (colors: any) => ({
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  input: (colors: any) => ({
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
    marginBottom: 8,
  }),
  inputRTL: {
    textAlign: 'right' as const,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top' as const,
  },
  saveButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 16,
  },
  saveButtonsRTL: {
    flexDirection: 'row-reverse' as const,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row' as const,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 6,
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
