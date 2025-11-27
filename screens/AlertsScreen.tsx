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
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { alertApi, reminderApi, settingsApi } from '../src/services/api.service';
import { Alert as AlertType, Reminder } from '../src/types';

export default function AlertsScreen(): React.JSX.Element {
  const { isAuthenticated, settings, updateSettings } = useUser();
  const { isRTL } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const [alertsData, remindersData] = await Promise.all([
        alertApi.getAll(false), // Get unread alerts
        reminderApi.getAll(false), // Get incomplete reminders
      ]);

      setAlerts(alertsData);
      setReminders(remindersData);
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

  const getIconName = (type: string): string => {
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

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await alertApi.markAsRead(alertId);
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Error marking alert as read:', error);
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

  const handleToggleSetting = async (key: keyof typeof settings, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <View style={[styles.container(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText(colors)}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container(colors)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header(colors)}>
        <Text style={[styles.headerTitle(colors), isRTL && styles.headerTitleRTL]}>Reminders & Alerts</Text>
      </View>

      {/* Active Alerts */}
      <View style={styles.section(colors)}>
        <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>Active Alerts</Text>
        {alerts.length === 0 ? (
          <Text style={styles.emptyText(colors)}>No active alerts</Text>
        ) : (
          alerts.map((alert) => {
            const color = getAlertColor(alert.type);
            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertItem(colors), isRTL && styles.alertItemRTL]}
                onPress={() => handleMarkAsRead(alert.id)}
              >
                <View style={[styles.alertDot, { backgroundColor: color }]} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertMessage(colors)}>{alert.message}</Text>
                  <Text style={styles.alertTime(colors)}>{formatTimeAgo(alert.createdAt)}</Text>
                </View>
                <Icon name={getIconName(alert.type)} size={24} color={color} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Reminders */}
      <View style={styles.section(colors)}>
        <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>Reminders</Text>
        {reminders.length === 0 ? (
          <Text style={styles.emptyText(colors)}>No reminders</Text>
        ) : (
          reminders.map((reminder) => (
            <TouchableOpacity
              key={reminder.id}
              style={[styles.reminderItem(colors), isRTL && styles.reminderItemRTL]}
              onPress={() => handleToggleReminder(reminder.id)}
            >
              <View style={styles.reminderContent}>
                <Text style={styles.reminderTitle(colors)}>{reminder.title}</Text>
                {reminder.description && (
                  <Text style={styles.reminderDescription(colors)}>{reminder.description}</Text>
                )}
                <Text style={styles.reminderDate(colors)}>
                  Due: {new Date(reminder.dueDate).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.checkbox(colors), reminder.completed && styles.checkboxCompleted(colors)]}
                onPress={() => handleToggleReminder(reminder.id)}
              >
                {reminder.completed && <Icon name="check" size={20} color={colors.textInverse} />}
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Alert Settings */}
      {settings && (
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>Alert Settings</Text>
          <View style={[styles.settingItem(colors), isRTL && styles.settingItemRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>Push Notifications</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>Receive alerts on your device</Text>
            </View>
            <TouchableOpacity
              style={styles.toggle(colors)}
              onPress={() => handleToggleSetting('pushNotifications', !settings.pushNotifications)}
            >
              <View
                style={[
                  styles.toggleCircle(colors),
                  settings.pushNotifications && styles.toggleActive(colors),
                ]}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.settingItem(colors), isRTL && styles.settingItemRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>Email Notifications</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>Receive alerts via email</Text>
            </View>
            <TouchableOpacity
              style={styles.toggle(colors)}
              onPress={() => handleToggleSetting('emailNotifications', !settings.emailNotifications)}
            >
              <View
                style={[styles.toggleCircle(colors), settings.emailNotifications && styles.toggleActive(colors)]}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.settingItem(colors), isRTL && styles.settingItemRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>Expense Threshold Alert</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>Alert when expenses exceed limit</Text>
            </View>
            <TouchableOpacity
              style={styles.toggle(colors)}
              onPress={() =>
                handleToggleSetting('expenseThresholdAlert', !settings.expenseThresholdAlert)
              }
            >
              <View
                style={[
                  styles.toggleCircle(colors),
                  settings.expenseThresholdAlert && styles.toggleActive(colors),
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
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
  emptyText: (colors: any) => ({
    textAlign: 'center' as const,
    color: colors.textSecondary,
    fontSize: 14,
    padding: 20,
  }),
  header: (colors: any) => ({
    backgroundColor: colors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  }),
  headerTitle: (colors: any) => ({
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text,
  }),
  headerTitleRTL: {
    textAlign: 'right' as const,
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
    marginBottom: 16,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
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
  reminderItem: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  }),
  reminderItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
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
  reminderDate: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
  }),
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
  settingLabelRTL: {
    textAlign: 'right' as const,
  },
  settingDescription: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
  }),
  settingDescriptionRTL: {
    textAlign: 'right' as const,
  },
  toggle: (colors: any) => ({
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center' as const,
    padding: 2,
  }),
  toggleCircle: (colors: any) => ({
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
  }),
  toggleActive: (colors: any) => ({
    alignSelf: 'flex-end' as const,
    backgroundColor: colors.primary,
  }),
};

