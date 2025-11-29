import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { alertApi, reminderApi, categoryApi } from '../src/services/api.service';
import { Alert as AlertType, Reminder, Category, CreateReminderDto, ReminderType } from '../src/types';

export default function AlertsScreen(): React.JSX.Element {
  const { isAuthenticated, settings, updateSettings } = useUser();
  const { t, isRTL } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  
  // Modal states
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  
  // Form states
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState(new Date());
  const [reminderType, setReminderType] = useState<ReminderType>('GENERAL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [thresholdAmount, setThresholdAmount] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const [alertsData, remindersData, allCategories] = await Promise.all([
        alertApi.getAll(false),
        reminderApi.getAll(false),
        categoryApi.getAll(),
      ]);

      setAlerts(alertsData);
      setReminders(remindersData);
      setCategories(allCategories);
      setExpenseCategories(allCategories.filter(c => c.type === 'EXPENSE'));
    } catch (error) {
      console.error('Error loading alerts:', error);
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

  const getAlertColor = (type: string): string => {
    switch (type) {
      case 'WARNING':
        return '#FFC107';
      case 'ERROR':
        return '#F44336';
      case 'INFO':
        return '#2196F3';
      case 'SUCCESS':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const getIconName = (type: string): keyof typeof Icon.glyphMap => {
    switch (type) {
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'error';
      case 'INFO':
        return 'info';
      case 'SUCCESS':
        return 'check-circle';
      default:
        return 'notifications';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return t('alerts.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('alerts.hoursAgo', { count: diffHours });
    return t('alerts.daysAgo', { count: diffDays });
  };

  const formatDueDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    if (date.toDateString() === now.toDateString()) {
      return t('alerts.today');
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return t('alerts.tomorrow');
    }
    if (date < weekFromNow) {
      return t('alerts.thisWeek');
    }
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await alertApi.markAsRead(alertId);
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await alertApi.markAllAsRead();
      setAlerts([]);
      Alert.alert(t('app.success'), t('alerts.allMarkedRead'));
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      Alert.alert(t('app.error'), t('alerts.errorUpdating'));
    }
  };

  const handleToggleReminder = async (reminderId: string) => {
    try {
      await reminderApi.toggle(reminderId);
      setReminders(
        reminders.map((r) => (r.id === reminderId ? { ...r, completed: !r.completed } : r))
      );
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    Alert.alert(
      t('alerts.deleteReminder'),
      t('alerts.confirmDelete'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('app.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await reminderApi.delete(reminderId);
              setReminders(reminders.filter((r) => r.id !== reminderId));
              Alert.alert(t('app.success'), t('alerts.reminderDeleted'));
            } catch (error) {
              console.error('Error deleting reminder:', error);
              Alert.alert(t('app.error'), t('alerts.errorDeleting'));
            }
          },
        },
      ]
    );
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    try {
      await updateSettings({ [key]: value } as any);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert(t('app.error'), t('alerts.errorUpdating'));
    }
  };

  const resetForm = () => {
    setReminderTitle('');
    setReminderDescription('');
    setReminderDueDate(new Date());
    setReminderType('GENERAL');
    setSelectedCategoryId('');
    setThresholdAmount('');
    setTransactionAmount('');
    setTransactionType('EXPENSE');
    setEditingReminder(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddReminderModal(true);
  };

  const openEditModal = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setReminderTitle(reminder.title);
    setReminderDescription(reminder.description || '');
    setReminderDueDate(new Date(reminder.dueDate));
    setReminderType(reminder.reminderType || 'GENERAL');
    setSelectedCategoryId(reminder.categoryId || '');
    setThresholdAmount(reminder.thresholdAmount?.toString() || '');
    setTransactionAmount(reminder.transactionAmount?.toString() || '');
    setTransactionType(reminder.transactionType || 'EXPENSE');
    setShowAddReminderModal(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderTitle.trim()) {
      Alert.alert(t('app.error'), t('alerts.reminderTitlePlaceholder'));
      return;
    }

    try {
      setSaving(true);
      
      const reminderData: CreateReminderDto = {
        title: reminderTitle.trim(),
        description: reminderDescription.trim() || undefined,
        dueDate: reminderDueDate.toISOString(),
        reminderType,
      };

      if (reminderType === 'THRESHOLD' && selectedCategoryId) {
        reminderData.categoryId = selectedCategoryId;
        reminderData.thresholdAmount = parseFloat(thresholdAmount) || undefined;
      }

      if (reminderType === 'TRANSACTION') {
        reminderData.transactionType = transactionType;
        reminderData.transactionAmount = parseFloat(transactionAmount) || undefined;
        if (selectedCategoryId) {
          reminderData.categoryId = selectedCategoryId;
        }
      }

      if (editingReminder) {
        await reminderApi.update(editingReminder.id, reminderData);
        Alert.alert(t('app.success'), t('alerts.reminderUpdated'));
      } else {
        await reminderApi.create(reminderData);
        Alert.alert(t('app.success'), t('alerts.reminderCreated'));
      }

      setShowAddReminderModal(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert(t('app.error'), t('alerts.errorCreating'));
    } finally {
      setSaving(false);
    }
  };

  const getReminderTypeLabel = (type: ReminderType): string => {
    switch (type) {
      case 'TRANSACTION':
        return t('alerts.transactionReminder');
      case 'THRESHOLD':
        return t('alerts.thresholdReminder');
      default:
        return t('alerts.generalReminder');
    }
  };

  const getReminderTypeIcon = (type: ReminderType): keyof typeof Icon.glyphMap => {
    switch (type) {
      case 'TRANSACTION':
        return 'schedule';
      case 'THRESHOLD':
        return 'trending-up';
      default:
        return 'notifications';
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <View style={[styles.container(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText(colors)}>{t('alerts.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container(colors)}>
      <View style={styles.header(colors)}>
        <Text style={[styles.headerTitle(colors), isRTL && styles.headerTitleRTL]}>
          {t('alerts.title')}
        </Text>
        <TouchableOpacity style={styles.addButton(colors)} onPress={openAddModal}>
          <Icon name="add" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Active Alerts */}
        <View style={styles.section(colors)}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
              {t('alerts.activeAlerts')}
            </Text>
            {alerts.length > 0 && (
              <TouchableOpacity onPress={handleMarkAllAsRead}>
                <Text style={styles.markAllText(colors)}>{t('alerts.markAllRead')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="notifications-none" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText(colors)}>{t('alerts.noAlerts')}</Text>
            </View>
          ) : (
            alerts.map((alert) => {
              const alertColor = getAlertColor(alert.type);
              return (
                <TouchableOpacity
                  key={alert.id}
                  style={[styles.alertItem(colors), isRTL && styles.alertItemRTL]}
                  onPress={() => handleMarkAsRead(alert.id)}
                >
                  <View style={[styles.alertDot, { backgroundColor: alertColor }]} />
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertMessage(colors), isRTL && styles.textRTL]}>
                      {alert.message}
                    </Text>
                    <Text style={[styles.alertTime(colors), isRTL && styles.textRTL]}>
                      {formatTimeAgo(alert.createdAt)}
                    </Text>
                  </View>
                  <Icon name={getIconName(alert.type)} size={24} color={alertColor} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Reminders */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
            {t('alerts.reminders')}
          </Text>
          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="event" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText(colors)}>{t('alerts.noReminders')}</Text>
              <TouchableOpacity style={styles.addReminderButton(colors)} onPress={openAddModal}>
                <Icon name="add" size={20} color={colors.primary} />
                <Text style={styles.addReminderButtonText(colors)}>{t('alerts.addReminder')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reminders.map((reminder) => (
              <TouchableOpacity
                key={reminder.id}
                style={[styles.reminderItem(colors), isRTL && styles.reminderItemRTL]}
                onPress={() => openEditModal(reminder)}
              >
                <View style={styles.reminderIconContainer(colors)}>
                  <Icon
                    name={getReminderTypeIcon(reminder.reminderType || 'GENERAL')}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.reminderContent}>
                  <Text style={[styles.reminderTitle(colors), isRTL && styles.textRTL]}>
                    {reminder.title}
                  </Text>
                  {reminder.description && (
                    <Text style={[styles.reminderDescription(colors), isRTL && styles.textRTL]}>
                      {reminder.description}
                    </Text>
                  )}
                  <View style={[styles.reminderMeta, isRTL && styles.reminderMetaRTL]}>
                    <Text style={styles.reminderType(colors)}>
                      {getReminderTypeLabel(reminder.reminderType || 'GENERAL')}
                    </Text>
                    <Text style={styles.reminderDate(colors)}>
                      {t('alerts.due')}: {formatDueDate(reminder.dueDate)}
                    </Text>
                  </View>
                  {reminder.reminderType === 'THRESHOLD' && reminder.thresholdAmount && (
                    <Text style={styles.reminderThreshold(colors)}>
                      {t('alerts.thresholdAmount')}: ${reminder.thresholdAmount}
                    </Text>
                  )}
                  {reminder.reminderType === 'TRANSACTION' && reminder.transactionAmount && (
                    <Text style={styles.reminderThreshold(colors)}>
                      {reminder.transactionType}: ${reminder.transactionAmount}
                    </Text>
                  )}
                </View>
                <View style={styles.reminderActions}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox(colors),
                      reminder.completed && styles.checkboxCompleted(colors),
                    ]}
                    onPress={() => handleToggleReminder(reminder.id)}
                  >
                    {reminder.completed && <Icon name="check" size={16} color={colors.textInverse} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteReminder(reminder.id)}
                  >
                    <Icon name="delete-outline" size={20} color={colors.expense} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Alert Settings */}
        {settings && (
          <View style={styles.section(colors)}>
            <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
              {t('alerts.alertSettings')}
            </Text>
            <View style={[styles.settingItem(colors), isRTL && styles.settingItemRTL]}>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel(colors), isRTL && styles.textRTL]}>
                  {t('alerts.pushNotifications')}
                </Text>
                <Text style={[styles.settingDescription(colors), isRTL && styles.textRTL]}>
                  {t('alerts.pushNotificationsDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle(colors), settings.pushNotifications && styles.toggleActive(colors)]}
                onPress={() => handleToggleSetting('pushNotifications', !settings.pushNotifications)}
              >
                <View
                  style={[
                    styles.toggleCircle(colors),
                    settings.pushNotifications && styles.toggleCircleActive(colors),
                  ]}
                />
              </TouchableOpacity>
            </View>
            <View style={[styles.settingItem(colors), isRTL && styles.settingItemRTL]}>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel(colors), isRTL && styles.textRTL]}>
                  {t('alerts.emailNotifications')}
                </Text>
                <Text style={[styles.settingDescription(colors), isRTL && styles.textRTL]}>
                  {t('alerts.emailNotificationsDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle(colors), settings.emailNotifications && styles.toggleActive(colors)]}
                onPress={() => handleToggleSetting('emailNotifications', !settings.emailNotifications)}
              >
                <View
                  style={[
                    styles.toggleCircle(colors),
                    settings.emailNotifications && styles.toggleCircleActive(colors),
                  ]}
                />
              </TouchableOpacity>
            </View>
            <View style={[styles.settingItem(colors), isRTL && styles.settingItemRTL]}>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel(colors), isRTL && styles.textRTL]}>
                  {t('alerts.expenseThresholdAlert')}
                </Text>
                <Text style={[styles.settingDescription(colors), isRTL && styles.textRTL]}>
                  {t('alerts.expenseThresholdAlertDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle(colors), settings.expenseThresholdAlert && styles.toggleActive(colors)]}
                onPress={() => handleToggleSetting('expenseThresholdAlert', !settings.expenseThresholdAlert)}
              >
                <View
                  style={[
                    styles.toggleCircle(colors),
                    settings.expenseThresholdAlert && styles.toggleCircleActive(colors),
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Reminder Modal */}
      <Modal
        visible={showAddReminderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent(colors)}>
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={styles.modalTitle(colors)}>
                {editingReminder ? t('alerts.editReminder') : t('alerts.addReminder')}
              </Text>
              <TouchableOpacity onPress={() => setShowAddReminderModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Reminder Type Selection */}
              <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                {t('alerts.reminderType')}
              </Text>
              <View style={[styles.typeSelector, isRTL && styles.typeSelectorRTL]}>
                {(['GENERAL', 'TRANSACTION', 'THRESHOLD'] as ReminderType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption(colors),
                      reminderType === type && styles.typeOptionActive(colors),
                    ]}
                    onPress={() => setReminderType(type)}
                  >
                    <Icon
                      name={getReminderTypeIcon(type)}
                      size={20}
                      color={reminderType === type ? colors.textInverse : colors.primary}
                    />
                    <Text
                      style={[
                        styles.typeOptionText(colors),
                        reminderType === type && styles.typeOptionTextActive,
                      ]}
                    >
                      {getReminderTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                {t('alerts.reminderTitle')}
              </Text>
              <TextInput
                style={[styles.input(colors), isRTL && styles.inputRTL]}
                placeholder={t('alerts.reminderTitlePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={reminderTitle}
                onChangeText={setReminderTitle}
                textAlign={isRTL ? 'right' : 'left'}
              />

              {/* Description */}
              <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                {t('alerts.reminderDescription')}
              </Text>
              <TextInput
                style={[styles.input(colors), styles.textArea, isRTL && styles.inputRTL]}
                placeholder={t('alerts.reminderDescriptionPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={reminderDescription}
                onChangeText={setReminderDescription}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? 'right' : 'left'}
              />

              {/* Due Date */}
              <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                {t('alerts.dueDate')}
              </Text>
              <TouchableOpacity
                style={[styles.dateButton(colors), isRTL && styles.dateButtonRTL]}
                onPress={() => {
                  setTempDate(reminderDueDate);
                  setShowDatePickerModal(true);
                }}
              >
                <Icon name="event" size={20} color={colors.primary} />
                <Text style={styles.dateButtonText(colors)}>
                  {reminderDueDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {/* Transaction Type Fields */}
              {reminderType === 'TRANSACTION' && (
                <>
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('add.categoryType')}
                  </Text>
                  <View style={[styles.transactionTypeSelector, isRTL && styles.transactionTypeSelectorRTL]}>
                    <TouchableOpacity
                      style={[
                        styles.transactionTypeOption(colors),
                        transactionType === 'INCOME' && styles.transactionTypeOptionActiveIncome(colors),
                      ]}
                      onPress={() => setTransactionType('INCOME')}
                    >
                      <Text
                        style={[
                          styles.transactionTypeText(colors),
                          transactionType === 'INCOME' && styles.transactionTypeTextActive,
                        ]}
                      >
                        {t('alerts.incomeTransaction')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.transactionTypeOption(colors),
                        transactionType === 'EXPENSE' && styles.transactionTypeOptionActiveExpense(colors),
                      ]}
                      onPress={() => setTransactionType('EXPENSE')}
                    >
                      <Text
                        style={[
                          styles.transactionTypeText(colors),
                          transactionType === 'EXPENSE' && styles.transactionTypeTextActive,
                        ]}
                      >
                        {t('alerts.expenseTransaction')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('alerts.transactionAmount')}
                  </Text>
                  <TextInput
                    style={[styles.input(colors), isRTL && styles.inputRTL]}
                    placeholder={t('alerts.transactionAmountPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={transactionAmount}
                    onChangeText={setTransactionAmount}
                    keyboardType="numeric"
                    textAlign={isRTL ? 'right' : 'left'}
                  />

                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('alerts.selectCategory')}
                  </Text>
                  <View style={styles.categoryGrid}>
                    {categories
                      .filter((c) => c.type === transactionType)
                      .map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryChip(colors),
                            selectedCategoryId === cat.id && styles.categoryChipActive(colors),
                          ]}
                          onPress={() => setSelectedCategoryId(cat.id)}
                        >
                          <Text
                            style={[
                              styles.categoryChipText(colors),
                              selectedCategoryId === cat.id && styles.categoryChipTextActive,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </>
              )}

              {/* Threshold Fields */}
              {reminderType === 'THRESHOLD' && (
                <>
                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('alerts.selectCategory')}
                  </Text>
                  <View style={styles.categoryGrid}>
                    {expenseCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip(colors),
                          selectedCategoryId === cat.id && styles.categoryChipActive(colors),
                        ]}
                        onPress={() => setSelectedCategoryId(cat.id)}
                      >
                        <Text
                          style={[
                            styles.categoryChipText(colors),
                            selectedCategoryId === cat.id && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel(colors), isRTL && styles.textRTL]}>
                    {t('alerts.thresholdAmount')}
                  </Text>
                  <TextInput
                    style={[styles.input(colors), isRTL && styles.inputRTL]}
                    placeholder={t('alerts.thresholdAmountPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={thresholdAmount}
                    onChangeText={setThresholdAmount}
                    keyboardType="numeric"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton(colors)]}
                onPress={() => setShowAddReminderModal(false)}
              >
                <Text style={styles.cancelButtonText(colors)}>{t('app.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton(colors), saving && styles.saveButtonDisabled]}
                onPress={handleSaveReminder}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingReminder ? t('alerts.updateReminder') : t('alerts.createReminder')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePickerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModalContent(colors)}>
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={styles.modalTitle(colors)}>{t('alerts.selectDate')}</Text>
              <TouchableOpacity onPress={() => setShowDatePickerModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerContainer}>
              {/* Year Selector */}
              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel(colors)}>Year</Text>
                <View style={styles.datePickerControls}>
                  <TouchableOpacity
                    style={styles.datePickerButton(colors)}
                    onPress={() => {
                      const newDate = new Date(tempDate);
                      newDate.setFullYear(newDate.getFullYear() - 1);
                      setTempDate(newDate);
                    }}
                  >
                    <Icon name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.datePickerValue(colors)}>
                    {tempDate.getFullYear()}
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerButton(colors)}
                    onPress={() => {
                      const newDate = new Date(tempDate);
                      newDate.setFullYear(newDate.getFullYear() + 1);
                      setTempDate(newDate);
                    }}
                  >
                    <Icon name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Month Selector */}
              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel(colors)}>Month</Text>
                <View style={styles.datePickerControls}>
                  <TouchableOpacity
                    style={styles.datePickerButton(colors)}
                    onPress={() => {
                      const newDate = new Date(tempDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setTempDate(newDate);
                    }}
                  >
                    <Icon name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.datePickerValue(colors)}>
                    {tempDate.toLocaleDateString('en-US', { month: 'long' })}
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerButton(colors)}
                    onPress={() => {
                      const newDate = new Date(tempDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setTempDate(newDate);
                    }}
                  >
                    <Icon name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Day Selector */}
              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel(colors)}>Day</Text>
                <View style={styles.datePickerControls}>
                  <TouchableOpacity
                    style={styles.datePickerButton(colors)}
                    onPress={() => {
                      const newDate = new Date(tempDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setTempDate(newDate);
                    }}
                  >
                    <Icon name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.datePickerValue(colors)}>
                    {tempDate.getDate()}
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerButton(colors)}
                    onPress={() => {
                      const newDate = new Date(tempDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setTempDate(newDate);
                    }}
                  >
                    <Icon name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton(colors)}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Text style={styles.modalCancelButtonText(colors)}>{t('app.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton(colors)}
                onPress={() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const selected = new Date(tempDate);
                  selected.setHours(0, 0, 0, 0);
                  
                  if (selected < today) {
                    Alert.alert(t('app.error'), 'Please select a future date');
                    return;
                  }
                  
                  setReminderDueDate(tempDate);
                  setShowDatePickerModal(false);
                }}
              >
                <Text style={styles.modalSaveButtonText}>{t('app.ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: (colors: any) => ({
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.primary,
    padding: 16,
    paddingTop: 50,
  }),
  headerTitle: (colors: any) => ({
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.textInverse,
  }),
  headerTitleRTL: {
    textAlign: 'right' as const,
  },
  addButton: (colors: any) => ({
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  }),
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
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse' as const,
  },
  sectionTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  markAllText: (colors: any) => ({
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  }),
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 24,
  },
  emptyText: (colors: any) => ({
    textAlign: 'center' as const,
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  }),
  addReminderButton: (colors: any) => ({
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
  addReminderButtonText: (colors: any) => ({
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  }),
  alertItem: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  }),
  alertItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
  alertDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: (colors: any) => ({
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  }),
  alertTime: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
  }),
  textRTL: {
    textAlign: 'right' as const,
  },
  reminderItem: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  }),
  reminderItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
  reminderIconContainer: (colors: any) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }),
  reminderContent: {
    flex: 1,
  },
  reminderTitle: (colors: any) => ({
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 4,
  }),
  reminderDescription: (colors: any) => ({
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  }),
  reminderMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 4,
  },
  reminderMetaRTL: {
    flexDirection: 'row-reverse' as const,
  },
  reminderType: (colors: any) => ({
    fontSize: 12,
    color: colors.primary,
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  }),
  reminderDate: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
  }),
  reminderThreshold: (colors: any) => ({
    fontSize: 12,
    color: colors.income,
    marginTop: 4,
    fontWeight: '600' as const,
  }),
  reminderActions: {
    alignItems: 'center' as const,
    gap: 8,
  },
  checkbox: (colors: any) => ({
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }),
  checkboxCompleted: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  deleteButton: {
    padding: 4,
  },
  settingItem: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
  }),
  settingItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: (colors: any) => ({
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  }),
  settingDescription: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
  }),
  toggle: (colors: any) => ({
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center' as const,
    padding: 2,
  }),
  toggleActive: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  toggleCircle: (colors: any) => ({
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
  }),
  toggleCircleActive: (colors: any) => ({
    alignSelf: 'flex-end' as const,
  }),
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
    maxHeight: 600,
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
    maxHeight: 450,
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
    marginTop: 12,
  }),
  input: (colors: any) => ({
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.inputBackground,
    color: colors.text,
  }),
  inputRTL: {
    textAlign: 'right' as const,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top' as const,
  },
  typeSelector: {
    flexDirection: 'row' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  typeSelectorRTL: {
    flexDirection: 'row-reverse' as const,
  },
  typeOption: (colors: any) => ({
    flex: 1,
    minWidth: 100,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    gap: 4,
  }),
  typeOptionActive: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  typeOptionText: (colors: any) => ({
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600' as const,
  }),
  typeOptionTextActive: {
    color: '#fff',
  },
  transactionTypeSelector: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  transactionTypeSelectorRTL: {
    flexDirection: 'row-reverse' as const,
  },
  transactionTypeOption: (colors: any) => ({
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
  }),
  transactionTypeOptionActiveIncome: (colors: any) => ({
    backgroundColor: colors.income,
    borderColor: colors.income,
  }),
  transactionTypeOptionActiveExpense: (colors: any) => ({
    backgroundColor: colors.expense,
    borderColor: colors.expense,
  }),
  transactionTypeText: (colors: any) => ({
    fontSize: 14,
    color: colors.text,
    fontWeight: '600' as const,
  }),
  transactionTypeTextActive: {
    color: '#fff',
  },
  dateButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    gap: 8,
  }),
  dateButtonRTL: {
    flexDirection: 'row-reverse' as const,
  },
  dateButtonText: (colors: any) => ({
    fontSize: 16,
    color: colors.text,
  }),
  categoryGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  categoryChip: (colors: any) => ({
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  }),
  categoryChipActive: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  categoryChipText: (colors: any) => ({
    fontSize: 14,
    color: colors.primary,
  }),
  categoryChipTextActive: {
    color: '#fff',
  },
  cancelButton: (colors: any) => ({
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
  }),
  cancelButtonText: (colors: any) => ({
    fontSize: 16,
    color: colors.text,
    fontWeight: '600' as const,
  }),
  saveButton: (colors: any) => ({
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center' as const,
  }),
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
  // Date Picker Modal styles
  datePickerModalContent: (colors: any) => ({
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 400,
  }),
  datePickerContainer: {
    padding: 20,
  },
  datePickerSection: {
    marginBottom: 24,
  },
  datePickerLabel: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    marginBottom: 12,
  }),
  datePickerControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 16,
  },
  datePickerButton: (colors: any) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }),
  datePickerValue: (colors: any) => ({
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.text,
    minWidth: 120,
    textAlign: 'center' as const,
  }),
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
  modalSaveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
};
