import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Constants for image validation and optimization
export const IMAGE_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_DIMENSION: 1024, // Max width/height in pixels
  QUALITY: 0.8,
  ASPECT_RATIO: [1, 1] as [number, number],
};

// MIME type mapping for correct Content-Type headers
const MIME_TYPE_MAP: Record<string, string> = {
  'jpg': 'jpeg',
  'jpeg': 'jpeg',
  'png': 'png',
  'gif': 'gif',
  'webp': 'webp',
  'heic': 'jpeg', // HEIC images get converted to JPEG
  'heif': 'jpeg',
};

/**
 * Extract filename from various URI formats
 * Handles: file://, content://, ph://, and regular paths
 */
export const extractFilename = (uri: string): string => {
  // Remove query parameters and fragments
  const cleanUri = uri.split('?')[0].split('#')[0];
  
  // Handle different URI schemes
  if (cleanUri.startsWith('content://')) {
    // Android content URI - extract last segment or use default
    const segments = cleanUri.split('/');
    const lastSegment = segments[segments.length - 1];
    // Content URIs often have numeric IDs, not real filenames
    if (/^\d+$/.test(lastSegment)) {
      return `image_${Date.now()}.jpg`;
    }
    return lastSegment || `image_${Date.now()}.jpg`;
  }
  
  if (cleanUri.startsWith('ph://')) {
    // iOS Photo Library URI - use timestamp-based name
    return `photo_${Date.now()}.jpg`;
  }
  
  // For file:// and regular paths, extract the last segment
  const filename = cleanUri.split('/').pop();
  
  // If no valid filename found, generate one
  if (!filename || filename.length === 0) {
    return `image_${Date.now()}.jpg`;
  }
  
  return filename;
};

/**
 * Get the correct MIME type for a file URI
 */
export const getMimeType = (uri: string): string => {
  const filename = extractFilename(uri);
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mappedType = MIME_TYPE_MAP[ext] || 'jpeg';
  return `image/${mappedType}`;
};

/**
 * Get file extension from MIME type
 */
export const getExtensionFromMime = (mimeType: string): string => {
  const type = mimeType.split('/')[1];
  if (type === 'jpeg') return 'jpg';
  return type || 'jpg';
};

/**
 * Validate image dimensions
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export const validateImage = (asset: ImagePicker.ImagePickerAsset): ImageValidationResult => {
  const { width, height, fileSize } = asset;
  
  // Check file size
  if (fileSize && fileSize > IMAGE_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum of ${IMAGE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
      width,
      height,
      fileSize,
    };
  }
  
  return {
    valid: true,
    width,
    height,
    fileSize,
  };
};

/**
 * Optimize image by resizing and compressing
 * Returns the optimized image URI
 */
export const optimizeImage = async (
  uri: string,
  maxDimension: number = IMAGE_CONFIG.MAX_DIMENSION,
  quality: number = IMAGE_CONFIG.QUALITY
): Promise<{ uri: string; width: number; height: number }> => {
  try {
    // Get original dimensions by manipulating without resize first
    const info = await ImageManipulator.manipulateAsync(uri, [], { compress: 1 });
    
    const { width, height } = info;
    
    // Calculate new dimensions maintaining aspect ratio
    let newWidth = width;
    let newHeight = height;
    
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.round((height / width) * maxDimension);
      } else {
        newHeight = maxDimension;
        newWidth = Math.round((width / height) * maxDimension);
      }
    }
    
    // Only resize if needed
    const actions: ImageManipulator.Action[] = [];
    if (newWidth !== width || newHeight !== height) {
      actions.push({ resize: { width: newWidth, height: newHeight } });
    }
    
    // Apply optimization
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.warn('Image optimization failed, using original:', error);
    // Return original URI if optimization fails
    return { uri, width: 0, height: 0 };
  }
};

/**
 * Prepare image file data for FormData upload
 */
export interface PreparedImageFile {
  uri: string;
  name: string;
  type: string;
}

export const prepareImageForUpload = (uri: string): PreparedImageFile => {
  const filename = extractFilename(uri);
  const type = getMimeType(uri);
  
  return {
    uri,
    name: filename,
    type,
  };
};

/**
 * Pick and optimize an image from the library
 * Returns null if cancelled or failed
 */
export interface PickImageResult {
  uri: string;
  optimizedUri: string;
  width: number;
  height: number;
  fileSize?: number;
}

export const pickAndOptimizeImage = async (
  options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    maxDimension?: number;
  }
): Promise<PickImageResult | null> => {
  const {
    allowsEditing = true,
    aspect = IMAGE_CONFIG.ASPECT_RATIO,
    quality = IMAGE_CONFIG.QUALITY,
    maxDimension = IMAGE_CONFIG.MAX_DIMENSION,
  } = options || {};
  
  // Request permissions
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }
  
  // Launch image picker
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect,
    quality,
    base64: false,
  });
  
  if (result.canceled || !result.assets[0]) {
    return null;
  }
  
  const asset = result.assets[0];
  
  // Validate the image
  const validation = validateImage(asset);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Optimize the image
  const optimized = await optimizeImage(asset.uri, maxDimension, quality);
  
  return {
    uri: asset.uri,
    optimizedUri: optimized.uri,
    width: optimized.width || asset.width || 0,
    height: optimized.height || asset.height || 0,
    fileSize: asset.fileSize,
  };
};

/**
 * Standard error messages for image operations
 */
export const IMAGE_ERROR_MESSAGES = {
  PERMISSION_DENIED: 'Permission to access photos was denied',
  FILE_TOO_LARGE: 'File size must be less than 5MB',
  UPLOAD_FAILED: 'Failed to upload image. Please try again.',
  LOAD_FAILED: 'Failed to load image',
  OPTIMIZATION_FAILED: 'Failed to process image',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  TIMEOUT: 'Upload timed out. Please try again.',
};

/**
 * Get user-friendly error message from error
 */
export const getImageErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('permission') || msg === 'permission_denied') {
      return IMAGE_ERROR_MESSAGES.PERMISSION_DENIED;
    }
    if (msg.includes('size') || msg.includes('large')) {
      return IMAGE_ERROR_MESSAGES.FILE_TOO_LARGE;
    }
    if (msg.includes('network') || msg.includes('connection')) {
      return IMAGE_ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return IMAGE_ERROR_MESSAGES.TIMEOUT;
    }
    if (msg.includes('upload')) {
      return IMAGE_ERROR_MESSAGES.UPLOAD_FAILED;
    }
    
    // Return the original message if it's user-friendly
    if (error.message.length < 100 && !msg.includes('error')) {
      return error.message;
    }
  }
  
  return IMAGE_ERROR_MESSAGES.UPLOAD_FAILED;
};

