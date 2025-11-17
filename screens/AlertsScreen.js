import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function AlertsScreen() {
  const alerts = [
    {
      id: 1,
      type: 'warning',
      message: 'Payment due tomorrow for supplier invoice',
      time: '2 hours ago',
      color: '#FFC107',
    },
    {
      id: 2,
      type: 'error',
      message: 'Expense threshold exceeded this week',
      time: '5 hours ago',
      color: '#F44336',
    },
    {
      id: 3,
      type: 'info',
      message: 'Monthly report is ready for review',
      time: '1 day ago',
      color: '#2196F3',
    },
    {
      id: 4,
      type: 'success',
      message: 'Income target achieved for this month',
      time: '2 days ago',
      color: '#4CAF50',
    },
  ];

  const reminders = [
    {
      id: 1,
      title: 'Harvest Season Reminder',
      description: 'Prepare for upcoming harvest season',
      date: '2024-01-15',
      completed: false,
    },
    {
      id: 2,
      title: 'Equipment Maintenance',
      description: 'Schedule maintenance for farm equipment',
      date: '2024-01-20',
      completed: false,
    },
    {
      id: 3,
      title: 'Tax Filing Deadline',
      description: 'Quarterly tax filing due soon',
      date: '2024-01-31',
      completed: false,
    },
  ];

  const getIconName = (type) => {
    switch (type) {
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'info':
        return 'info';
      case 'success':
        return 'check-circle';
      default:
        return 'notifications';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminders & Alerts</Text>
      </View>

      {/* Active Alerts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Alerts</Text>
        {alerts.map((alert) => (
          <View key={alert.id} style={styles.alertItem}>
            <View style={[styles.alertDot, { backgroundColor: alert.color }]} />
            <View style={styles.alertContent}>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <Text style={styles.alertTime}>{alert.time}</Text>
            </View>
            <Icon name={getIconName(alert.type)} size={24} color={alert.color} />
          </View>
        ))}
      </View>

      {/* Reminders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        {reminders.map((reminder) => (
          <TouchableOpacity key={reminder.id} style={styles.reminderItem}>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>{reminder.title}</Text>
              <Text style={styles.reminderDescription}>{reminder.description}</Text>
              <Text style={styles.reminderDate}>Due: {reminder.date}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.checkbox,
                reminder.completed && styles.checkboxCompleted,
              ]}
            >
              {reminder.completed && (
                <Icon name="check" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alert Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Settings</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Text style={styles.settingDescription}>Receive alerts on your device</Text>
          </View>
          <TouchableOpacity style={styles.toggle}>
            <View style={[styles.toggleCircle, styles.toggleActive]} />
          </TouchableOpacity>
        </View>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Email Notifications</Text>
            <Text style={styles.settingDescription}>Receive alerts via email</Text>
          </View>
          <TouchableOpacity style={styles.toggle}>
            <View style={styles.toggleCircle} />
          </TouchableOpacity>
        </View>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Expense Threshold Alert</Text>
            <Text style={styles.settingDescription}>Alert when expenses exceed limit</Text>
          </View>
          <TouchableOpacity style={styles.toggle}>
            <View style={[styles.toggleCircle, styles.toggleActive]} />
          </TouchableOpacity>
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

