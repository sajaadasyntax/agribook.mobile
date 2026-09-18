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

// Arabic-first: Force RTL layout at app initialization (before any component renders)
// This ensures the entire app starts with RTL layout for Arabic
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

import HomeScreen from './screens/HomeScreen';
import AddScreen from './screens/AddScreen';
import ReportsScreen from './screens/ReportsScreen';
import LatestTransactionsScreen from './screens/LatestTransactionsScreen';
import TransactionDetailsScreen from './screens/TransactionDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs(): React.JSX.Element {
  const { isRTL, t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      key={isRTL ? 'rtl' : 'ltr'}
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
          } else if (route.name === 'LatestTransactions') {
            iconName = 'receipt-long';
          } else {
            iconName = 'help';
          }

          return <Icon name={iconName as React.ComponentProps<typeof Icon>['name']} size={size} color={color} />;
        },
        tabBarLabel: ({ focused, color }) => {
          const labels: Record<string, string> = {
            'Home': t('navigation.home'),
            'Add': t('navigation.add'),
            'Reports': t('navigation.reports'),
            'LatestTransactions': t('navigation.latestTransactions'),
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
      <Tab.Screen name="LatestTransactions" component={LatestTransactionsScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator(): React.JSX.Element {
  const { isRTL } = useI18n();

  // Handle RTL layout changes - ensure RTL is properly set based on locale
  useEffect(() => {
    // Force RTL layout when locale is Arabic (works on both Android and iOS)
    const shouldBeRTL = isRTL;
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      // Note: Full RTL change requires app restart, but UI components with key prop will update
    }
  }, [isRTL]); // Update when RTL status changes

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App(): React.JSX.Element {
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
