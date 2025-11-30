import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useUser } from '../src/context/UserContext';
import { useI18n } from '../src/context/I18nContext';
import { useTheme } from '../src/context/ThemeContext';
import { userApi } from '../src/services/api.service';
import { LogoImage } from '../src/components/LogoImage';
import {
  pickAndOptimizeImage,
  getImageErrorMessage,
  IMAGE_ERROR_MESSAGES,
} from '../src/utils/imageUtils';

// Logo state type for simplified management
interface LogoState {
  displayUri: string | null;  // URI to display (server URL or local file)
  uploadUri: string | null;   // Local file URI to upload (null if no new file)
  serverUri: string | null;   // Original server URL (for tracking changes)
  isDeleted: boolean;         // Whether user wants to delete the logo
}

export default function ProfileScreen(): React.JSX.Element {
  const { user, updateUser: updateUserContext, refreshUser } = useUser();
  const { t, isRTL } = useI18n();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [pickingImage, setPickingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Simplified logo state management
  const [logoState, setLogoState] = useState<LogoState>({
    displayUri: null,
    uploadUri: null,
    serverUri: null,
    isDeleted: false,
  });

  // Initialize state from user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setCompanyName(user.companyName || '');
      setLogoState({
        displayUri: user.logoUrl || null,
        uploadUri: null,
        serverUri: user.logoUrl || null,
        isDeleted: false,
      });
    }
  }, [user]);

  // Computed values for logo actions
  const logoActions = useMemo(() => ({
    hasNewFile: !!logoState.uploadUri,
    shouldDelete: logoState.isDeleted && !!logoState.serverUri,
    hasLogo: !!logoState.displayUri,
    showDeleteWarning: logoState.isDeleted && !!logoState.serverUri,
  }), [logoState]);

  // Handle image picking with optimization
  const handlePickImage = useCallback(async () => {
    if (pickingImage) return;

    try {
      setPickingImage(true);
      
      const result = await pickAndOptimizeImage({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        maxDimension: 1024,
      });

      if (result) {
        // Update logo state with new file
        setLogoState(prev => ({
          ...prev,
          displayUri: result.optimizedUri,
          uploadUri: result.optimizedUri,
          isDeleted: false,
        }));
      }
    } catch (error) {
      const errorMessage = getImageErrorMessage(error);
      
      if (errorMessage !== IMAGE_ERROR_MESSAGES.PERMISSION_DENIED) {
        Alert.alert(t('app.error'), errorMessage);
      } else {
        Alert.alert(t('app.error'), t('auth.permissionDenied'));
      }
    } finally {
      setPickingImage(false);
    }
  }, [pickingImage, t]);

  // Handle logo removal
  const handleRemoveLogo = useCallback(() => {
    setLogoState(prev => ({
      ...prev,
      displayUri: null,
      uploadUri: null,
      isDeleted: true,
    }));
  }, []);

  const handleSave = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Set upload state if uploading a file
      if (logoActions.hasNewFile) {
        setIsUploading(true);
        setUploadProgress(0);
      }
      
      const updatedUser = await userApi.update(
        {
          name: name || undefined,
          phone: phone || undefined,
          companyName: companyName || undefined,
          // Empty string signals deletion, undefined keeps existing
          logoUrl: logoActions.shouldDelete ? '' : undefined,
        },
        logoActions.hasNewFile ? logoState.uploadUri : undefined,
        logoActions.hasNewFile ? (progress) => setUploadProgress(progress) : undefined
      );
      
      updateUserContext(updatedUser);
      
      // Update logo state with server response
      setLogoState({
        displayUri: updatedUser.logoUrl || null,
        uploadUri: null,
        serverUri: updatedUser.logoUrl || null,
        isDeleted: false,
      });
      
      Alert.alert(t('app.success'), t('profile.updated'));
      // Refresh user data to ensure consistency
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      // Provide more specific error message
      let errorMessage = t('profile.errorUpdating');
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('logo') || msg.includes('upload') || msg.includes('file')) {
          errorMessage = getImageErrorMessage(error);
        } else if (msg.includes('network') || msg.includes('connection')) {
          errorMessage = t('app.networkError') || 'Network error. Please check your connection.';
        } else if (msg.includes('timeout')) {
          errorMessage = IMAGE_ERROR_MESSAGES.TIMEOUT;
        }
      }
      Alert.alert(t('app.error'), errorMessage);
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
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
            style={[
              styles.logoUploadButton(colors), 
              isRTL && styles.logoUploadButtonRTL,
              pickingImage && styles.logoUploadButtonDisabled
            ]}
            onPress={handlePickImage}
            disabled={pickingImage}
          >
            {pickingImage ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : logoActions.hasLogo ? (
              <LogoImage 
                uri={logoState.displayUri}
                isLocalFile={logoActions.hasNewFile}
                style={styles.logoPreview}
                containerStyle={styles.logoPreviewContainer}
                fallbackIconName="add-photo-alternate"
                fallbackIconSize={40}
                fallbackIconColor={colors.textSecondary}
                showLoading={true}
                onError={(error) => {
                  // Only log for preview - don't show alert as LogoImage shows fallback
                  console.warn('Logo preview load warning:', error);
                }}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Icon name="add-photo-alternate" size={40} color={colors.textSecondary} />
                <Text style={styles.logoPlaceholderText(colors)}>{t('auth.uploadLogo')}</Text>
              </View>
            )}
          </TouchableOpacity>
          {logoActions.hasLogo && (
            <TouchableOpacity
              style={styles.removeLogoButton}
              onPress={handleRemoveLogo}
            >
              <Icon name="delete" size={20} color={colors.error} />
              <Text style={styles.removeLogoText(colors)}>{t('auth.removeLogo')}</Text>
            </TouchableOpacity>
          )}
          {logoActions.showDeleteWarning && (
            <Text style={[styles.pendingDeletionText(colors), isRTL && styles.pendingDeletionTextRTL]}>
              {t('profile.logoWillBeDeleted') || 'Logo will be deleted when you save'}
            </Text>
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
            <View style={styles.saveButtonContent}>
              <ActivityIndicator color={colors.textInverse} size="small" />
              {isUploading && uploadProgress > 0 && (
                <Text style={styles.uploadProgressText}>
                  {uploadProgress}%
                </Text>
              )}
            </View>
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
  logoUploadButtonDisabled: {
    opacity: 0.6,
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
  logoPreviewContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: 'transparent',
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
  saveButtonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  uploadProgressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  pendingDeletionText: (colors: any) => ({
    fontSize: 12,
    color: colors.error,
    textAlign: 'center' as const,
    marginTop: 8,
    fontStyle: 'italic' as const,
  }),
  pendingDeletionTextRTL: {
    textAlign: 'right' as const,
  },
};
