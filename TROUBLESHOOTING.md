# Troubleshooting Expo App Issues

## Fixed Issues

### ✅ Icon Library Compatibility
- **Problem**: `react-native-vector-icons` is not compatible with Expo Go
- **Solution**: Replaced with `@expo/vector-icons` which works with Expo Go
- **Status**: Fixed - All icon imports updated

## Common Issues and Solutions

### 1. App Not Loading in Expo Go

**Symptoms**: App shows blank screen or error in Expo Go

**Solutions**:
- Clear Metro bundler cache: `npx expo start -c`
- Restart Expo Go app on your device
- Check for JavaScript errors in the terminal

### 2. Module Not Found Errors

**If you see module errors**:
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start -c
```

### 3. Chart Library Issues

If `react-native-chart-kit` causes issues, it requires:
- `react-native-svg` (already installed)
- Should work with Expo Go

### 4. Navigation Issues

If navigation doesn't work:
- Ensure all navigation dependencies are installed
- Check that screens are properly exported

## Testing the App

1. **Start the development server**:
   ```bash
   npx expo start
   ```

2. **Scan QR code** with:
   - **Android**: Expo Go app
   - **iOS**: Camera app (opens in Expo Go)

3. **Check for errors** in:
   - Terminal output
   - Expo Go app (shake device to open dev menu)

## If Issues Persist

1. Check the terminal for specific error messages
2. Try clearing cache: `npx expo start -c`
3. Restart Expo Go app
4. Check Expo Go version (update if needed)

## Development vs Production Build

- **Expo Go**: Limited to Expo-compatible packages
- **Development Build**: Can use custom native code
- **Production Build**: Full native app (APK/IPA)

For packages that don't work in Expo Go, you'll need to create a development build.

