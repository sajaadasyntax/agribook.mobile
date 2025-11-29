# Dependency Fixes Applied

This document summarizes the fixes applied to resolve `expo-doctor` issues.

## Fixed Issues

### 1. ✅ Removed Invalid Expo Config Field
- **Issue**: `usesCleartextTraffic` in `app.json` android config is not a valid Expo config field
- **Fix**: Removed `usesCleartextTraffic: true` from `app.json`
- **Note**: If you need HTTP (cleartext) traffic for development, configure it via:
  - Network Security Config (Android native config)
  - Or use HTTPS for all connections (recommended)

### 2. ✅ Removed Unnecessary Package
- **Issue**: `@types/react-native` should not be installed directly (types are included with react-native)
- **Fix**: Removed from `devDependencies`

### 3. ✅ Added Missing Peer Dependency
- **Issue**: `expo-font` is required by `@expo/vector-icons`
- **Fix**: Added `expo-font: ~13.0.1` to dependencies

### 4. ✅ Fixed Version Mismatches
- **Issue**: Packages didn't match Expo SDK 54 requirements
- **Fixes**:
  - Updated `babel-preset-expo` from `^11.0.15` to `~54.0.0`
  - Updated `@react-native-async-storage/async-storage` from `^2.1.2` to `2.2.0`

### 5. ✅ Configured Package Overrides
- **Issue**: Duplicate React versions (19.1.0 and 16.13.1 from react-native-charts-wrapper)
- **Fix**: Added npm `overrides` to force react-native-charts-wrapper to use React 19.1.0

### 6. ✅ Configured Expo Doctor Exclusions
- **Issue**: `react-native-charts-wrapper` is not tested on New Architecture
- **Fix**: Added exclusion in `package.json` under `expo.doctor.reactNativeDirectoryCheck.exclude`

## Next Steps

1. **Install updated dependencies**:
   ```bash
   cd mobile
   npm install
   ```

2. **Verify fixes**:
   ```bash
   npx expo-doctor
   ```

3. **If you need HTTP (cleartext) traffic** for development:
   - For Expo managed workflow: Create `app.config.js` (see Expo docs)
   - For bare workflow: Configure `network_security_config.xml` in Android native folder
   - **Recommended**: Use HTTPS endpoints even in development

## Notes

- The `react-native-charts-wrapper` package is still in use but marked as excluded from New Architecture checks
- Consider migrating to `react-native-gifted-charts` (already installed) which supports New Architecture
- All dependency versions now match Expo SDK 54 requirements

