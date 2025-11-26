# Physical Device Setup Guide

This guide explains how to configure and run the AgriBooks app on a physical device.

## Prerequisites

1. **Same WiFi Network**: Your computer and phone must be on the same WiFi network
2. **Backend Running**: The backend server must be running on your computer
3. **Firewall**: Ensure Windows Firewall allows connections on port 3001

## Configuration

### 1. API Configuration

The app is already configured to use IP `192.168.0.105:3001` for physical device testing.

**File**: `mobile/src/config/api.ts`

```typescript
const PHYSICAL_DEVICE_IP = '192.168.0.105';
const API_PORT = 3001;
```

### 2. Backend Server Setup

1. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Verify the server is running**:
   - You should see: `Server started` with port 3001
   - Test in browser: `http://192.168.0.105:3001/api/health`

3. **Check Windows Firewall**:
   - Open Windows Defender Firewall
   - Allow Node.js through firewall if prompted
   - Or manually allow port 3001 for inbound connections

### 3. Running on Physical Device

#### Option A: Using Expo Go (Recommended for Development)

1. **Start Expo**:
   ```bash
   cd mobile
   npm start
   ```

2. **Connect your device**:
   - **Android**: Open Expo Go app and scan the QR code
   - **iOS**: Open Camera app and scan the QR code (opens in Expo Go)

3. **Verify Connection**:
   - Check the console for: `🌐 API Base URL: http://192.168.0.105:3001/api`
   - The app should connect to your backend automatically

#### Option B: Using Development Build

If you need custom native code:

```bash
# Build development client
eas build --profile development --platform android

# Or for iOS
eas build --profile development --platform ios
```

### 4. Troubleshooting

#### Can't Connect to Backend

1. **Check IP Address**:
   ```bash
   # Windows
   ipconfig | findstr IPv4
   
   # Verify it matches 192.168.0.105
   ```

2. **Test Backend Accessibility**:
   - From your phone's browser, visit: `http://192.168.0.105:3001/api/health`
   - Should return: `{"status":"ok","message":"AgriBooks API is running",...}`

3. **Check Firewall**:
   - Windows Firewall might be blocking connections
   - Temporarily disable firewall to test, then re-enable with proper rules

4. **Verify Network**:
   - Ensure both devices are on the same WiFi network
   - Try pinging your computer from phone (if possible)

#### Network Error Messages

If you see "Network error" in the app:

1. **Check Backend Logs**: Look for incoming requests
2. **Check API URL**: Console should show `🌐 API Base URL: http://192.168.0.105:3001/api`
3. **Test Backend**: Use phone browser to access `http://192.168.0.105:3001/api/health`

### 5. Changing IP Address

If your computer's IP changes:

1. **Find new IP**:
   ```bash
   ipconfig | findstr IPv4
   ```

2. **Update API config** (`mobile/src/config/api.ts`):
   ```typescript
   const PHYSICAL_DEVICE_IP = 'YOUR_NEW_IP';
   ```

3. **Restart Expo**: The app will reload automatically

### 6. Production Build

For production builds, update the production URL in `mobile/src/config/api.ts`:

```typescript
if (!__DEV__) {
  return 'https://your-production-api.com/api';
}
```

## Quick Start Checklist

- [ ] Backend running on port 3001
- [ ] Computer IP is 192.168.0.105 (or updated in config)
- [ ] Phone and computer on same WiFi network
- [ ] Windows Firewall allows port 3001
- [ ] Backend accessible from phone browser
- [ ] Expo app started (`npm start`)
- [ ] App connected via Expo Go or development build

## Testing Connection

1. **Backend Health Check** (from phone browser):
   ```
   http://192.168.0.105:3001/api/health
   ```

2. **App Console** (check Expo logs):
   ```
   🌐 API Base URL: http://192.168.0.105:3001/api
   ```

3. **Test API Call**: Try creating a transaction in the app

## Notes

- The IP address `192.168.0.105` is configured in `mobile/src/config/api.ts`
- For emulator/simulator testing, the code automatically uses appropriate URLs
- Physical device always uses the configured IP address
- Make sure CORS is enabled on backend (already configured)

