import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Vibration,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { settingsApi } from '../src/services/api.service';
import { useI18n } from '../src/context/I18nContext';

interface LockScreenProps {
  onUnlock: () => void;
  fingerprintEnabled?: boolean;
  onError?: (error: string) => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 30000; // 30 seconds

export default function LockScreen({ 
  onUnlock, 
  fingerprintEnabled = false,
  onError 
}: LockScreenProps): JSX.Element {
  const { t, isRTL } = useI18n();
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [biometricType, setBiometricType] = useState<string>('');
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const handleBiometricAuth = useCallback(async (): Promise<void> => {
    if (!showBiometricOption || loading || lockedOut) return;

    try {
      setLoading(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('lock.biometricPrompt') || 'Authenticate to unlock AgriBooks',
        cancelLabel: t('app.cancel') || 'Cancel',
        disableDeviceFallback: true,
        fallbackLabel: t('lock.usePin') || 'Use PIN',
      });

      if (result.success) {
        onUnlock();
      } else if (result.error === 'user_cancel') {
        // User cancelled, do nothing - in-app keypad is always available
      } else {
        // Show error for other failures
        if (onError) {
          onError(result.error || 'Biometric authentication failed');
        }
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      if (onError) {
        onError('An error occurred during biometric authentication');
      }
    } finally {
      setLoading(false);
    }
  }, [lockedOut, loading, onUnlock, showBiometricOption, t, onError]);

  const biometricAuthRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    biometricAuthRef.current = handleBiometricAuth;
  }, [handleBiometricAuth]);

  // Check biometric availability
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const checkBiometric = async (): Promise<void> => {
      if (!fingerprintEnabled) {
        setShowBiometricOption(false);
        return;
      }

      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (hasHardware && isEnrolled) {
          setShowBiometricOption(true);
          
          const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('Face ID');
          } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('Fingerprint');
          } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            setBiometricType('Iris');
          }
          
          // Auto-trigger biometric on mount
          timeoutId = setTimeout(() => biometricAuthRef.current?.(), 500);
        }
      } catch (error) {
        console.error('Error checking biometric:', error);
        setShowBiometricOption(false);
      }
    };

    checkBiometric();
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fingerprintEnabled]);

  // Lockout timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (lockedOut && lockoutRemaining > 0) {
      interval = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1000) {
            setLockedOut(false);
            setAttempts(0);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockedOut, lockoutRemaining]);

  const shakeError = (): void => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePinChange = (index: number, value: string): void => {
    if (lockedOut || loading) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    
    // Auto-verify when all 4 digits are entered
    if (index === 3 && value !== '') {
      const pinString = newPin.join('');
      if (pinString.length === 4) {
        verifyPin(pinString);
      }
    }
  };

  const verifyPin = async (pinString: string): Promise<void> => {
    if (lockedOut) return;
    
    try {
      setLoading(true);
      
      const result = await settingsApi.verifyPin({ pin: pinString });
      
      if (result.valid) {
        onUnlock();
      } else {
        handleFailedAttempt();
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      handleFailedAttempt();
    } finally {
      setLoading(false);
    }
  };

  const handleFailedAttempt = (): void => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setPin(['', '', '', '']);
    shakeError();
    
    if (newAttempts >= MAX_ATTEMPTS) {
      setLockedOut(true);
      setLockoutRemaining(LOCKOUT_TIME);
      Alert.alert(
        t('lock.tooManyAttempts') || 'Too Many Attempts',
        t('lock.tryAgainLater') || `Please try again in ${LOCKOUT_TIME / 1000} seconds.`,
        [{ text: t('app.ok') || 'OK' }]
      );
    } else {
      Alert.alert(
        t('lock.incorrectPin') || 'Incorrect PIN',
        t('lock.attemptsRemaining', { count: MAX_ATTEMPTS - newAttempts }) || 
          `${MAX_ATTEMPTS - newAttempts} attempts remaining.`,
        [{ text: t('app.ok') || 'OK' }]
      );
    }
  };

  const handleNumberPress = (num: string): void => {
    if (lockedOut || loading) return;
    
    const emptyIndex = pin.findIndex(digit => digit === '');
    if (emptyIndex !== -1) {
      handlePinChange(emptyIndex, num);
    }
  };

  const handleBackspace = (): void => {
    if (lockedOut || loading) return;
    
    const lastFilledIndex = pin.reduce((acc, digit, index) => 
      digit !== '' ? index : acc, -1);
    
    if (lastFilledIndex !== -1) {
      const newPin = [...pin];
      newPin[lastFilledIndex] = '';
      setPin(newPin);
    }
  };

  const formatLockoutTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="lock" size={60} color="#4CAF50" />
        <Text style={[styles.title, isRTL && styles.titleRTL]}>{t('lock.title') || 'AgriBooks'}</Text>
        <Text style={[styles.subtitle, isRTL && styles.subtitleRTL]}>
          {lockedOut 
            ? (t('lock.lockedOut', { time: formatLockoutTime(lockoutRemaining) }) || 
               `Locked. Try again in ${formatLockoutTime(lockoutRemaining)}`)
            : (t('lock.enterPin') || 'Enter your PIN to continue')
          }
        </Text>
      </View>

      <Animated.View 
        style={[
          styles.pinContainer,
          isRTL && styles.pinContainerRTL,
          { transform: [{ translateX: shakeAnimation }] }
        ]}
      >
        {pin.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              digit !== '' && styles.pinDotFilled,
              lockedOut && styles.pinDotDisabled,
            ]}
          >
            {digit !== '' && <View style={styles.pinDotInner} />}
          </View>
        ))}
      </Animated.View>

      {loading && (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      )}

      {/* Number pad */}
      <View style={[styles.numberPad, isRTL && styles.numberPadRTL]}>
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'back']].map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.numberRow, isRTL && styles.numberRowRTL]}>
            {row.map((num, colIndex) => {
              if (num === '') {
                return <View key={colIndex} style={styles.numberButtonEmpty} />;
              }
              if (num === 'back') {
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={styles.numberButton}
                    onPress={handleBackspace}
                    disabled={lockedOut || loading}
                  >
                    <Icon name="backspace" size={24} color={lockedOut ? '#ccc' : '#333'} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[
                    styles.numberButton,
                    lockedOut && styles.numberButtonDisabled,
                  ]}
                  onPress={() => handleNumberPress(num)}
                  disabled={lockedOut || loading}
                >
                  <Text style={[
                    styles.numberText,
                    lockedOut && styles.numberTextDisabled,
                  ]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Biometric button */}
      {showBiometricOption && !lockedOut && (
        <TouchableOpacity
          style={[styles.biometricButton, isRTL && styles.biometricButtonRTL]}
          onPress={handleBiometricAuth}
          disabled={loading}
        >
          <Icon name="fingerprint" size={32} color="#4CAF50" />
          <Text style={[styles.biometricText, isRTL && styles.biometricTextRTL]}>
            {t('lock.useBiometric', { type: biometricType }) || `Use ${biometricType}`}
          </Text>
        </TouchableOpacity>
      )}

      {attempts > 0 && !lockedOut && (
        <Text style={[styles.attemptsText, isRTL && styles.attemptsTextRTL]}>
          {t('lock.attemptsCount', { current: attempts, max: MAX_ATTEMPTS }) ||
            `Attempt ${attempts} of ${MAX_ATTEMPTS}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 16,
    textAlign: 'center',
  },
  titleRTL: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  subtitleRTL: {
    textAlign: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  pinContainerRTL: {
    flexDirection: 'row',
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDotFilled: {
    backgroundColor: '#4CAF50',
  },
  pinDotDisabled: {
    borderColor: '#ccc',
  },
  pinDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  loader: {
    marginBottom: 20,
  },
  numberPad: {
    width: '100%',
    maxWidth: 300,
  },
  numberPadRTL: {
    // RTL support handled at row level
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  numberRowRTL: {
    flexDirection: 'row',
  },
  numberButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  numberButtonEmpty: {
    width: 70,
    height: 70,
  },
  numberButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  numberText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
  },
  numberTextDisabled: {
    color: '#ccc',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  biometricButtonRTL: {
    flexDirection: 'row-reverse',
  },
  biometricText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'left',
  },
  biometricTextRTL: {
    textAlign: 'right',
  },
  attemptsText: {
    marginTop: 16,
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
  attemptsTextRTL: {
    textAlign: 'center',
  },
});

