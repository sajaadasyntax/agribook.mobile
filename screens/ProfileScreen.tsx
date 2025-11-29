import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoFileUri, setLogoFileUri] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setCompanyName(user.companyName || '');
      setLogoUri(user.logoUrl || null);
    }
  }, [user]);

  const handlePickImage = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('app.error'), t('auth.permissionDenied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false, // Don't need base64, we'll upload the file directly
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setLogoUri(asset.uri);
        setLogoFileUri(asset.uri); // Store the file URI for upload
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('app.error'), t('auth.errorUploadingLogo'));
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // If logoFileUri exists, upload the file; otherwise use logoUrl (could be empty to delete)
      const updatedUser = await userApi.update(
        {
          name: name || undefined,
          phone: phone || undefined,
          companyName: companyName || undefined,
          logoUrl: logoFileUri ? undefined : (logoUri ? undefined : ''), // Empty string to delete, undefined to keep
        },
        logoFileUri || undefined // Pass file URI if a new file was selected
      );
      
      updateUserContext(updatedUser);
      // Refresh user data to ensure logo is loaded
      await refreshUser();
      // Update local logo display with the URL from server
      if (updatedUser.logoUrl) {
        setLogoUri(updatedUser.logoUrl);
      } else {
        setLogoUri(null);
      }
      setLogoFileUri(null); // Clear the file URI after upload
      Alert.alert(t('app.success'), t('profile.updated'));
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(t('app.error'), t('profile.errorUpdating'));
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
    <View style={styles.container(colors)}>
      <View style={[styles.appBar(colors), isRTL && styles.appBarRTL]}>
        <Text style={[styles.appBarTitle, isRTL && styles.appBarTitleRTL]}>
          {t('profile.title')}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Logo Section */}
        <View style={styles.section(colors)}>
          <Text style={[styles.sectionTitle(colors), isRTL && styles.sectionTitleRTL]}>
            {t('profile.companyLogo')}
          </Text>
          <TouchableOpacity
            style={[styles.logoUploadButton(colors), isRTL && styles.logoUploadButtonRTL]}
            onPress={handlePickImage}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Icon name="add-photo-alternate" size={40} color={colors.textSecondary} />
                <Text style={styles.logoPlaceholderText(colors)}>{t('auth.uploadLogo')}</Text>
              </View>
            )}
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity
              style={styles.removeLogoButton}
              onPress={() => {
                setLogoUri(null);
                setLogoFileUri(null);
              }}
            >
              <Icon name="delete" size={20} color={colors.error} />
              <Text style={styles.removeLogoText(colors)}>{t('auth.removeLogo')}</Text>
            </TouchableOpacity>
          )}
        </View>

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
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.saveButtonText}>{t('app.save')}</Text>
          )}
        </TouchableOpacity>
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
  }),
  sectionTitleRTL: {
    textAlign: 'right' as const,
  },
  logoUploadButton: (colors: any) => ({
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
  }),
  logoUploadButtonRTL: {
    alignSelf: 'center' as const,
  },
  logoPlaceholder: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  logoPlaceholderText: (colors: any) => ({
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  }),
  logoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removeLogoButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
    padding: 8,
  },
  removeLogoText: (colors: any) => ({
    marginLeft: 4,
    fontSize: 14,
    color: colors.error,
  }),
  label: (colors: any) => ({
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
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

