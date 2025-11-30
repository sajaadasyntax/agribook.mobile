// Import getApiUrl logic directly to avoid circular dependencies
// We'll duplicate the logic here since it's needed for logo URLs
const getApiBaseUrl = (): string => {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (envApiUrl && envApiUrl.trim() !== '') {
    let url = envApiUrl.trim();
    url = url.replace(/\/+$/, '');
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    if (url.endsWith('/api/')) {
      url = url.slice(0, -1);
    } else if (!url.endsWith('/api')) {
      url = `${url}/api`;
    }
    
    return url;
  }
  
  const DEV_API_HOST = process.env.EXPO_PUBLIC_API_HOST || 'localhost';
  const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT || '3001';
  const IS_ANDROID_EMULATOR = process.env.EXPO_PUBLIC_ANDROID_EMULATOR === 'true';
  
  if (IS_ANDROID_EMULATOR) {
    return `http://10.0.2.2:${DEV_API_PORT}/api`;
  }
  
  return `http://${DEV_API_HOST}:${DEV_API_PORT}/api`;
};

/**
 * Converts a logo URL to an absolute URL
 * Handles:
 * - Relative URLs (e.g., /uploads/logos/filename.jpg) -> converts to full URL
 * - Absolute URLs (e.g., http://..., https://..., data:...) -> returns as-is
 * 
 * @param logoUrl - The logo URL (can be relative or absolute)
 * @returns Absolute URL or null if logoUrl is null/undefined
 */
export const getAbsoluteLogoUrl = (logoUrl: string | null | undefined): string | null => {
  if (!logoUrl) return null;
  
  // If it's already an absolute URL (http, https, or data URI), return as-is
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:')) {
    return logoUrl;
  }
  
  // If it's a relative URL, construct the full URL using the API base URL
  // Remove /api from the base URL since /uploads is served at root level
  let apiBaseUrl = getApiBaseUrl();
  
  // Remove trailing /api if present
  if (apiBaseUrl.endsWith('/api')) {
    apiBaseUrl = apiBaseUrl.slice(0, -4); // Remove '/api'
  } else if (apiBaseUrl.endsWith('/api/')) {
    apiBaseUrl = apiBaseUrl.slice(0, -5); // Remove '/api/'
  }
  
  // Ensure apiBaseUrl doesn't end with a slash
  apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  
  // Ensure logoUrl starts with / for proper concatenation
  const relativePath = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
  
  // Construct full URL
  const fullUrl = `${apiBaseUrl}${relativePath}`;
  
  // Debug logging in development
  if (__DEV__) {
    console.log('Logo URL conversion:', {
      original: logoUrl,
      baseUrl: apiBaseUrl,
      relativePath,
      fullUrl,
    });
  }
  
  return fullUrl;
};

