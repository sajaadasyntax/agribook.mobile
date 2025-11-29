import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { I18nManager, Platform, View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { UserProvider, useUser } from './src/context/UserContext';
import { I18nProvider, useI18n } from './src/context/I18nContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import syncService from './src/services/sync.service';

import HomeScreen from './screens/HomeScreen';
import AddScreen from './screens/AddScreen';
import ReportsScreen from './screens/ReportsScreen';
import AlertsScreen from './screens/AlertsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileScreen from './screens/ProfileScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import LockScreen from './screens/LockScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs(): JSX.Element {
  const { isRTL, t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        direction: isRTL ? 'rtl' : 'ltr',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Add') {
            iconName = 'add-circle';
          } else if (route.name === 'Reports') {
            iconName = 'assessment';
          } else if (route.name === 'Alerts') {
            iconName = 'notifications';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          } else {
            iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarLabel: ({ focused, color }) => {
          const labels: Record<string, string> = {
            'Home': t('navigation.home'),
            'Add': t('navigation.add'),
            'Reports': t('navigation.reports'),
            'Alerts': t('navigation.alerts'),
            'Profile': t('navigation.profile'),
          };
          return labels[route.name] || route.name;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator(): JSX.Element {
  const { isAuthenticated, isLoading, settings, user, refreshUser } = useUser();
  const { isRTL, locale } = useI18n();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);
  const navigationRef = React.useRef<NavigationContainerRef<any>>(null);

  // Handle RTL layout changes
  useEffect(() => {
    if (Platform.OS === 'android' && I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
      // Reload is required on Android
      if (Platform.OS === 'android') {
        require('react-native').NativeModules.DevSettings?.reload?.();
      }
    }
  }, [isRTL, locale]);

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async (): Promise<void> => {
      try {
        const completed = await SecureStore.getItemAsync('onboarding_completed');
        setOnboardingCompleted(completed === 'true');
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setOnboardingCompleted(false);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  // Check if PIN lock is enabled and should lock the app
  useEffect(() => {
    const checkLockStatus = async (): Promise<void> => {
      try {
        // Only check lock if user is authenticated
        if (!isAuthenticated || isLoading) {
          setCheckingLock(false);
          return;
        }

        // Check if PIN is enabled in settings
        if (settings?.pinEnabled) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      } catch (error) {
        console.error('Error checking lock status:', error);
        setIsLocked(false);
      } finally {
        setCheckingLock(false);
      }
    };

    checkLockStatus();
  }, [isAuthenticated, isLoading, settings?.pinEnabled]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    let lastBackground = Date.now();
    const LOCK_TIMEOUT = 60000; // 1 minute - lock after this much time in background

    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === 'background') {
        lastBackground = Date.now();
      } else if (nextAppState === 'active') {
        // Only lock if user has PIN enabled and was in background for a while
        const timeInBackground = Date.now() - lastBackground;
        if (settings?.pinEnabled && timeInBackground > LOCK_TIMEOUT) {
          setIsLocked(true);
        }
        
        // Refresh user data when coming back to foreground
        if (isAuthenticated && user) {
          refreshUser();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [settings?.pinEnabled, isAuthenticated, user, refreshUser]);

  // Navigate based on authentication and onboarding status
  useEffect(() => {
    if (checkingOnboarding || onboardingCompleted === null) return;

    if (!onboardingCompleted) {
      navigationRef.current?.navigate('Onboarding');
    } else if (!isAuthenticated && !isLoading) {
      navigationRef.current?.navigate('Welcome');
    } else if (isAuthenticated) {
      navigationRef.current?.navigate('Main');
    }
  }, [onboardingCompleted, isAuthenticated, isLoading, checkingOnboarding]);

  const handleOnboardingComplete = (): void => {
    setOnboardingCompleted(true);
  };

  const handleWelcomeComplete = (): void => {
    // User is created in WelcomeScreen
    // Navigation will happen automatically when isAuthenticated becomes true
  };

  const handleUnlock = useCallback((): void => {
    setIsLocked(false);
  }, []);

  // Show loading while checking onboarding/lock status
  if (checkingOnboarding || (isAuthenticated && checkingLock)) {
    const { colors } = useTheme();
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show lock screen if locked
  if (isAuthenticated && isLocked && settings?.pinEnabled) {
    return (
      <LockScreen 
        onUnlock={handleUnlock}
        fingerprintEnabled={settings?.fingerprintEnabled || false}
      />
    );
  }

  // Determine initial route
  const getInitialRoute = (): string => {
    if (!onboardingCompleted) return 'Onboarding';
    if (!isAuthenticated && !isLoading) return 'Welcome';
    return 'Main';
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onComplete={handleOnboardingComplete} />}
        </Stack.Screen>
        <Stack.Screen name="Welcome">
          {() => <WelcomeScreen onComplete={handleWelcomeComplete} />}
        </Stack.Screen>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppNavigator />
          </I18nProvider>
        </ThemeProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
