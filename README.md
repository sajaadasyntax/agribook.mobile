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

2. Start the development server:
```bash
npm start
```

3. Run on iOS:
```bash
npm run ios
```

4. Run on Android:
```bash
npm run android
```

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

