import React, { useState, useEffect, useCallback } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import syncService, { SyncStatus } from '../src/services/sync.service';
import { transactionApi, categoryApi, alertApi, reminderApi } from '../src/services/api.service';

const HAS_PIN_FLAG = 'agribooks_has_pin';

export default function SettingsScreen(): JSX.Element {
  const { user, settings, updateSettings, isLoading, isOffline, pendingCount: contextPendingCount, syncData } = useUser();
  const { t, setLocale, isRTL, locale } = useI18n();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [language, setLanguage] = useState<'en' | 'ar'>(locale as 'en' | 'ar');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isOnline, setIsOnline] = useState(!isOffline);
  const [pendingCount, setPendingCount] = useState(contextPendingCount);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [hasSavedPin, setHasSavedPin] = useState(false);

  const checkSyncStatus = useCallback(async (): Promise<void> => {
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
  }, []);

  const handleManualSync = useCallback(async (onlineOverride?: boolean): Promise<void> => {
    const currentlyOnline = typeof onlineOverride === 'boolean'
      ? onlineOverride
      : syncService.getIsOnline();

    if (!currentlyOnline) {
      Alert.alert(t('app.error'), t('settings.offlineCannotSync'));
      return;
    }

    try {
      setSyncing(true);
      
      // First sync pending transactions
      const pendingTransactions = await syncService.getPendingTransactions();
      
      for (const transaction of pendingTransactions) {
        try {
          await transactionApi.create({
            type: transaction.type,
            amount: transaction.amount,
            categoryId: transaction.categoryId,
            description: transaction.description,
          });
          // Remove successfully synced transaction
          await syncService.removePendingTransaction(transaction.id);
        } catch (error) {
          console.error('Error syncing transaction:', error);
          // Update retry count for failed transactions
          if (syncService.shouldRetry({ ...transaction, retryCount: transaction.retryCount || 0 } as any)) {
            await syncService.updatePendingTransaction(transaction.id, {
              retryCount: (transaction.retryCount || 0) + 1,
            });
          } else {
            // Max retries reached, remove from queue
            await syncService.removePendingTransaction(transaction.id);
          }
        }
      }
      
      // Also sync any pending operations from UserContext
      await syncData();
      
      // Fetch fresh data from server and cache it
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
      
      await syncService.updateLastSyncTime();
      await checkSyncStatus();
      
      Alert.alert(t('app.success'), t('settings.syncComplete'));
    } catch (error) {
      console.error('Error syncing:', error);
      Alert.alert(t('app.error'), t('settings.syncFailed'));
    } finally {
      setSyncing(false);
    }
  }, [checkSyncStatus, t, syncData]);

  // Check biometric availability and sync status on mount / updates
  useEffect(() => {
    checkBiometricAvailability();
    checkSyncStatus();
  }, [checkSyncStatus]);

  // Listen to sync status changes
  useEffect(() => {
    const unsubscribe = syncService.addSyncStatusListener((status: SyncStatus) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      setSyncing(status.isSyncing);
      if (status.lastSyncTime) {
        setLastSyncTime(status.lastSyncTime);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle auto-sync when coming online
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = syncService.addConnectivityListener((online) => {
      setIsOnline(online);
      if (online && settings?.autoSync && pendingCount > 0) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          handleManualSync(true);
        }, 1000);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [settings?.autoSync, pendingCount, handleManualSync]);

  useEffect(() => {
    if (settings) {
      const lang = (settings.language as 'en' | 'ar') || 'en';
      setLanguage(lang);
    }
  }, [settings]);

  useEffect(() => {
    const loadHasPinFlag = async (): Promise<void> => {
      try {
        if (settings?.pinEnabled) {
          setHasSavedPin(true);
          await SecureStore.setItemAsync(HAS_PIN_FLAG, 'true');
          return;
        }

        const storedFlag = await SecureStore.getItemAsync(HAS_PIN_FLAG);
        if (storedFlag === 'true') {
          setHasSavedPin(true);
        }
      } catch (error) {
        console.error('Error loading PIN flag:', error);
      }
    };

    loadHasPinFlag();
  }, [settings?.pinEnabled]);

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
      await SecureStore.setItemAsync(HAS_PIN_FLAG, 'true');
      setHasSavedPin(true);
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
    if (!settings) return;

    if (!settings.pinEnabled) {
      if (!hasSavedPin) {
        Alert.alert(
          t('settings.enableLock'),
          t('settings.setPin'),
          [{ text: t('app.ok') }]
        );
        return;
      }

      try {
        await updateSettings({ pinEnabled: true });
        Alert.alert(t('app.success'), t('settings.lockEnabled'));
      } catch (error) {
        console.error('Error enabling lock:', error);
        Alert.alert(t('app.error'), t('settings.errorUpdating'));
      }
      return;
    }

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
      <View style={[styles.container(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText(colors)}>{t('settings.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container(colors)}>
      <View style={styles.appBar(colors)}>
        <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Offline & Sync Section */}
        <View style={styles.section(colors)}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('settings.offlineSync')}</Text>
            <View style={[styles.statusBadge, isOnline ? styles.onlineBadge(colors) : styles.offlineBadge(colors)]}>
              <Icon name={isOnline ? 'cloud-done' : 'cloud-off'} size={14} color={colors.textInverse} />
              <Text style={styles.statusBadgeText}>
                {isOnline ? t('settings.online') : t('settings.offline')}
              </Text>
            </View>
          </View>
          
          {pendingCount > 0 && (
            <View style={styles.pendingBanner(colors)}>
              <Icon name="sync-problem" size={20} color={colors.warning} />
              <Text style={styles.pendingText(colors)}>
                {t('settings.pendingItems', { count: pendingCount })}
              </Text>
            </View>
          )}
          
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>{t('settings.offlineMode')}</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>{t('settings.offlineModeDesc')}</Text>
            </View>
            <Switch
              value={settings.offlineMode}
              onValueChange={handleToggleOfflineMode}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.offlineMode ? colors.primary : colors.inputBackground}
            />
          </View>
          
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>{t('settings.autoSync')}</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>{t('settings.autoSyncDesc')}</Text>
            </View>
            <Switch
              value={settings.autoSync}
              onValueChange={handleToggleAutoSync}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.autoSync ? colors.primary : colors.inputBackground}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.syncButton(colors), (!isOnline || syncing) && styles.syncButtonDisabled(colors)]}
            onPress={handleManualSync}
            disabled={!isOnline || syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Icon name="sync" size={20} color={colors.textInverse} />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? t('settings.syncing') : t('settings.syncNow')}
            </Text>
          </TouchableOpacity>
          
          {lastSyncTime && (
            <Text style={[styles.lastSyncText(colors), isRTL && styles.lastSyncTextRTL]}>
              {t('settings.lastSync')}: {formatLastTime(lastSyncTime)}
            </Text>
          )}
        </View>

        {/* PIN / Biometric Section */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('settings.pinBiometric')}</Text>
          <View style={styles.pinContainer}>
            {pin.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { pinInputRefs.current[index] = ref; }}
                style={styles.pinInput(colors)}
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
            style={[styles.savePinButton(colors), saving && styles.savePinButtonDisabled]}
            onPress={handleSavePin}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.savePinButtonText}>{t('settings.savePin')}</Text>
            )}
          </TouchableOpacity>
          <View style={[styles.securityButtons, isRTL && styles.securityButtonsRTL]}>
            <TouchableOpacity
              style={[
                styles.securityButton(colors),
                settings.pinEnabled && styles.securityButtonActive(colors),
              ]}
              onPress={handleTogglePinLock}
            >
              <Icon name="lock" size={20} color={settings.pinEnabled ? colors.textInverse : colors.primary} />
              <Text
                style={[
                  styles.securityButtonText(colors),
                  settings.pinEnabled && styles.securityButtonTextActive,
                ]}
              >
                {settings.pinEnabled ? t('settings.lockEnabled') : t('settings.enableLock')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.securityButton(colors),
                styles.fingerprintButton(colors),
                settings.fingerprintEnabled && styles.securityButtonActive(colors),
                !biometricAvailable && styles.securityButtonDisabled(colors),
              ]}
              onPress={handleBiometricToggle}
              disabled={!biometricAvailable && !settings.fingerprintEnabled}
            >
              <Icon
                name="fingerprint"
                size={20}
                color={settings.fingerprintEnabled ? colors.textInverse : biometricAvailable ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.securityButtonText(colors),
                  settings.fingerprintEnabled && styles.securityButtonTextActive,
                  !biometricAvailable && !settings.fingerprintEnabled && styles.securityButtonTextDisabled(colors),
                ]}
              >
                {biometricType || t('settings.useFingerprint')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Settings */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('settings.language')}</Text>
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[styles.languageOption(colors), language === 'en' && styles.languageOptionActive(colors)]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.languageText(colors), language === 'en' && styles.languageTextActive(colors)]}>
                {t('settings.english')}
              </Text>
              {language === 'en' && <Icon name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageOption(colors), language === 'ar' && styles.languageOptionActive(colors)]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Text style={[styles.languageText(colors), language === 'ar' && styles.languageTextActive(colors)]}>
                {t('settings.arabic')}
              </Text>
              {language === 'ar' && <Icon name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('settings.appSettings')}</Text>
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>{t('settings.darkMode')}</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>{t('settings.darkModeDesc')}</Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(value) => handleToggleSetting('darkMode', value)}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.darkMode ? colors.primary : colors.inputBackground}
            />
          </View>
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel(colors), isRTL && styles.settingLabelRTL]}>{t('settings.autoBackup')}</Text>
              <Text style={[styles.settingDescription(colors), isRTL && styles.settingDescriptionRTL]}>{t('settings.autoBackupDesc')}</Text>
            </View>
            <Switch
              value={settings.autoBackup}
              onValueChange={handleToggleAutoBackup}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.autoBackup ? colors.primary : colors.inputBackground}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.backupButton(colors), backingUp && styles.backupButtonDisabled]}
            onPress={handleManualBackup}
            disabled={backingUp}
          >
            {backingUp ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="backup" size={20} color={colors.primary} />
            )}
            <Text style={styles.backupButtonText(colors)}>
              {backingUp ? t('settings.backingUp') : t('settings.backupNow')}
            </Text>
          </TouchableOpacity>
          
          {lastBackupTime && (
            <Text style={[styles.lastSyncText(colors), isRTL && styles.lastSyncTextRTL]}>
              {t('settings.lastBackup')}: {formatLastTime(lastBackupTime)}
            </Text>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>{t('settings.about')}</Text>
          <View style={[styles.aboutItem(colors), isRTL && styles.aboutItemRTL]}>
            <Text style={[styles.aboutLabel(colors), isRTL && styles.aboutLabelRTL]}>{t('settings.appVersion')}</Text>
            <Text style={styles.aboutValue(colors)}>1.0.0</Text>
          </View>
          <View style={[styles.aboutItem(colors), isRTL && styles.aboutItemRTL]}>
            <Text style={[styles.aboutLabel(colors), isRTL && styles.aboutLabelRTL]}>{t('settings.userId')}</Text>
            <Text style={styles.aboutValue(colors)}>{user?.id.substring(0, 8)}...</Text>
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
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineBadge: (colors: any) => ({
    backgroundColor: colors.success,
  }),
  offlineBadge: (colors: any) => ({
    backgroundColor: colors.textSecondary,
  }),
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  pendingBanner: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  }),
  pendingText: (colors: any) => ({
    color: colors.warning,
    fontSize: 14,
    flex: 1,
  }),
  syncButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  }),
  syncButtonDisabled: (colors: any) => ({
    backgroundColor: colors.disabled,
  }),
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  backupButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  }),
  backupButtonDisabled: {
    opacity: 0.6,
  },
  backupButtonText: (colors: any) => ({
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  }),
  lastSyncText: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center' as const,
  }),
  lastSyncTextRTL: {
    textAlign: 'center' as const,
  },
  settingRow: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
  }),
  settingRowRTL: {
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
  pinContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  pinInput: (colors: any) => ({
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    textAlign: 'center' as const,
    fontSize: 20,
    fontWeight: 'bold' as const,
    backgroundColor: colors.surface,
    color: colors.text,
  }),
  savePinButton: (colors: any) => ({
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
    marginBottom: 16,
  }),
  savePinButtonDisabled: {
    opacity: 0.6,
  },
  savePinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  securityButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  securityButtonsRTL: {
    flexDirection: 'row-reverse' as const,
  },
  securityButton: (colors: any) => ({
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    gap: 8,
  }),
  fingerprintButton: (colors: any) => ({
    backgroundColor: colors.background,
  }),
  securityButtonActive: (colors: any) => ({
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  }),
  securityButtonText: (colors: any) => ({
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: colors.primary,
  }),
  securityButtonTextActive: {
    color: '#fff',
  },
  securityButtonDisabled: (colors: any) => ({
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  }),
  securityButtonTextDisabled: (colors: any) => ({
    color: colors.textSecondary,
  }),
  languageOptions: {
    gap: 8,
  },
  languageOption: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
  }),
  languageOptionActive: (colors: any) => ({
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
  }),
  languageText: (colors: any) => ({
    fontSize: 16,
    color: colors.text,
  }),
  languageTextActive: (colors: any) => ({
    color: colors.primary,
    fontWeight: 'bold' as const,
  }),
  aboutItem: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
  }),
  aboutItemRTL: {
    flexDirection: 'row-reverse' as const,
  },
  aboutLabel: (colors: any) => ({
    fontSize: 14,
    color: colors.textSecondary,
  }),
  aboutLabelRTL: {
    textAlign: 'right' as const,
  },
  aboutValue: (colors: any) => ({
    fontSize: 14,
    color: colors.text,
    fontWeight: '500' as const,
  }),
};

