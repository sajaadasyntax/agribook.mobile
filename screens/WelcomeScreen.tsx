import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useI18n } from '../src/context/I18nContext';
import { useUser } from '../src/context/UserContext';
import { useTheme } from '../src/context/ThemeContext';

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
  const [loading, setLoading] = useState(false);

  // Reset loading when authentication succeeds
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated]);


  const handleSubmit = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // For sign in, require phone and password
      if (isSignIn && !phone) {
        Alert.alert(t('app.error'), t('auth.phoneRequired'));
        setLoading(false);
        return;
      }

      if (isSignIn && !password) {
        Alert.alert(t('app.error'), t('auth.passwordRequired'));
        setLoading(false);
        return;
      }

      // For registration, require name
      if (!isSignIn && !name) {
        Alert.alert(t('app.error'), t('auth.nameRequired'));
        setLoading(false);
        return;
      }

      // Validate email if provided
      if (email && !email.includes('@')) {
        Alert.alert(t('app.error'), t('auth.invalidEmail'));
        setLoading(false);
        return;
      }

      // Login or register based on mode
      if (isSignIn) {
        // Login: phone and password required (no email)
        await login(undefined, phone || undefined, password || undefined);
      } else {
        // Register: name is required, password recommended, other fields optional (no logo)
        await register(
          email || undefined,
          name || undefined,
          phone || undefined,
          password || undefined,
          companyName || undefined,
          undefined, // No logo upload
          undefined // No upload progress
        );
      }
      
      // Navigation will happen automatically when isAuthenticated becomes true
      // Keep loading state true until navigation happens
      } catch (error) {
      console.error('Error authenticating:', error);
      // Provide more specific error message
      let errorMessage = t('auth.error');
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('connection')) {
          errorMessage = t('app.networkError') || 'Network error. Please check your connection.';
        }
      }
      Alert.alert(t('app.error'), errorMessage);
      setLoading(false);
    }
  };

  // Dynamic text direction style for Android compatibility
  const textDirection = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { direction: textDirection, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="agriculture" size={80} color="#4CAF50" />
          </View>
          <Text style={[styles.title, { textAlign: 'center' }]}>
            {isSignIn ? t('auth.signIn') : t('auth.welcome')}
          </Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>
            {isSignIn ? t('auth.signInDesc') : t('auth.signUpDesc')}
          </Text>
        </View>

        {/* Toggle between Sign In and Sign Up */}
        <View style={[styles.toggleContainer]}>
          <TouchableOpacity
            style={[styles.toggleButton, !isSignIn && styles.toggleButtonActive]}
            onPress={() => setIsSignIn(false)}
          >
            <Text style={[styles.toggleText, !isSignIn && styles.toggleTextActive, isRTL && styles.textRTL]}>
              {t('auth.signUp')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isSignIn && styles.toggleButtonActive]}
            onPress={() => setIsSignIn(true)}
          >
            <Text style={[styles.toggleText, isSignIn && styles.toggleTextActive, isRTL && styles.textRTL]}>
              {t('auth.signIn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name Input - Only show for Sign Up */}
          {!isSignIn && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign }]}>{t('auth.name')}</Text>
              <View style={styles.inputWrapper}>
                <Icon name="person" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { textAlign }]}
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChangeText={setName}
                  textAlign={textAlign}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Email Input - Only for Sign Up */}
          {!isSignIn && (
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { textAlign }]}>{t('auth.email')}</Text>
                <Text style={[styles.optional, { textAlign }]}>{t('auth.optional')}</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Icon name="email" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { textAlign }]}
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                  textAlign={textAlign}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { textAlign }]}>{t('auth.phone')}</Text>
              {!isSignIn && <Text style={[styles.optional, { textAlign }]}>{t('auth.optional')}</Text>}
            </View>
            <View style={styles.inputWrapper}>
              <Icon name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign }]}
                placeholder={t('auth.phonePlaceholder')}
                value={phone}
                onChangeText={setPhone}
                textAlign={textAlign}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { textAlign }]}>{t('auth.password') || 'Password'}</Text>
              {!isSignIn && <Text style={[styles.optional, { textAlign }]}>{t('auth.optional')}</Text>}
            </View>
            <View style={styles.inputWrapper}>
              <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign, flex: 1 }]}
                placeholder={t('auth.passwordPlaceholder') || 'Enter password'}
                value={password}
                onChangeText={setPassword}
                textAlign={textAlign}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {!isSignIn && (
              <Text style={[styles.passwordHint, { textAlign, marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }]}>
                {t('auth.passwordHint') || 'Min 6 characters. Set a password to secure your account.'}
              </Text>
            )}
          </View>

          {/* Company Name - Only for Sign Up */}
          {!isSignIn && (
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { textAlign }]}>{t('auth.companyName')}</Text>
                <Text style={[styles.optional, { textAlign }]}>{t('auth.optional')}</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Icon name="business" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { textAlign }]}
                  placeholder={t('auth.companyNamePlaceholder')}
                  value={companyName}
                  onChangeText={setCompanyName}
                  textAlign={textAlign}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}


          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <>
                <Text style={[styles.buttonText, isRTL && styles.textRTL]}>
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
            <Text style={[styles.switchModeText, { textAlign: 'center' }]}>
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
    textAlign: 'left',
  },
  labelRTL: {
    textAlign: 'right',
  },
  labelRowRTL: {
  },
  optional: {
    fontSize: 12,
    color: '#999',
  },
  textRTL: {
    textAlign: 'right',
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
  },
  inputIcon: {
    marginHorizontal: 12,
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
  passwordHintRTL: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },
  inputRTL: {
    writingDirection: 'rtl',
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
  buttonRTL: {
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadProgressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  toggleContainerRTL: {
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
  logoPreviewContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  removeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
  },
  removeLogoButtonRTL: {
    flexDirection: 'row-reverse',
  },
  removeLogoText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#F44336',
  },
  removeLogoTextRTL: {
    marginLeft: 0,
    marginRight: 4,
  },
});
