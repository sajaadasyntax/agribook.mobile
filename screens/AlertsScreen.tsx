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
import { alertApi, reminderApi, settingsApi } from '../src/services/api.service';
import { Alert as AlertType, Reminder } from '../src/types';

export default function AlertsScreen(): JSX.Element {
  const { isAuthenticated, settings, updateSettings } = useUser();
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
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminders & Alerts</Text>
      </View>

      {/* Active Alerts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Alerts</Text>
        {alerts.length === 0 ? (
          <Text style={styles.emptyText}>No active alerts</Text>
        ) : (
          alerts.map((alert) => {
            const color = getAlertColor(alert.type);
            return (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertItem}
                onPress={() => handleMarkAsRead(alert.id)}
              >
                <View style={[styles.alertDot, { backgroundColor: color }]} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  <Text style={styles.alertTime}>{formatTimeAgo(alert.createdAt)}</Text>
                </View>
                <Icon name={getIconName(alert.type)} size={24} color={color} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Reminders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        {reminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders</Text>
        ) : (
          reminders.map((reminder) => (
            <TouchableOpacity
              key={reminder.id}
              style={styles.reminderItem}
              onPress={() => handleToggleReminder(reminder.id)}
            >
              <View style={styles.reminderContent}>
                <Text style={styles.reminderTitle}>{reminder.title}</Text>
                {reminder.description && (
                  <Text style={styles.reminderDescription}>{reminder.description}</Text>
                )}
                <Text style={styles.reminderDate}>
                  Due: {new Date(reminder.dueDate).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.checkbox, reminder.completed && styles.checkboxCompleted]}
                onPress={() => handleToggleReminder(reminder.id)}
              >
                {reminder.completed && <Icon name="check" size={20} color="#fff" />}
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Alert Settings */}
      {settings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Settings</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>Receive alerts on your device</Text>
            </View>
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => handleToggleSetting('pushNotifications', !settings.pushNotifications)}
            >
              <View
                style={[
                  styles.toggleCircle,
                  settings.pushNotifications && styles.toggleActive,
                ]}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Text style={styles.settingDescription}>Receive alerts via email</Text>
            </View>
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => handleToggleSetting('emailNotifications', !settings.emailNotifications)}
            >
              <View
                style={[styles.toggleCircle, settings.emailNotifications && styles.toggleActive]}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Expense Threshold Alert</Text>
              <Text style={styles.settingDescription}>Alert when expenses exceed limit</Text>
            </View>
            <TouchableOpacity
              style={styles.toggle}
              onPress={() =>
                handleToggleSetting('expenseThresholdAlert', !settings.expenseThresholdAlert)
              }
            >
              <View
                style={[
                  styles.toggleCircle,
                  settings.expenseThresholdAlert && styles.toggleActive,
                ]}
              />
            </TouchableOpacity>
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
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 20,
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
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  alertDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    color: '#666',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reminderDate: {
    fontSize: 12,
    color: '#999',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#4CAF50',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    padding: 2,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  toggleActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
  },
});

