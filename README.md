# AgriBooks Mobile App

A comprehensive mobile application for managing agricultural business finances, built with React Native and Expo.

## Features

- **Profile Management**: Business information, owner details, and location settings
- **Financial Tracking**: Income and expense management with categorization
- **Reports & Analytics**: Daily, weekly, and monthly reports with charts
- **Alerts & Reminders**: Payment reminders and expense threshold alerts
- **Offline Support**: Work offline with automatic sync when online
- **Security**: PIN and biometric authentication support
- **Multi-language**: Support for English and Arabic

## Screens

1. **Home Screen**: Main dashboard with profile, financial summary, and quick actions
2. **Add Screen**: Add income or expense transactions
3. **Reports Screen**: View detailed analytics and export reports
4. **Alerts Screen**: Manage reminders and notifications
5. **Settings Screen**: Configure app settings, security, and preferences

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (optional but recommended):
```bash
# Copy the example file
cp .env.example .env

# Edit .env and set your configuration:
# - EXPO_PUBLIC_API_HOST: Your computer's IP for physical device testing
# - EXPO_PUBLIC_API_PORT: Backend server port (default: 3001)
# - EXPO_PUBLIC_API_URL: Production API URL (for production builds)
```

3. Start the development server:
```bash
npm start
```

4. Run on iOS:
```bash
npm run ios
```

5. Run on Android:
```bash
npm run android
```

## Configuration

### Environment Variables

The app uses Expo environment variables (prefixed with `EXPO_PUBLIC_`) for configuration:

- **EXPO_PUBLIC_API_HOST**: Your computer's IP address for physical device testing (default: `localhost`)
- **EXPO_PUBLIC_API_PORT**: Backend server port (default: `3001`)
- **EXPO_PUBLIC_API_URL**: Full production API URL (e.g., `https://api.agribooks.com`)
- **EXPO_PUBLIC_ANDROID_EMULATOR**: Set to `true` if running in Android emulator

Create a `.env` file in the `mobile/` directory with your configuration. See `.env.example` for a template.

**Note**: For Expo apps, environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app.

## Project Structure

```
mobile/
├── screens/
│   ├── HomeScreen.js      # Main dashboard
│   ├── AddScreen.js        # Add transactions
│   ├── ReportsScreen.js    # Reports and analytics
│   ├── AlertsScreen.js     # Alerts and reminders
│   └── SettingsScreen.js   # App settings
├── App.js                  # Main app with navigation
├── package.json            # Dependencies
└── app.json                # Expo configuration
```

## Dependencies

- React Native
- Expo
- React Navigation (Bottom Tabs)
- React Native Chart Kit
- React Native Vector Icons
- Expo Image Picker
- Expo Local Authentication

## Development

This app uses Expo for development. Make sure you have Expo CLI installed globally:

```bash
npm install -g expo-cli
```

## License

MIT

