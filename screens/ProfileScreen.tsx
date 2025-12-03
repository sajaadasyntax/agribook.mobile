import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { userApi } from '../src/services/api.service';

export default function ProfileScreen(): React.JSX.Element {
  const { user, updateUser: updateUserContext, refreshUser } = useUser();
  const { t, isRTL } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Initialize state from user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setCompanyName(user.companyName || '');
    }
  }, [user]);

  const handleSave = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const updatedUser = await userApi.update({
        name: name || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
      });
      
      updateUserContext(updatedUser);
      
      Alert.alert(t('app.success'), t('profile.updated'));
      // Refresh user data to ensure consistency
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      let errorMessage = t('profile.errorUpdating');
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('connection')) {
          errorMessage = t('app.networkError') || 'Network error. Please check your connection.';
        }
      }
      Alert.alert(t('app.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container(colors), styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoid(colors)}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container(colors)}>
        <View style={[styles.appBar(colors), isRTL && styles.appBarRTL]}>
          <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>
            {t('profile.title')}
          </Text>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
        >
        {/* Personal Information */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
            {t('profile.personalInfo')}
          </Text>

          <Text style={[styles.label(colors), isRTL && styles.labelRTL]}>
            {t('auth.name')}
          </Text>
          <TextInput
            style={[styles.input(colors), isRTL && styles.inputRTL]}
            placeholder={t('auth.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            textAlign={isRTL ? 'right' : 'left'}
          />

          <Text style={[styles.label(colors), isRTL && styles.labelRTL, { marginTop: 16 }]}>
            {t('auth.email')}
          </Text>
          <TextInput
            style={[styles.input(colors), styles.inputDisabled(colors), isRTL && styles.inputRTL]}
            value={user.email || ''}
            editable={false}
            textAlign={isRTL ? 'right' : 'left'}
          />

          <Text style={[styles.label(colors), isRTL && styles.labelRTL, { marginTop: 16 }]}>
            {t('auth.phone')}
          </Text>
          <TextInput
            style={[styles.input(colors), isRTL && styles.inputRTL]}
            placeholder={t('auth.phonePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        {/* Company Information */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
            {t('profile.companyInfo')}
          </Text>

          <Text style={[styles.label(colors), isRTL && styles.labelRTL]}>
            {t('auth.companyName')}
          </Text>
          <TextInput
            style={[styles.input(colors), isRTL && styles.inputRTL]}
            placeholder={t('auth.companyNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={companyName}
            onChangeText={setCompanyName}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton(colors), loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>{t('app.save')}</Text>
          )}
        </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = {
  keyboardAvoid: (colors: any) => ({
    flex: 1,
    backgroundColor: colors.background,
  }),
  container: (colors: any) => ({
    flex: 1,
    backgroundColor: colors.background,
  }),
  centerContent: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
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
  appBarRTL: {
    flexDirection: 'row-reverse' as const,
  },
  appBarTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#fff',
    textAlign: 'left' as const,
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
  sectionTitle: (colors: any) => ({
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'left' as const,
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  label: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'left' as const,
  }),
  labelRTL: {
    textAlign: 'right' as const,
  },
  input: (colors: any) => ({
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  }),
  inputRTL: {
    textAlign: 'right' as const,
  },
  inputDisabled: (colors: any) => ({
    backgroundColor: colors.inputBackground,
    opacity: 0.6,
  }),
  saveButton: (colors: any) => ({
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    margin: 10,
    marginTop: 20,
  }),
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
};
