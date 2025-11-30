import React, { useState, useCallback } from 'react';
import {
  Image,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ImageStyle,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { getAbsoluteLogoUrl } from '../utils/logoUrl';

interface LogoImageProps {
  /** Logo URL (can be relative or absolute) */
  uri: string | null | undefined;
  /** Image style */
  style?: ImageStyle;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Fallback icon size */
  fallbackIconSize?: number;
  /** Fallback icon color */
  fallbackIconColor?: string;
  /** Show loading indicator while loading */
  showLoading?: boolean;
  /** Fallback text to show (e.g., company initials) */
  fallbackText?: string;
  /** Resize mode */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: (error: string) => void;
}

/**
 * LogoImage Component
 * 
 * Renders a logo image with:
 * - Automatic URL resolution
 * - Loading state
 * - Error handling with fallback
 * - Retry capability
 */
export const LogoImage: React.FC<LogoImageProps> = ({
  uri,
  style,
  containerStyle,
  fallbackIconSize = 40,
  fallbackIconColor = '#999',
  showLoading = true,
  fallbackText,
  resizeMode = 'contain',
  onLoad,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Get absolute URL
  const absoluteUrl = getAbsoluteLogoUrl(uri);

  // Handle image load success
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image load error
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    const errorMsg = `Failed to load logo from: ${absoluteUrl}`;
    console.error(errorMsg);
    onError?.(errorMsg);
  }, [absoluteUrl, onError]);

  // Retry loading the image
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      setHasError(false);
      setIsLoading(true);
      setRetryCount(prev => prev + 1);
    }
  }, [retryCount]);

  // Calculate styles
  const imageStyle = StyleSheet.flatten([styles.image, style]) as ImageStyle;
  const containerStyleFlat = StyleSheet.flatten([styles.container, containerStyle]) as ViewStyle;

  // If no URL provided, show fallback
  if (!absoluteUrl) {
    return (
      <View style={[containerStyleFlat, styles.fallbackContainer]}>
        {fallbackText ? (
          <Text style={[styles.fallbackText, { fontSize: fallbackIconSize * 0.5 }]}>
            {fallbackText.substring(0, 2).toUpperCase()}
          </Text>
        ) : (
          <Icon name="business" size={fallbackIconSize} color={fallbackIconColor} />
        )}
      </View>
    );
  }

  // If error occurred, show fallback with retry option
  if (hasError) {
    return (
      <View 
        style={[containerStyleFlat, styles.fallbackContainer]}
        onTouchEnd={retryCount < 3 ? handleRetry : undefined}
      >
        <Icon name="broken-image" size={fallbackIconSize} color={fallbackIconColor} />
        {retryCount < 3 && (
          <Text style={styles.retryText}>Tap to retry</Text>
        )}
      </View>
    );
  }

  return (
    <View style={containerStyleFlat}>
      {showLoading && isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator size="small" color={fallbackIconColor} />
        </View>
      )}
      <Image
        key={retryCount} // Force re-render on retry
        source={{ uri: absoluteUrl }}
        style={imageStyle}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  fallbackText: {
    color: '#666',
    fontWeight: 'bold',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  retryText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
});

export default LogoImage;

