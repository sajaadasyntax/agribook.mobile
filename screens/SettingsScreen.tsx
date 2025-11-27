import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import syncService from '../src/services/sync.service';
import { transactionApi, categoryApi, alertApi, reminderApi } from '../src/services/api.service';

export default function SettingsScreen(): JSX.Element {
  const { user, settings, updateSettings, isLoading } = useUser();
  const { t, setLocale, isRTL, locale } = useI18n();
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [language, setLanguage] = useState<'en' | 'ar'>(locale as 'en' | 'ar');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // Check biometric availability and sync status on mount
  useEffect(() => {
    checkBiometricAvailability();
    checkSyncStatus();
    
    // Listen for connectivity changes
    const unsubscribe = syncService.addConnectivityListener((online) => {
      setIsOnline(online);
      // Auto-sync when coming back online if autoSync is enabled
      if (online && settings?.autoSync) {
        handleManualSync();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (settings) {
      const lang = (settings.language as 'en' | 'ar') || 'en';
      setLanguage(lang);
    }
  }, [settings]);

  const checkSyncStatus = async (): Promise<void> => {
    try {
      const online = await syncService.checkNetworkStatus();
      setIsOnline(online);
      
      const pending = await syncService.getPendingCount();
      setPendingCount(pending);
      
      const syncTime = await syncService.getLastSyncTime();
      setLastSyncTime(syncTime);
      
      const backupTime = await syncService.getBackupTime();
      setLastBackupTime(backupTime);
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  };

  const checkBiometricAvailability = async (): Promise<void> => {
    try {
      // Check if device has biometric hardware
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setBiometricAvailable(false);
        return;
      }

      // Check if biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setBiometricAvailable(false);
        return;
      }

      setBiometricAvailable(true);

      // Get supported biometric types
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Fingerprint');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType('Iris');
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setBiometricAvailable(false);
    }
  };

  const handleBiometricToggle = async (): Promise<void> => {
    // If currently enabled, just disable it
    if (settings?.fingerprintEnabled) {
      try {
        await updateSettings({ fingerprintEnabled: false });
        Alert.alert(t('app.success'), t('settings.biometricDisabled'));
      } catch (error) {
        console.error('Error disabling biometric:', error);
        Alert.alert(t('app.error'), t('settings.errorUpdating'));
      }
      return;
    }

    // Check if biometrics are available
    if (!biometricAvailable) {
      Alert.alert(
        t('settings.biometricUnavailable'),
        t('settings.biometricUnavailableDesc'),
        [{ text: t('app.ok') }]
      );
      return;
    }

    // Authenticate with biometrics before enabling
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('settings.biometricPrompt'),
        cancelLabel: t('app.cancel'),
        disableDeviceFallback: false,
        fallbackLabel: t('settings.usePasscode'),
      });

      if (result.success) {
        await updateSettings({ fingerprintEnabled: true });
        Alert.alert(t('app.success'), t('settings.biometricEnabled'));
      } else if (result.error === 'user_cancel') {
        // User cancelled, do nothing
      } else {
        Alert.alert(t('app.error'), t('settings.biometricFailed'));
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
  };

  const pinInputRefs = React.useRef<Array<TextInput | null>>([]);

  const handlePinChange = (index: number, value: string): void => {
    if (value.length <= 1) {
      const newPin = [...pin];
      newPin[index] = value;
      setPin(newPin);
      
      // Auto-focus to next input
      if (value.length === 1 && index < 3) {
        pinInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePinKeyPress = (index: number, key: string): void => {
    // Handle backspace to go to previous input
    if (key === 'Backspace' && pin[index] === '' && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handleSavePin = async (): Promise<void> => {
    const pinString = pin.join('');
    if (pinString.length < 4) {
      Alert.alert(t('app.error'), t('settings.pinMustBeFour'));
      return;
    }

    try {
      setSaving(true);
      await updateSettings({ pin: pinString, pinEnabled: true });
      Alert.alert(t('app.success'), t('settings.pinSaved'));
      setPin(['', '', '', '']);
    } catch (error) {
      console.error('Error saving PIN:', error);
      Alert.alert(t('app.error'), t('settings.errorSavingPin'));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePinLock = async (): Promise<void> => {
    // If trying to enable lock but no PIN has been saved
    if (!settings?.pinEnabled) {
      // Check if user has a PIN saved (we don't store the actual PIN client-side for security)
      // Just prompt them to set one first
      Alert.alert(
        t('settings.enableLock'),
        t('settings.setPin'),
        [{ text: t('app.ok') }]
      );
      return;
    }
    
    // Disabling the lock
    try {
      await updateSettings({ pinEnabled: false });
      Alert.alert(t('app.success'), t('settings.lockDisabled'));
    } catch (error) {
      console.error('Error disabling lock:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
  };

  const handleToggleSetting = async (key: string, value: boolean): Promise<void> => {
    try {
      await updateSettings({ [key]: value } as any);
      // Show subtle feedback for successful toggle
      console.log(`Setting ${key} updated to ${value}`);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
  };

  const handleToggleOfflineMode = async (value: boolean): Promise<void> => {
    try {
      await updateSettings({ offlineMode: value });
      
      if (value) {
        // Enabling offline mode - cache current data
        Alert.alert(
          t('settings.offlineMode'),
          t('settings.offlineModeEnabledDesc'),
          [{ text: t('app.ok') }]
        );
      } else {
        // Disabling offline mode - check for pending data
        const pending = await syncService.getPendingCount();
        if (pending > 0 && settings?.autoSync) {
          // Sync pending data
          handleManualSync();
        }
      }
    } catch (error) {
      console.error('Error toggling offline mode:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
  };

  const handleToggleAutoSync = async (value: boolean): Promise<void> => {
    try {
      await updateSettings({ autoSync: value });
      
      if (value) {
        Alert.alert(
          t('settings.autoSync'),
          t('settings.autoSyncEnabledDesc'),
          [{ text: t('app.ok') }]
        );
        
        // If online and has pending data, sync now
        if (isOnline && pendingCount > 0) {
          handleManualSync();
        }
      }
    } catch (error) {
      console.error('Error toggling auto sync:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
  };

  const handleManualSync = async (): Promise<void> => {
    if (!isOnline) {
      Alert.alert(t('app.error'), t('settings.offlineCannotSync'));
      return;
    }

    try {
      setSyncing(true);
      
      // Sync pending transactions
      const pendingTransactions = await syncService.getPendingTransactions();
      
      for (const transaction of pendingTransactions) {
        try {
          await transactionApi.create({
            type: transaction.type,
            amount: transaction.amount,
            categoryId: transaction.categoryId,
            description: transaction.description,
          });
        } catch (error) {
          console.error('Error syncing transaction:', error);
        }
      }
      
      // Clear pending after successful sync
      await syncService.clearPendingTransactions();
      
      // Update cache with fresh data
      const [transactionsResponse, categories, alerts, reminders] = await Promise.all([
        transactionApi.getAll({ limit: 100 }),
        categoryApi.getAll(),
        alertApi.getAll(),
        reminderApi.getAll(),
      ]);
      
      await Promise.all([
        syncService.cacheTransactions(transactionsResponse.data),
        syncService.cacheCategories(categories),
        syncService.cacheAlerts(alerts),
        syncService.cacheReminders(reminders),
      ]);
      
      // Update sync time
      await syncService.updateLastSyncTime();
      
      // Refresh status
      await checkSyncStatus();
      
      Alert.alert(t('app.success'), t('settings.syncComplete'));
    } catch (error) {
      console.error('Error syncing:', error);
      Alert.alert(t('app.error'), t('settings.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAutoBackup = async (value: boolean): Promise<void> => {
    try {
      await updateSettings({ autoBackup: value });
      
      if (value) {
        Alert.alert(
          t('settings.autoBackup'),
          t('settings.autoBackupEnabledDesc'),
          [{ text: t('app.ok') }]
        );
        
        // Create initial backup
        handleManualBackup();
      }
    } catch (error) {
      console.error('Error toggling auto backup:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
  };

  const handleManualBackup = async (): Promise<void> => {
    try {
      setBackingUp(true);
      
      // Get all current data
      const [transactionsResponse, categories, alerts, reminders] = await Promise.all([
        transactionApi.getAll({ limit: 1000 }),
        categoryApi.getAll(),
        alertApi.getAll(),
        reminderApi.getAll(),
      ]);
      
      // Create backup
      await syncService.createBackup({
        transactions: transactionsResponse.data,
        categories,
        alerts,
        reminders,
      });
      
      // Refresh status
      await checkSyncStatus();
      
      Alert.alert(t('app.success'), t('settings.backupComplete'));
    } catch (error) {
      console.error('Error creating backup:', error);
      Alert.alert(t('app.error'), t('settings.backupFailed'));
    } finally {
      setBackingUp(false);
    }
  };

  const formatLastTime = (isoString: string | null): string => {
    if (!isoString) return t('settings.never');
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return t('settings.justNow');
    if (diffMins < 60) return t('alerts.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('alerts.hoursAgo', { count: diffHours });
    return t('alerts.daysAgo', { count: diffDays });
  };

  const handleLanguageChange = async (lang: 'en' | 'ar'): Promise<void> => {
    try {
      await setLocale(lang);
      setLanguage(lang);
    } catch (error) {
      console.error('Error updating language:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdatingLanguage'));
    }
  };

  if (isLoading || !settings) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('settings.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Offline & Sync Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.offlineSync')}</Text>
            <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
              <Icon name={isOnline ? 'cloud-done' : 'cloud-off'} size={14} color="#fff" />
              <Text style={styles.statusBadgeText}>
                {isOnline ? t('settings.online') : t('settings.offline')}
              </Text>
            </View>
          </View>
          
          {pendingCount > 0 && (
            <View style={styles.pendingBanner}>
              <Icon name="sync-problem" size={20} color="#FF9800" />
              <Text style={styles.pendingText}>
                {t('settings.pendingItems', { count: pendingCount })}
              </Text>
            </View>
          )}
          
          <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, isRTL && styles.settingLabelRTL]}>{t('settings.offlineMode')}</Text>
              <Text style={[styles.settingDescription, isRTL && styles.settingDescriptionRTL]}>{t('settings.offlineModeDesc')}</Text>
            </View>
            <Switch
              value={settings.offlineMode}
              onValueChange={handleToggleOfflineMode}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={settings.offlineMode ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
          
          <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, isRTL && styles.settingLabelRTL]}>{t('settings.autoSync')}</Text>
              <Text style={[styles.settingDescription, isRTL && styles.settingDescriptionRTL]}>{t('settings.autoSyncDesc')}</Text>
            </View>
            <Switch
              value={settings.autoSync}
              onValueChange={handleToggleAutoSync}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={settings.autoSync ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.syncButton, (!isOnline || syncing) && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={!isOnline || syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="sync" size={20} color="#fff" />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? t('settings.syncing') : t('settings.syncNow')}
            </Text>
          </TouchableOpacity>
          
          {lastSyncTime && (
            <Text style={[styles.lastSyncText, isRTL && styles.lastSyncTextRTL]}>
              {t('settings.lastSync')}: {formatLastTime(lastSyncTime)}
            </Text>
          )}
        </View>

        {/* PIN / Biometric Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.pinBiometric')}</Text>
          <View style={styles.pinContainer}>
            {pin.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { pinInputRefs.current[index] = ref; }}
                style={styles.pinInput}
                value={digit}
                onChangeText={(value) => handlePinChange(index, value)}
                onKeyPress={({ nativeEvent }) => handlePinKeyPress(index, nativeEvent.key)}
                keyboardType="numeric"
                maxLength={1}
                secureTextEntry
                selectTextOnFocus
              />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.savePinButton, saving && styles.savePinButtonDisabled]}
            onPress={handleSavePin}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.savePinButtonText}>{t('settings.savePin')}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.securityButtons}>
            <TouchableOpacity
              style={[
                styles.securityButton,
                settings.pinEnabled && styles.securityButtonActive,
              ]}
              onPress={handleTogglePinLock}
            >
              <Icon name="lock" size={20} color={settings.pinEnabled ? '#fff' : '#4CAF50'} />
              <Text
                style={[
                  styles.securityButtonText,
                  settings.pinEnabled && styles.securityButtonTextActive,
                ]}
              >
                {settings.pinEnabled ? t('settings.lockEnabled') : t('settings.enableLock')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.securityButton,
                styles.fingerprintButton,
                settings.fingerprintEnabled && styles.securityButtonActive,
                !biometricAvailable && styles.securityButtonDisabled,
              ]}
              onPress={handleBiometricToggle}
              disabled={!biometricAvailable && !settings.fingerprintEnabled}
            >
              <Icon
                name="fingerprint"
                size={20}
                color={settings.fingerprintEnabled ? '#fff' : biometricAvailable ? '#4CAF50' : '#999'}
              />
              <Text
                style={[
                  styles.securityButtonText,
                  settings.fingerprintEnabled && styles.securityButtonTextActive,
                  !biometricAvailable && !settings.fingerprintEnabled && styles.securityButtonTextDisabled,
                ]}
              >
                {biometricType || t('settings.useFingerprint')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.language')}</Text>
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.languageText, language === 'en' && styles.languageTextActive]}>
                {t('settings.english')}
              </Text>
              {language === 'en' && <Icon name="check" size={20} color="#4CAF50" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageOption, language === 'ar' && styles.languageOptionActive]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Text style={[styles.languageText, language === 'ar' && styles.languageTextActive]}>
                {t('settings.arabic')}
              </Text>
              {language === 'ar' && <Icon name="check" size={20} color="#4CAF50" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.appSettings')}</Text>
          <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, isRTL && styles.settingLabelRTL]}>{t('settings.darkMode')}</Text>
              <Text style={[styles.settingDescription, isRTL && styles.settingDescriptionRTL]}>{t('settings.darkModeDesc')}</Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(value) => handleToggleSetting('darkMode', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={settings.darkMode ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
          <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, isRTL && styles.settingLabelRTL]}>{t('settings.autoBackup')}</Text>
              <Text style={[styles.settingDescription, isRTL && styles.settingDescriptionRTL]}>{t('settings.autoBackupDesc')}</Text>
            </View>
            <Switch
              value={settings.autoBackup}
              onValueChange={handleToggleAutoBackup}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={settings.autoBackup ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.backupButton, backingUp && styles.backupButtonDisabled]}
            onPress={handleManualBackup}
            disabled={backingUp}
          >
            {backingUp ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <Icon name="backup" size={20} color="#4CAF50" />
            )}
            <Text style={styles.backupButtonText}>
              {backingUp ? t('settings.backingUp') : t('settings.backupNow')}
            </Text>
          </TouchableOpacity>
          
          {lastBackupTime && (
            <Text style={[styles.lastSyncText, isRTL && styles.lastSyncTextRTL]}>
              {t('settings.lastBackup')}: {formatLastTime(lastBackupTime)}
            </Text>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.about')}</Text>
          <View style={[styles.aboutItem, isRTL && styles.aboutItemRTL]}>
            <Text style={[styles.aboutLabel, isRTL && styles.aboutLabelRTL]}>{t('settings.appVersion')}</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={[styles.aboutItem, isRTL && styles.aboutItemRTL]}>
            <Text style={[styles.aboutLabel, isRTL && styles.aboutLabelRTL]}>{t('settings.userId')}</Text>
            <Text style={styles.aboutValue}>{user?.id.substring(0, 8)}...</Text>
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
  appBarTitleRTL: {
    textAlign: 'right',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitleRTL: {
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineBadge: {
    backgroundColor: '#4CAF50',
  },
  offlineBadge: {
    backgroundColor: '#9E9E9E',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  pendingText: {
    color: '#E65100',
    fontSize: 14,
    flex: 1,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 8,
  },
  backupButtonDisabled: {
    opacity: 0.6,
  },
  backupButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  lastSyncTextRTL: {
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingRowRTL: {
    flexDirection: 'row-reverse',
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
  settingLabelRTL: {
    textAlign: 'right',
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  settingDescriptionRTL: {
    textAlign: 'right',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pinInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: '#fff',
  },
  savePinButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  savePinButtonDisabled: {
    opacity: 0.6,
  },
  savePinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  securityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
    gap: 8,
  },
  fingerprintButton: {
    backgroundColor: '#E8F5E9',
  },
  securityButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  securityButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  securityButtonTextActive: {
    color: '#fff',
  },
  securityButtonDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  securityButtonTextDisabled: {
    color: '#999',
  },
  languageOptions: {
    gap: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  languageOptionActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  languageTextActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  aboutItemRTL: {
    flexDirection: 'row-reverse',
  },
  aboutLabel: {
    fontSize: 14,
    color: '#666',
  },
  aboutLabelRTL: {
    textAlign: 'right',
  },
  aboutValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

