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
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { settingsApi } from '../src/services/api.service';

export default function SettingsScreen(): JSX.Element {
  const { user, settings, updateSettings, isLoading } = useUser();
  const { t, setLocale, isRTL, locale } = useI18n();
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [language, setLanguage] = useState<'en' | 'ar'>(locale as 'en' | 'ar');

  useEffect(() => {
    if (settings) {
      const lang = (settings.language as 'en' | 'ar') || 'en';
      setLanguage(lang);
    }
  }, [settings]);

  const handlePinChange = (index: number, value: string): void => {
    if (value.length <= 1) {
      const newPin = [...pin];
      newPin[index] = value;
      setPin(newPin);
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

  const handleToggleSetting = async (key: string, value: boolean): Promise<void> => {
    try {
      await updateSettings({ [key]: value } as any);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert(t('app.error'), t('settings.errorUpdating'));
    }
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
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.offlineSync')}</Text>
          <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, isRTL && styles.settingLabelRTL]}>{t('settings.offlineMode')}</Text>
              <Text style={[styles.settingDescription, isRTL && styles.settingDescriptionRTL]}>{t('settings.offlineModeDesc')}</Text>
            </View>
            <Switch
              value={settings.offlineMode}
              onValueChange={(value) => handleToggleSetting('offlineMode', value)}
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
              onValueChange={(value) => handleToggleSetting('autoSync', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={settings.autoSync ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* PIN / Biometric Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('settings.pinBiometric')}</Text>
          <View style={styles.pinContainer}>
            {pin.map((digit, index) => (
              <TextInput
                key={index}
                style={styles.pinInput}
                value={digit}
                onChangeText={(value) => handlePinChange(index, value)}
                keyboardType="numeric"
                maxLength={1}
                secureTextEntry
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
              onPress={() => handleToggleSetting('pinEnabled', !settings.pinEnabled)}
            >
              <Icon name="lock" size={20} color={settings.pinEnabled ? '#fff' : '#4CAF50'} />
              <Text
                style={[
                  styles.securityButtonText,
                  settings.pinEnabled && styles.securityButtonTextActive,
                ]}
              >
                {t('settings.enableLock')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.securityButton,
                styles.fingerprintButton,
                settings.fingerprintEnabled && styles.securityButtonActive,
              ]}
              onPress={() => handleToggleSetting('fingerprintEnabled', !settings.fingerprintEnabled)}
            >
              <Icon
                name="fingerprint"
                size={20}
                color={settings.fingerprintEnabled ? '#fff' : '#4CAF50'}
              />
              <Text
                style={[
                  styles.securityButtonText,
                  settings.fingerprintEnabled && styles.securityButtonTextActive,
                ]}
              >
                {t('settings.useFingerprint')}
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
              onValueChange={(value) => handleToggleSetting('autoBackup', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={settings.autoBackup ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionTitleRTL: {
    textAlign: 'right',
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

