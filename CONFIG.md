# AgriBooks Mobile - Configuration Guide

## Environment Variables

The mobile app uses environment variables for API configuration. This allows different developers to use their own IP addresses and enables proper production configuration.

### Setup

1. **Create `.env` file** in the `mobile/` directory:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** with your configuration:
   ```env
   # Your computer's IP address for physical device testing
   EXPO_PUBLIC_API_HOST=192.168.0.129
   
   # Backend server port
   EXPO_PUBLIC_API_PORT=3001
   
   # Production API URL (full URL including protocol)
   # Example: https://api.agribooks.com
   EXPO_PUBLIC_API_URL=
   
   # Set to 'true' if running in Android emulator
   EXPO_PUBLIC_ANDROID_EMULATOR=false
   ```

### Finding Your IP Address

#### Windows
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

#### macOS/Linux
```bash
ifconfig | grep "inet "
# Or
ip addr show
```

### Configuration Scenarios

#### Development - Physical Device
```env
EXPO_PUBLIC_API_HOST=192.168.0.129
EXPO_PUBLIC_API_PORT=3001
EXPO_PUBLIC_ANDROID_EMULATOR=false
```

#### Development - Android Emulator
```env
EXPO_PUBLIC_API_HOST=localhost
EXPO_PUBLIC_API_PORT=3001
EXPO_PUBLIC_ANDROID_EMULATOR=true
```

#### Development - iOS Simulator
```env
EXPO_PUBLIC_API_HOST=localhost
EXPO_PUBLIC_API_PORT=3001
EXPO_PUBLIC_ANDROID_EMULATOR=false
```

#### Production
```env
EXPO_PUBLIC_API_URL=https://api.agribooks.com
# Other variables are ignored in production if EXPO_PUBLIC_API_URL is set
```

### How It Works

The app automatically selects the correct API URL based on:

1. **Production Mode** (`!__DEV__`):
   - Uses `EXPO_PUBLIC_API_URL` if set
   - Falls back to development host if not set (with warning)

2. **Development Mode** (`__DEV__`):
   - **Android Emulator**: Uses `10.0.2.2` (special IP for host machine)
   - **iOS Simulator/Physical Device**: Uses `EXPO_PUBLIC_API_HOST`

### Important Notes

- Environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in Expo apps
- Changes to `.env` require restarting the Expo development server
- The `.env` file is gitignored and should not be committed
- Each developer should create their own `.env` file with their IP address

### Troubleshooting

#### Can't Connect to Backend

1. **Check IP Address**: Ensure `EXPO_PUBLIC_API_HOST` matches your computer's IP
2. **Check Backend**: Verify backend is running on the specified port
3. **Check Network**: Ensure device and computer are on the same WiFi network
4. **Check Firewall**: Ensure firewall allows connections on the API port

#### Production Build Not Using Correct URL

1. Ensure `EXPO_PUBLIC_API_URL` is set in your `.env` file
2. Rebuild the app: `eas build --platform android` or `eas build --platform ios`
3. Environment variables are baked into the build at build time

### Migration from Hardcoded IP

If you're upgrading from the old hardcoded IP configuration:

1. Create `.env` file with your IP:
   ```env
   EXPO_PUBLIC_API_HOST=192.168.0.129
   EXPO_PUBLIC_API_PORT=3001
   ```

2. Restart Expo development server:
   ```bash
   npm start
   ```

3. The app will now use the environment variable instead of the hardcoded value.

