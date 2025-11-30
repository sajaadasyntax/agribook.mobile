import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../src/context/I18nContext';
import { useUser } from '../src/context/UserContext';
import { useTheme } from '../src/context/ThemeContext';
import { getAbsoluteLogoUrl } from '../src/utils/logoUrl';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps): React.JSX.Element {
  const { t, isRTL } = useI18n();
  const { login, register, isAuthenticated } = useUser();
  const { colors } = useTheme();
  const [isSignIn, setIsSignIn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoFileUri, setLogoFileUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  // Reset loading when authentication succeeds
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleSubmit = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // For sign in, require email or phone
      if (isSignIn && !email && !phone) {
        Alert.alert(t('app.error'), t('auth.loginRequired'));
        setLoading(false);
        return;
      }

      // For registration, require name
      if (!isSignIn && !name) {
        Alert.alert(t('app.error'), 'Name is required for registration');
        setLoading(false);
        return;
      }

      // Validate email if provided
      if (email && !email.includes('@')) {
        Alert.alert(t('app.error'), 'Please enter a valid email address');
        setLoading(false);
        return;
      }

      // Login or register based on mode
      if (isSignIn) {
        // Login: email/phone and password required
        await login(email || undefined, phone || undefined, password || undefined);
      } else {
        // Register: name is required, password recommended, other fields optional
        await register(
          email || undefined,
          name || undefined,
          phone || undefined,
          password || undefined,
          companyName || undefined,
          logoFileUri || undefined
        );
      }
      
      // Navigation will happen automatically when isAuthenticated becomes true
      // Keep loading state true until navigation happens
    } catch (error) {
      console.error('Error authenticating:', error);
      Alert.alert(t('app.error'), t('auth.error'));
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="agriculture" size={80} color="#4CAF50" />
          </View>
          <Text style={[styles.title, isRTL && styles.titleRTL]}>
            {isSignIn ? t('auth.signIn') : t('auth.welcome')}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.subtitleRTL]}>
            {isSignIn ? t('auth.signInDesc') : t('auth.signUpDesc')}
          </Text>
        </View>

        {/* Toggle between Sign In and Sign Up */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !isSignIn && styles.toggleButtonActive]}
            onPress={() => setIsSignIn(false)}
          >
            <Text style={[styles.toggleText, !isSignIn && styles.toggleTextActive]}>
              {t('auth.signUp')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isSignIn && styles.toggleButtonActive]}
            onPress={() => setIsSignIn(true)}
          >
            <Text style={[styles.toggleText, isSignIn && styles.toggleTextActive]}>
              {t('auth.signIn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name Input - Only show for Sign Up */}
          {!isSignIn && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>{t('auth.name')}</Text>
              <View style={[styles.inputWrapper, isRTL && styles.inputWrapperRTL]}>
                <Icon name="person" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isRTL && styles.inputRTL]}
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChangeText={setName}
                  textAlign={isRTL ? 'right' : 'left'}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>{t('auth.email')}</Text>
              {!isSignIn && <Text style={styles.optional}>{t('auth.optional')}</Text>}
            </View>
            <View style={[styles.inputWrapper, isRTL && styles.inputWrapperRTL]}>
              <Icon name="email" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isRTL && styles.inputRTL]}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                textAlign={isRTL ? 'right' : 'left'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>{t('auth.phone')}</Text>
              {!isSignIn && <Text style={styles.optional}>{t('auth.optional')}</Text>}
            </View>
            <View style={[styles.inputWrapper, isRTL && styles.inputWrapperRTL]}>
              <Icon name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isRTL && styles.inputRTL]}
                placeholder={t('auth.phonePlaceholder')}
                value={phone}
                onChangeText={setPhone}
                textAlign={isRTL ? 'right' : 'left'}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>{t('auth.password') || 'Password'}</Text>
              {!isSignIn && <Text style={styles.optional}>{t('auth.optional')}</Text>}
            </View>
            <View style={[styles.inputWrapper, isRTL && styles.inputWrapperRTL]}>
              <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isRTL && styles.inputRTL, { flex: 1 }]}
                placeholder={t('auth.passwordPlaceholder') || 'Enter password'}
                value={password}
                onChangeText={setPassword}
                textAlign={isRTL ? 'right' : 'left'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {!isSignIn && (
              <Text style={styles.passwordHint}>
                {t('auth.passwordHint') || 'Min 6 characters. Set a password to secure your account.'}
              </Text>
            )}
          </View>

          {/* Company Name - Only for Sign Up */}
          {!isSignIn && (
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, isRTL && styles.labelRTL]}>{t('auth.companyName')}</Text>
                <Text style={styles.optional}>{t('auth.optional')}</Text>
              </View>
              <View style={[styles.inputWrapper, isRTL && styles.inputWrapperRTL]}>
                <Icon name="business" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isRTL && styles.inputRTL]}
                  placeholder={t('auth.companyNamePlaceholder')}
                  value={companyName}
                  onChangeText={setCompanyName}
                  textAlign={isRTL ? 'right' : 'left'}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Logo Upload - Only for Sign Up */}
          {!isSignIn && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.labelRTL]}>{t('auth.companyLogo')}</Text>
              <TouchableOpacity
                style={[styles.logoUploadButton, isRTL && styles.logoUploadButtonRTL, pickingImage && styles.logoUploadButtonDisabled]}
                onPress={async () => {
                  if (pickingImage) return; // Prevent multiple clicks
                  
                  try {
                    setPickingImage(true);
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert(t('app.error'), t('auth.permissionDenied'));
                      setPickingImage(false);
                      return;
                    }

                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: true,
                      aspect: [1, 1],
                      quality: 0.8,
                      base64: false, // Use file upload instead of base64
                    });

                    if (!result.canceled && result.assets[0]) {
                      const asset = result.assets[0];
                      
                      // Validate file size (5MB limit)
                      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
                      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                        Alert.alert(
                          t('app.error'),
                          t('auth.fileTooLarge') || 'File size must be less than 5MB'
                        );
                        setPickingImage(false);
                        return;
                      }
                      
                      setLogoUri(asset.uri);
                      setLogoFileUri(asset.uri); // Store file URI for upload
                    }
                  } catch (error) {
                    console.error('Error picking image:', error);
                    Alert.alert(t('app.error'), t('auth.errorUploadingLogo'));
                  } finally {
                    setPickingImage(false);
                  }
                }}
                disabled={pickingImage}
              >
                {pickingImage ? (
                  <ActivityIndicator size="large" color="#4CAF50" />
                ) : logoUri ? (
                  <Image 
                    source={{ uri: getAbsoluteLogoUrl(logoUri) || logoUri }} 
                    style={styles.logoPreview}
                    onError={(error) => {
                      console.error('Logo load error:', error);
                      Alert.alert(t('app.error'), t('auth.errorUploadingLogo') || 'Failed to load image');
                    }}
                  />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Icon name="add-photo-alternate" size={40} color="#999" />
                    <Text style={styles.logoPlaceholderText}>{t('auth.uploadLogo')}</Text>
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
                  <Icon name="delete" size={20} color="#F44336" />
                  <Text style={styles.removeLogoText}>{t('auth.removeLogo')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>
                  {isSignIn ? t('auth.signIn') : t('auth.createAccount')}
                </Text>
                <Icon name={isRTL ? 'arrow-back' : 'arrow-forward'} size={24} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Switch Mode Link */}
          <TouchableOpacity
            style={styles.switchModeContainer}
            onPress={() => setIsSignIn(!isSignIn)}
          >
            <Text style={[styles.switchModeText, isRTL && styles.switchModeTextRTL]}>
              {isSignIn ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}{' '}
              <Text style={styles.switchModeLink}>
                {isSignIn ? t('auth.signUp') : t('auth.signIn')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconContainer: {
    backgroundColor: '#fff',
    borderRadius: 100,
    padding: 30,
    marginBottom: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  titleRTL: {
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  subtitleRTL: {
    textAlign: 'right',
  },
  form: {
    flex: 1,
    paddingTop: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  labelRTL: {
    textAlign: 'right',
  },
  optional: {
    fontSize: 12,
    color: '#999',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperRTL: {
    flexDirection: 'row-reverse',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 8,
  },
  passwordHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    marginLeft: 4,
  },
  inputRTL: {
    textAlign: 'right',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  infoTextRTL: {
    textAlign: 'right',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  switchModeContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  switchModeTextRTL: {
    textAlign: 'right',
  },
  switchModeLink: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  logoUploadButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  logoUploadButtonRTL: {
    alignSelf: 'center',
  },
  logoUploadButtonDisabled: {
    opacity: 0.6,
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  logoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
  },
  removeLogoText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#F44336',
  },
});

