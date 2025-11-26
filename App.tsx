import React, { useEffect, useState } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { I18nManager, Platform, View, ActivityIndicator } from 'react-native';
import { UserProvider, useUser } from './src/context/UserContext';
import { I18nProvider, useI18n } from './src/context/I18nContext';
import * as SecureStore from 'expo-secure-store';
import { userApi } from './src/services/api.service';

import HomeScreen from './screens/HomeScreen';
import AddScreen from './screens/AddScreen';
import ReportsScreen from './screens/ReportsScreen';
import AlertsScreen from './screens/AlertsScreen';
import SettingsScreen from './screens/SettingsScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import WelcomeScreen from './screens/WelcomeScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs(): JSX.Element {
  const { isRTL } = useI18n();

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
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          } else {
            iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator(): JSX.Element {
  const { isAuthenticated, isLoading } = useUser();
  const { isRTL, locale } = useI18n();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
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

  // Show loading while checking onboarding status
  if (checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F5E9' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <I18nProvider>
          <AppNavigator />
        </I18nProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}

