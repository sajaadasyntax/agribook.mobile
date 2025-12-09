/**
 * Centralized Error Handler Utility
 * Provides consistent error detection and message formatting across the app
 */

export interface ErrorInfo {
  isNetworkError: boolean;
  isServerError: boolean;
  isAuthError: boolean;
  isValidationError: boolean;
  isDuplicateError: boolean;
  isNotFoundError: boolean;
  isTimeoutError: boolean;
  errorMessage: string;
  errorCode?: string;
  statusCode?: number;
}

/**
 * Detects error type from an error object
 * Works with Axios errors, API errors, and generic errors
 */
export const detectErrorType = (error: unknown): ErrorInfo => {
  // Default values
  const result: ErrorInfo = {
    isNetworkError: false,
    isServerError: false,
    isAuthError: false,
    isValidationError: false,
    isDuplicateError: false,
    isNotFoundError: false,
    isTimeoutError: false,
    errorMessage: 'An unexpected error occurred',
    errorCode: undefined,
    statusCode: undefined,
  };

  if (!error) {
    return result;
  }

  // Handle string errors
  if (typeof error === 'string') {
    result.errorMessage = error;
    analyzeErrorMessage(error.toLowerCase(), result);
    return result;
  }

  // Handle Error objects
  if (error instanceof Error) {
    result.errorMessage = error.message;
    const errorMsg = error.message.toLowerCase();
    
    // Check for Axios error properties
    const axiosError = error as any;
    if (axiosError.response) {
      result.statusCode = axiosError.response.status;
      const responseData = axiosError.response.data;
      
      if (responseData?.error) {
        result.errorMessage = responseData.error;
      } else if (responseData?.message) {
        result.errorMessage = responseData.message;
      }
      
      if (responseData?.code) {
        result.errorCode = responseData.code;
      }
    }
    
    if (axiosError.code) {
      result.errorCode = axiosError.code;
    }
    
    analyzeErrorMessage(errorMsg, result);
    analyzeStatusCode(result.statusCode, result);
    analyzeErrorCode(result.errorCode, result);
  }

  return result;
};

/**
 * Analyzes error message for patterns
 */
const analyzeErrorMessage = (errorMsg: string, result: ErrorInfo): void => {
  // Network errors
  if (
    errorMsg.includes('network') ||
    errorMsg.includes('econnrefused') ||
    errorMsg.includes('enotfound') ||
    errorMsg.includes('getaddrinfo') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('socket')
  ) {
    result.isNetworkError = true;
  }

  // Timeout errors
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    result.isTimeoutError = true;
    result.isNetworkError = true;
  }

  // Auth errors
  if (
    errorMsg.includes('authentication') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('invalid token') ||
    errorMsg.includes('expired') ||
    errorMsg.includes('invalid password') ||
    errorMsg.includes('log in')
  ) {
    result.isAuthError = true;
  }

  // Validation errors
  if (
    errorMsg.includes('validation') ||
    errorMsg.includes('invalid') ||
    errorMsg.includes('required')
  ) {
    result.isValidationError = true;
  }

  // Duplicate/conflict errors
  if (
    errorMsg.includes('already exists') ||
    errorMsg.includes('duplicate') ||
    errorMsg.includes('conflict')
  ) {
    result.isDuplicateError = true;
  }

  // Not found errors
  if (errorMsg.includes('not found')) {
    result.isNotFoundError = true;
  }

  // Server errors
  if (
    errorMsg.includes('internal server') ||
    errorMsg.includes('server error') ||
    errorMsg.includes('database error')
  ) {
    result.isServerError = true;
  }
};

/**
 * Analyzes HTTP status code
 */
const analyzeStatusCode = (statusCode: number | undefined, result: ErrorInfo): void => {
  if (!statusCode) return;

  switch (statusCode) {
    case 400:
      result.isValidationError = true;
      break;
    case 401:
    case 403:
      result.isAuthError = true;
      break;
    case 404:
      result.isNotFoundError = true;
      break;
    case 409:
      result.isDuplicateError = true;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      result.isServerError = true;
      break;
  }
};

/**
 * Analyzes error codes
 */
const analyzeErrorCode = (errorCode: string | undefined, result: ErrorInfo): void => {
  if (!errorCode) return;

  const code = errorCode.toUpperCase();
  
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    result.isTimeoutError = true;
    result.isNetworkError = true;
  }
  
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    result.isNetworkError = true;
  }
};

