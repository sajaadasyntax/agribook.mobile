import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import syncService, { SyncStatus } from '../src/services/sync.service';
import { transactionApi, categoryApi, alertApi, reminderApi } from '../src/services/api.service';

const HAS_PIN_FLAG = 'agribooks_has_pin';

export default function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { user, settings, updateSettings, isLoading, isOffline, pendingCount: contextPendingCount, syncData, logout } = useUser();
  const { t, setLocale, isRTL, locale } = useI18n();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [showPinModal, setShowPinModal] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ar'>(locale as 'en' | 'ar');
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

  // Check sync status on mount / updates
  useEffect(() => {
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

  // In-app PIN keyboard handlers
  const handleNumberPress = (num: string): void => {
    const emptyIndex = pin.findIndex(digit => digit === '');
    if (emptyIndex !== -1) {
      const newPin = [...pin];
      newPin[emptyIndex] = num;
      setPin(newPin);
    }
  };

  const handleBackspace = (): void => {
    const lastFilledIndex = pin.reduce((acc, digit, index) => 
      digit !== '' ? index : acc, -1);
    
    if (lastFilledIndex !== -1) {
      const newPin = [...pin];
      newPin[lastFilledIndex] = '';
      setPin(newPin);
    }
  };

  const handleClearPin = (): void => {
    setPin(['', '', '', '']);
  };

  const handleSavePin = async (): Promise<void> => {
    const pinString = pin.join('');
    if (pinString.length < 4) {
      Alert.alert(t('app.error'), t('settings.pinMustBeFour'));
      return;
    }

    try {
      setSaving(true);
      // Store PIN locally in SecureStore
      await SecureStore.setItemAsync('user_pin', pinString);
      // Save PIN and pinEnabled to database for cross-device sync
      await updateSettings({ pinEnabled: true, pin: pinString });
      await SecureStore.setItemAsync(HAS_PIN_FLAG, 'true');
      setHasSavedPin(true);
      setShowPinModal(false);
      Alert.alert(t('app.success'), t('settings.pinSaved'));
      setPin(['', '', '', '']);
    } catch (error) {
      console.error('Error saving PIN:', error);
      Alert.alert(t('app.error'), t('settings.errorSavingPin'));
    } finally {
      setSaving(false);
    }
  };

  const openPinModal = (): void => {
    setPin(['', '', '', '']);
    setShowPinModal(true);
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
      // Disable PIN
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

  const handleLogout = (): void => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutDesc'),
      [
        {
          text: t('app.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              Alert.alert(t('app.success'), t('settings.loggedOut'));
              // Navigation will automatically redirect to Welcome screen when isAuthenticated becomes false
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert(t('app.error'), t('settings.errorUpdating'));
            }
          },
        },
      ]
    );
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
      <View style={[styles.appBar(colors), isRTL && styles.appBarRTL]}>
        <Text style={styles.appBarTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Section */}
        <View style={styles.section(colors)}>
          <TouchableOpacity
            style={[styles.profileButton(colors), isRTL && styles.profileButtonRTL]}
            onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          >
            <Icon name="person" size={24} color={colors.primary} />
            <View style={styles.profileButtonContent}>
              <Text style={styles.profileButtonTitle(colors)}>{t('profile.title')}</Text>
              <Text style={styles.profileButtonSubtitle(colors)}>
                {user?.companyName || user?.name || t('profile.viewProfile')}
              </Text>
            </View>
            <Icon name={isRTL ? 'chevron-left' : 'chevron-right'} size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Offline & Sync Section */}
        <View style={styles.section(colors)}>
          <Text style={styles.sectionTitle(colors)}>{t('settings.offlineSync')}</Text>
          
          {/* Connection Status */}
          <View style={[styles.statusRow(colors), isRTL && styles.statusRowRTL]}>
            <View style={[styles.statusIndicator, isOnline ? styles.statusOnline : styles.statusOffline]} />
            <Text style={styles.statusText(colors)}>
              {isOnline ? t('settings.online') : t('settings.offline')}
            </Text>
            {pendingCount > 0 && (
              <Text style={styles.pendingText(colors)}>
                {t('settings.pendingItems', { count: pendingCount })}
              </Text>
            )}
          </View>

          {/* Offline Mode Toggle */}
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel(colors)}>{t('settings.offlineMode')}</Text>
              <Text style={styles.settingDescription(colors)}>{t('settings.offlineModeDesc')}</Text>
            </View>
            <Switch
              value={settings.offlineMode}
              onValueChange={handleToggleOfflineMode}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.offlineMode ? colors.primary : colors.inputBackground}
            />
          </View>

          {/* Auto Sync Toggle */}
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel(colors)}>{t('settings.autoSync')}</Text>
              <Text style={styles.settingDescription(colors)}>{t('settings.autoSyncDesc')}</Text>
            </View>
            <Switch
              value={settings.autoSync}
              onValueChange={handleToggleAutoSync}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.autoSync ? colors.primary : colors.inputBackground}
            />
          </View>

          {/* Sync Now Button */}
          <TouchableOpacity
            style={[styles.syncButton(colors), (syncing || !isOnline) && styles.syncButtonDisabled(colors)]}
            onPress={() => handleManualSync()}
            disabled={syncing || !isOnline}
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
            <Text style={styles.lastSyncText(colors)}>
              {t('settings.lastSync')}: {formatLastTime(lastSyncTime)}
            </Text>
          )}
        </View>

        {/* PIN / Biometric Section */}
        <View style={styles.section(colors)}>
          <Text style={styles.sectionTitle(colors)}>{t('settings.pinBiometric')}</Text>
          
          {/* Set/Change PIN Button */}
          <TouchableOpacity
            style={[styles.setPinButton(colors), isRTL && styles.setPinButtonRTL]}
            onPress={openPinModal}
          >
            <Icon name="dialpad" size={24} color={colors.primary} />
            <Text style={styles.setPinButtonText(colors)}>
              {hasSavedPin ? t('settings.changePin') : t('settings.savePin')}
            </Text>
            <Icon name={isRTL ? 'chevron-left' : 'chevron-right'} size={24} color={colors.textSecondary} />
          </TouchableOpacity>

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
        </View>

        {/* Language Settings */}
        <View style={styles.section(colors)}>
          <Text style={styles.sectionTitle(colors)}>{t('settings.language')}</Text>
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
          <Text style={styles.sectionTitle(colors)}>{t('settings.appSettings')}</Text>
          <View style={[styles.settingRow(colors), isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel(colors)}>{t('settings.darkMode')}</Text>
              <Text style={styles.settingDescription(colors)}>{t('settings.darkModeDesc')}</Text>
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
              <Text style={styles.settingLabel(colors)}>{t('settings.autoBackup')}</Text>
              <Text style={styles.settingDescription(colors)}>{t('settings.autoBackupDesc')}</Text>
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
            <Text style={styles.lastSyncText(colors)}>
              {t('settings.lastBackup')}: {formatLastTime(lastBackupTime)}
            </Text>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section(colors)}>
          <Text style={styles.sectionTitle(colors)}>{t('settings.about')}</Text>
          <View style={[styles.aboutItem(colors), isRTL && styles.aboutItemRTL]}>
            <Text style={styles.aboutLabel(colors)}>{t('settings.appVersion')}</Text>
            <Text style={styles.aboutValue(colors)}>1.0.0</Text>
          </View>
          <View style={[styles.aboutItem(colors), isRTL && styles.aboutItemRTL]}>
            <Text style={styles.aboutLabel(colors)}>{t('settings.userId')}</Text>
            <Text style={styles.aboutValue(colors)}>{user?.id.substring(0, 8)}...</Text>
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section(colors)}>
          <TouchableOpacity
            style={[styles.logoutButton(colors), isRTL && styles.logoutButtonRTL]}
            onPress={handleLogout}
          >
            <Icon name="exit-to-app" size={24} color={colors.expense} />
            <Text style={styles.logoutButtonText(colors)}>{t('settings.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* PIN Entry Modal with In-App Keyboard */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPinModal(false)}
      >
        <View style={styles.pinModalOverlay}>
          <View style={styles.pinModalContent(colors)}>
            <View style={[styles.pinModalHeader, isRTL && styles.pinModalHeaderRTL]}>
              <Text style={styles.pinModalTitle(colors)}>
                {t('settings.enterPin')}
              </Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* PIN Display - always LTR regardless of language */}
            <View style={styles.pinDisplayContainer}>
              {pin.map((digit, index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot(colors),
                    digit !== '' && styles.pinDotFilled(colors),
                  ]}
                >
                  {digit !== '' && (
                    <View style={styles.pinDotInner(colors)} />
                  )}
                </View>
              ))}
            </View>

            {/* Number Pad - always LTR regardless of language */}
            <View style={styles.numberPad}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['clear', '0', 'back']].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.numberPadRow}>
                  {row.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.numberPadButton(colors),
                        (item === 'clear' || item === 'back') && styles.numberPadActionButton,
                      ]}
                      onPress={() => {
                        if (item === 'clear') {
                          handleClearPin();
                        } else if (item === 'back') {
                          handleBackspace();
                        } else {
                          handleNumberPress(item);
                        }
                      }}
                    >
                      {item === 'clear' ? (
                        <Text style={styles.numberPadActionText(colors)}>{t('settings.clear')}</Text>
                      ) : item === 'back' ? (
                        <Icon name="backspace" size={24} color={colors.text} />
                      ) : (
                        <Text style={styles.numberPadText(colors)}>{item}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.savePinModalButton(colors),
                (pin.join('').length < 4 || saving) && styles.savePinModalButtonDisabled(colors),
              ]}
              onPress={handleSavePin}
              disabled={pin.join('').length < 4 || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.savePinModalButtonText}>{t('settings.savePin')}</Text>
              )}
            </TouchableOpacity>
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
  },
  sectionTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    textAlign: 'left' as const,
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
  statusRow: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  }),
  statusRowRTL: {
    flexDirection: 'row-reverse' as const,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#F44336',
  },
  statusText: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  }),
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
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: (colors: any) => ({
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'left' as const,
  }),
  settingLabelRTL: {
    textAlign: 'right' as const,
  },
  settingDescription: (colors: any) => ({
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left' as const,
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
  securityButton: (colors: any) => ({
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
  },
  aboutLabel: (colors: any) => ({
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'left' as const,
  }),
  aboutLabelRTL: {
    textAlign: 'right' as const,
  },
  aboutValue: (colors: any) => ({
    fontSize: 14,
    color: colors.text,
    fontWeight: '500' as const,
  }),
  profileButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    gap: 12,
  }),
  profileButtonRTL: {
  },
  profileButtonContent: {
    flex: 1,
  },
  profileButtonTitle: (colors: any) => ({
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'left' as const,
  }),
  profileButtonTitleRTL: {
    textAlign: 'right' as const,
  },
  profileButtonSubtitle: (colors: any) => ({
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'left' as const,
  }),
  profileButtonSubtitleRTL: {
    textAlign: 'right' as const,
  },
  // PIN Modal Styles
  setPinButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 16,
  }),
  setPinButtonRTL: {
  },
  setPinButtonText: (colors: any) => ({
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    textAlign: 'left' as const,
  }),
  setPinButtonTextRTL: {
    textAlign: 'right' as const,
    marginLeft: 0,
    marginRight: 12,
  },
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  pinModalContent: (colors: any) => ({
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  }),
  pinModalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  pinModalHeaderRTL: {
  },
  pinModalTitle: (colors: any) => ({
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.text,
  }),
  pinDisplayContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 32,
    gap: 20,
    direction: 'ltr' as const, // Always LTR for PIN entry
  },
  pinDot: (colors: any) => ({
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }),
  pinDotFilled: (colors: any) => ({
    backgroundColor: colors.primary,
  }),
  pinDotInner: (colors: any) => ({
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textInverse,
  }),
  numberPad: {
    marginBottom: 24,
    direction: 'ltr' as const, // Always LTR for PIN entry
  },
  numberPadRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
    direction: 'ltr' as const, // Always LTR for PIN entry
  },
  numberPadButton: (colors: any) => ({
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginHorizontal: 12,
  }),
  numberPadActionButton: {
    backgroundColor: 'transparent',
  },
  numberPadText: (colors: any) => ({
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: colors.text,
  }),
  numberPadActionText: (colors: any) => ({
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: colors.primary,
  }),
  savePinModalButton: (colors: any) => ({
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  }),
  savePinModalButtonDisabled: (colors: any) => ({
    backgroundColor: colors.inputBackground,
  }),
  savePinModalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
  logoutButton: (colors: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 16,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.expense,
    gap: 12,
  }),
  logoutButtonRTL: {
  },
  logoutButtonText: (colors: any) => ({
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.expense,
  }),
};

