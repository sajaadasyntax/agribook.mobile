import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import { useI18n } from '../src/context/I18nContext';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingPage {
  icon: string;
  title: string;
  description: string;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps): JSX.Element {
  const { t, isRTL } = useI18n();
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const pages: OnboardingPage[] = [
    {
      icon: 'agriculture',
      title: t('onboarding.welcome'),
      description: t('onboarding.welcomeDesc'),
    },
    {
      icon: 'account-balance-wallet',
      title: t('onboarding.trackFinances'),
      description: t('onboarding.trackFinancesDesc'),
    },
    {
      icon: 'assessment',
      title: t('onboarding.reports'),
      description: t('onboarding.reportsDesc'),
    },
    {
      icon: 'notifications-active',
      title: t('onboarding.alerts'),
      description: t('onboarding.alertsDesc'),
    },
  ];

  const handleNext = (): void => {
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1;
      pagerRef.current?.setPage(nextPage);
      setCurrentPage(nextPage);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = (): void => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      pagerRef.current?.setPage(prevPage);
      setCurrentPage(prevPage);
    }
  };

  const handleSkip = async (): Promise<void> => {
    await SecureStore.setItemAsync('onboarding_completed', 'true');
    onComplete();
  };

  const handleComplete = async (): Promise<void> => {
    await SecureStore.setItemAsync('onboarding_completed', 'true');
    onComplete();
  };

  const handlePageSelected = (e: { nativeEvent: { position: number } }): void => {
    setCurrentPage(e.nativeEvent.position);
  };

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity style={[styles.skipButton, isRTL && styles.skipButtonRTL]} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      {/* Pager View */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {pages.map((page, index) => (
          <View key={index} style={styles.page}>
            <View style={styles.iconContainer}>
              <Icon name={page.icon as any} size={120} color="#4CAF50" />
            </View>
            <Text style={[styles.title, isRTL && styles.titleRTL]}>{page.title}</Text>
            <Text style={[styles.description, isRTL && styles.descriptionRTL]}>
              {page.description}
            </Text>
          </View>
        ))}
      </PagerView>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentPage === index && styles.dotActive,
              isRTL && styles.dotRTL,
            ]}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={[styles.navigation, isRTL && styles.navigationRTL]}>
        {currentPage > 0 && (
          <TouchableOpacity style={styles.navButton} onPress={handlePrevious}>
            <Icon name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#4CAF50" />
            <Text style={styles.navButtonText}>{t('onboarding.previous')}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.spacer} />
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
          <Text style={styles.primaryButtonText}>
            {currentPage === pages.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
          </Text>
          <Icon
            name={isRTL ? 'arrow-back' : 'arrow-forward'}
            size={24}
            color="#fff"
            style={styles.buttonIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipButtonRTL: {
    right: undefined,
    left: 20,
  },
  skipButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  iconContainer: {
    marginBottom: 40,
    backgroundColor: '#fff',
    borderRadius: 100,
    padding: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  titleRTL: {
    textAlign: 'right',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  descriptionRTL: {
    textAlign: 'right',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BDBDBD',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#4CAF50',
  },
  dotRTL: {
    marginHorizontal: 4,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navigationRTL: {
    flexDirection: 'row-reverse',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  navButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: 0,
  },
});