/**
 * Gets a user-friendly error message
 * @param error The error to analyze
 * @param context Optional context for better error messages
 * @param isDev Whether to show detailed dev messages
 * @param t Optional translation function
 */
export const getUserFriendlyMessage = (
  error: unknown,
  context?: string,
  isDev: boolean = __DEV__,
  t?: (key: string) => string
): string => {
  const errorInfo = detectErrorType(error);
  const contextPrefix = context ? `${context}: ` : '';

  // Helper to get translation or fallback
  const translate = (key: string, fallback: string): string => {
    if (t) {
      const translated = t(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return fallback;
  };

  // Check if there's an error code we can translate
  if (errorInfo.errorCode && t) {
    const translated = t(`errors.${errorInfo.errorCode}`);
    if (translated && translated !== `errors.${errorInfo.errorCode}`) {
      return translated;
    }
  }

  if (errorInfo.isTimeoutError) {
    return isDev
      ? `${contextPrefix}Request timed out. Check your connection and server status.`
      : translate('errors.timeout', 'Request timed out. Please try again.');
  }

  if (errorInfo.isNetworkError) {
    return isDev
      ? `${contextPrefix}Network error: ${errorInfo.errorMessage}`
      : translate('errors.networkError', 'Network error. Please check your connection.');
  }

  if (errorInfo.isAuthError) {
    if (errorInfo.errorMessage.toLowerCase().includes('invalid password')) {
      return translate('errors.INVALID_CREDENTIALS', 'Invalid password. Please try again.');
    }
    if (errorInfo.errorMessage.toLowerCase().includes('not found')) {
      return translate('errors.USER_NOT_FOUND', 'User not found. Please register first.');
    }
    return isDev
      ? `${contextPrefix}Authentication error: ${errorInfo.errorMessage}`
      : translate('errors.UNAUTHORIZED', 'Please log in again.');
  }

  if (errorInfo.isValidationError) {
    return errorInfo.errorMessage;
  }

  if (errorInfo.isDuplicateError) {
    const msg = errorInfo.errorMessage.toLowerCase();
    if (msg.includes('phone')) {
      return translate('errors.PHONE_ALREADY_EXISTS', errorInfo.errorMessage);
    }
    if (msg.includes('email')) {
      return translate('errors.EMAIL_ALREADY_EXISTS', errorInfo.errorMessage);
    }
    if (msg.includes('category')) {
      return translate('errors.CATEGORY_ALREADY_EXISTS', errorInfo.errorMessage);
    }
    return errorInfo.errorMessage;
  }

  if (errorInfo.isNotFoundError) {
    return isDev
      ? `${contextPrefix}Not found: ${errorInfo.errorMessage}`
      : translate('errors.NOT_FOUND', 'The requested item was not found.');
  }

  if (errorInfo.isServerError) {
    return isDev
      ? `${contextPrefix}Server error: ${errorInfo.errorMessage}`
      : translate('errors.serverError', 'Server error. Please try again later.');
  }

  // Default message
  return isDev 
    ? `${contextPrefix}${errorInfo.errorMessage}` 
    : translate('errors.generic', 'An error occurred. Please try again.');
};

/**
 * Determines if the error is recoverable (user can retry)
 */
export const isRecoverableError = (error: unknown): boolean => {
  const errorInfo = detectErrorType(error);
  
  // Network and timeout errors are usually recoverable
  if (errorInfo.isNetworkError || errorInfo.isTimeoutError) {
    return true;
  }
  
  // Server errors might be temporary
  if (errorInfo.isServerError) {
    return true;
  }
  
  // Auth errors require user action (re-login)
  // Validation, duplicate, and not-found errors are not recoverable by retry
  return false;
};

/**
 * Determines if user should be redirected to login
 */
export const requiresReauth = (error: unknown): boolean => {
  const errorInfo = detectErrorType(error);
  
  if (errorInfo.isAuthError) {
    // If it's just invalid password, don't force re-auth
    if (errorInfo.errorMessage.toLowerCase().includes('invalid password')) {
      return false;
    }
    return true;
  }
  
  return errorInfo.statusCode === 401;
};

export default {
  detectErrorType,
  getUserFriendlyMessage,
  isRecoverableError,
  requiresReauth,
};

