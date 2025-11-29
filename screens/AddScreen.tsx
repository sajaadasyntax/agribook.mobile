import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { categoryApi, transactionApi } from '../src/services/api.service';
import syncService from '../src/services/sync.service';
import { Category, CreateTransactionDto, CreateCategoryDto, CategoryType } from '../src/types';

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
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  
  // Category management states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('INCOME');
  const [savingCategory, setSavingCategory] = useState(false);
  const [managementMode, setManagementMode] = useState<'add' | 'delete'>('add');

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
        setAllCategories(cachedCategories);
      } else {
        // Load from API when online
        const cats = await categoryApi.getAll(type);
        setCategories(cats);
        
        // Cache categories for offline use
        const allCats = await categoryApi.getAll();
        setAllCategories(allCats);
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
          setAllCategories(cachedCategories);
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

  const openCategoryModal = (mode: 'add' | 'delete') => {
    setManagementMode(mode);
    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryType(entryType === 'income' ? 'INCOME' : 'EXPENSE');
    setShowCategoryModal(true);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert(t('app.error'), t('add.categoryNamePlaceholder'));
      return;
    }

    // Check actual network status
    const isCurrentlyOnline = await syncService.checkNetworkStatus();
    if (!isCurrentlyOnline || settings?.offlineMode) {
      Alert.alert(
        t('app.error'), 
        t('add.connectToLoadCategories') || 'Connect to internet to add categories'
      );
      return;
    }

    try {
      setSavingCategory(true);
      
      const data: CreateCategoryDto = {
        name: newCategoryName.trim(),
        type: newCategoryType,
        description: newCategoryDescription.trim() || undefined,
      };

      await categoryApi.create(data);
      Alert.alert(t('app.success'), t('add.categoryCreated'));
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      await loadCategories();
    } catch (error: any) {
      console.error('Error creating category:', error);
      // Check if it's a network error
      if (!await syncService.checkNetworkStatus()) {
        Alert.alert(t('app.error'), t('add.connectToLoadCategories') || 'No internet connection');
      } else if (error?.message?.includes('already exists')) {
        Alert.alert(t('app.error'), t('add.categoryExists'));
      } else {
        Alert.alert(t('app.error'), t('add.errorCreatingCategory'));
      }
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    // Check actual network status
    const isCurrentlyOnline = await syncService.checkNetworkStatus();
    if (!isCurrentlyOnline || settings?.offlineMode) {
      Alert.alert(
        t('app.error'), 
        t('add.connectToLoadCategories') || 'Connect to internet to delete categories'
      );
      return;
    }

    Alert.alert(
      t('add.deleteCategory'),
      t('add.confirmDeleteCategory'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('app.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await categoryApi.delete(categoryId);
              Alert.alert(t('app.success'), t('add.categoryDeleted'));
              await loadCategories();
            } catch (error: any) {
              console.error('Error deleting category:', error);
              if (error?.message?.includes('transactions')) {
                Alert.alert(t('app.error'), t('add.categoryHasTransactions'));
              } else {
                Alert.alert(t('app.error'), t('add.errorDeletingCategory'));
              }
            }
          },
        },
      ]
    );
  };

  const incomeCategories = allCategories.filter(c => c.type === 'INCOME');
  const expenseCategories = allCategories.filter(c => c.type === 'EXPENSE');

  return (
    <ScrollView style={styles.container(colors)}>
      <View style={[styles.header(colors), isRTL && styles.headerRTL]}>
        <Text style={[styles.headerTitle, isRTL && styles.headerTitleRTL]}>
          {t('add.title') || 'Add Transaction'}
        </Text>
        {(isOffline || settings?.offlineMode) && (
          <View style={[styles.offlineBadge, isRTL && styles.offlineBadgeRTL]}>
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

      {/* Category Management Card */}
      <View style={styles.section(colors)}>
        <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
            {t('add.manageCategories')}
          </Text>
        </View>
        
        <View style={[styles.categoryManagementButtons, isRTL && styles.categoryManagementButtonsRTL]}>
          <TouchableOpacity
            style={styles.manageCategoryButton(colors)}
            onPress={() => openCategoryModal('add')}
          >
            <Icon name="add-circle-outline" size={20} color={colors.income} />
            <Text style={styles.manageCategoryButtonText(colors)}>
              {t('add.addCategory')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manageCategoryButton(colors)}
            onPress={() => openCategoryModal('delete')}
          >
            <Icon name="remove-circle-outline" size={20} color={colors.expense} />
            <Text style={[styles.manageCategoryButtonText(colors), { color: colors.expense }]}>
              {t('add.deleteCategory')}
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
            <TouchableOpacity
              style={styles.addCategoryInlineButton(colors)}
              onPress={() => openCategoryModal('add')}
            >
              <Icon name="add" size={16} color={colors.primary} />
              <Text style={styles.addCategoryInlineText(colors)}>
                {t('add.addCategory')}
              </Text>
            </TouchableOpacity>
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

      {/* Category Management Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent(colors)}>
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={styles.modalTitle(colors)}>
                {managementMode === 'add' ? t('add.addCategory') : t('add.deleteCategory')}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {managementMode === 'add' ? (
                <>
                  {/* Category Type Selection */}
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('add.categoryType')}
                  </Text>
                  <View style={[styles.categoryTypeSelector, isRTL && styles.categoryTypeSelectorRTL]}>
                    <TouchableOpacity
                      style={[
                        styles.categoryTypeOption(colors),
                        newCategoryType === 'INCOME' && styles.categoryTypeOptionActiveIncome(colors),
                      ]}
                      onPress={() => setNewCategoryType('INCOME')}
                    >
                      <Icon
                        name="add"
                        size={20}
                        color={newCategoryType === 'INCOME' ? colors.textInverse : colors.income}
                      />
                      <Text
                        style={[
                          styles.categoryTypeText(colors),
                          newCategoryType === 'INCOME' && styles.categoryTypeTextActive,
                        ]}
                      >
                        {t('add.income')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoryTypeOption(colors),
                        newCategoryType === 'EXPENSE' && styles.categoryTypeOptionActiveExpense(colors),
                      ]}
                      onPress={() => setNewCategoryType('EXPENSE')}
                    >
                      <Icon
                        name="remove"
                        size={20}
                        color={newCategoryType === 'EXPENSE' ? colors.textInverse : colors.expense}
                      />
                      <Text
                        style={[
                          styles.categoryTypeText(colors),
                          newCategoryType === 'EXPENSE' && styles.categoryTypeTextActive,
                        ]}
                      >
                        {t('add.expense')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Category Name */}
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('add.categoryName')}
                  </Text>
                  <TextInput
                    style={[styles.modalInput(colors), isRTL && styles.modalInputRTL]}
                    placeholder={t('add.categoryNamePlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    textAlign={isRTL ? 'right' : 'left'}
                  />

                  {/* Category Description */}
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('add.categoryDescription')}
                  </Text>
                  <TextInput
                    style={[styles.modalInput(colors), styles.modalTextArea, isRTL && styles.modalInputRTL]}
                    placeholder={t('add.categoryDescriptionPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={newCategoryDescription}
                    onChangeText={setNewCategoryDescription}
                    multiline
                    numberOfLines={3}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </>
              ) : (
                <>
                  {/* Income Categories */}
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('add.incomeCategories')}
                  </Text>
                  {incomeCategories.length === 0 ? (
                    <Text style={styles.noCategoriesModalText(colors)}>
                      {t('add.noCategories')}
                    </Text>
                  ) : (
                    <View style={styles.deleteCategoryList}>
                      {incomeCategories.map((cat) => (
                        <View
                          key={cat.id}
                          style={[styles.deleteCategoryItem(colors), isRTL && styles.deleteCategoryItemRTL]}
                        >
                          <Text style={[styles.deleteCategoryName(colors), isRTL && styles.textRTL]}>
                            {cat.name}
                          </Text>
                          <TouchableOpacity
                            style={styles.deleteCategoryButton}
                            onPress={() => handleDeleteCategory(cat.id, cat.name)}
                          >
                            <Icon name="delete" size={20} color={colors.expense} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Expense Categories */}
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL, { marginTop: 16 }]}>
                    {t('add.expenseCategories')}
                  </Text>
                  {expenseCategories.length === 0 ? (
                    <Text style={styles.noCategoriesModalText(colors)}>
                      {t('add.noCategories')}
                    </Text>
                  ) : (
                    <View style={styles.deleteCategoryList}>
                      {expenseCategories.map((cat) => (
                        <View
                          key={cat.id}
                          style={[styles.deleteCategoryItem(colors), isRTL && styles.deleteCategoryItemRTL]}
                        >
                          <Text style={[styles.deleteCategoryName(colors), isRTL && styles.textRTL]}>
                            {cat.name}
                          </Text>
                          <TouchableOpacity
                            style={styles.deleteCategoryButton}
                            onPress={() => handleDeleteCategory(cat.id, cat.name)}
                          >
                            <Icon name="delete" size={20} color={colors.expense} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {managementMode === 'add' && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalCancelButton(colors)]}
                  onPress={() => setShowCategoryModal(false)}
                >
                  <Text style={styles.modalCancelButtonText(colors)}>{t('app.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveButton(colors), savingCategory && styles.modalSaveButtonDisabled]}
                  onPress={handleCreateCategory}
                  disabled={savingCategory}
                >
                  {savingCategory ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>
                      {t('add.createCategory')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  headerRTL: {
    flexDirection: 'row-reverse' as const,
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
  offlineBadgeRTL: {
    flexDirection: 'row-reverse' as const,
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
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse' as const,
  },
  sectionTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 16,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  categoryManagementButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  categoryManagementButtonsRTL: {
    flexDirection: 'row-reverse' as const,
  },
  manageCategoryButton: (colors: any) => ({
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    gap: 8,
  }),
  manageCategoryButtonText: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.income,
  }),
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
  addCategoryInlineButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
  }),
  addCategoryInlineText: (colors: any) => ({
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  modalContent: (colors: any) => ({
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  }),
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalHeaderRTL: {
    flexDirection: 'row-reverse' as const,
  },
  modalTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
  }),
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row' as const,
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputLabel: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  }),
  textRTL: {
    textAlign: 'right' as const,
  },
  categoryTypeSelector: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 16,
  },
  categoryTypeSelectorRTL: {
    flexDirection: 'row-reverse' as const,
  },
  categoryTypeOption: (colors: any) => ({
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  }),
  categoryTypeOptionActiveIncome: (colors: any) => ({
    backgroundColor: colors.income,
    borderColor: colors.income,
  }),
  categoryTypeOptionActiveExpense: (colors: any) => ({
    backgroundColor: colors.expense,
    borderColor: colors.expense,
  }),
  categoryTypeText: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  }),
  categoryTypeTextActive: {
    color: '#fff',
  },
  modalInput: (colors: any) => ({
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.inputBackground,
    color: colors.text,
    marginBottom: 12,
  }),
  modalInputRTL: {
    textAlign: 'right' as const,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top' as const,
  },
  noCategoriesModalText: (colors: any) => ({
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 12,
  }),
  deleteCategoryList: {
    gap: 8,
  },
  deleteCategoryItem: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
  }),
  deleteCategoryItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
  deleteCategoryName: (colors: any) => ({
    fontSize: 16,
    color: colors.text,
    flex: 1,
  }),
  deleteCategoryButton: {
    padding: 8,
  },
  modalCancelButton: (colors: any) => ({
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
  }),
  modalCancelButtonText: (colors: any) => ({
    fontSize: 16,
    color: colors.text,
    fontWeight: '600' as const,
  }),
  modalSaveButton: (colors: any) => ({
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center' as const,
  }),
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
};
