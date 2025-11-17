# Building APK with Expo

## Prerequisites
- EAS CLI installed (✓ Done)
- Logged in to Expo account (✓ Done - logged in as: sajaadammar123)
- EAS Build configured (✓ Done - eas.json created)

## Steps to Build APK

1. **Run the build command:**
   ```bash
   eas build --platform android --profile preview
   ```

2. **When prompted to create an EAS project, type `Y` and press Enter**

3. **The build will start on Expo's servers** - this may take 10-20 minutes

4. **Once complete, you'll get a download link** for your APK file

## Alternative: Build Locally (Faster, but requires Android SDK)

If you have Android Studio installed, you can build locally:

```bash
eas build --platform android --profile preview --local
```

## Build Profiles

- **preview**: Builds an APK for testing (configured in eas.json)
- **production**: Builds an APK for production release
- **development**: Builds a development client

## Notes

- The first build may take longer as EAS sets up the project
- You'll receive email notifications about build status
- APK files are typically 20-50MB in size
- The APK can be installed directly on Android devices

