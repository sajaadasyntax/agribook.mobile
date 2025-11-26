# Mobile App Integration Guide

This guide explains how the mobile app is integrated with the backend API.

## Overview

The mobile app has been fully converted to TypeScript and integrated with the backend API. All hardcoded values have been replaced with real API calls.

## Architecture

### TypeScript Setup
- All screens converted to `.tsx` files
- Type definitions in `src/types/index.ts`
- Full type safety throughout the app

### API Integration
- **API Client**: `src/config/api.ts` - Axios-based HTTP client
- **API Services**: `src/services/api.service.ts` - Organized API methods
- **User Context**: `src/context/UserContext.tsx` - Global user state management

### Data Flow
1. **User Context** manages authentication and user state
2. **API Services** handle all backend communication
3. **Screens** fetch and display real data from the backend

## Key Features

### 1. Authentication
- Automatic user creation on first launch
- User ID stored securely using `expo-secure-store`
- User ID sent in `x-user-id` header for all API requests

### 2. Home Screen
- **Financial Summary**: Real data from `/api/reports/summary`
- **Monthly Trend Chart**: Data from `/api/reports/monthly`
- **Categories**: Fetched from `/api/categories`
- **Transaction Forms**: Create income/expense transactions via API

### 3. Add Screen
- **Categories**: Dynamically loaded from API based on type (INCOME/EXPENSE)
- **Transaction Creation**: Saves to backend via `/api/transactions`

### 4. Reports Screen
- **Daily Report**: `/api/reports/daily`
- **Weekly Report**: `/api/reports/weekly`
- **Monthly Report**: `/api/reports/monthly`
- **Statistics**: `/api/reports/statistics`
- All charts use real data from the backend

### 5. Alerts Screen
- **Alerts**: Fetched from `/api/alerts`
- **Reminders**: Fetched from `/api/reminders`
- **Settings**: Integrated with user settings API
- Mark as read, toggle reminders functionality

### 6. Settings Screen
- **User Settings**: Loaded from `/api/settings`
- **PIN Management**: Save PIN via settings API
- **Language**: Update language preference
- **App Settings**: All toggles connected to backend

## API Configuration

### Development Setup

1. **Update API URL** in `src/config/api.ts`:
   ```typescript
   const API_BASE_URL = __DEV__
     ? 'http://YOUR_LOCAL_IP:3001/api' // Replace with your computer's IP
     : 'https://your-production-api.com/api';
   ```

2. **For Physical Device Testing**:
   - Find your computer's IP address (e.g., `192.168.1.100`)
   - Replace `localhost` with your IP in `src/config/api.ts`
   - Ensure backend is running and accessible

3. **For Emulator/Simulator**:
   - Use `http://localhost:3001/api` (Android emulator)
   - Use `http://localhost:3001/api` (iOS simulator)
   - Or use `http://10.0.2.2:3001/api` for Android emulator

## Running the App

1. **Install Dependencies**:
   ```bash
   cd mobile
   npm install
   ```

2. **Start Backend** (in separate terminal):
   ```bash
   cd backend
   npm run dev
   ```

3. **Start Mobile App**:
   ```bash
   cd mobile
   npm start
   ```

4. **Type Check** (optional):
   ```bash
   npm run type-check
   ```

## Data Flow Example

### Creating a Transaction

1. User fills form in `AddScreen.tsx`
2. Calls `transactionApi.create(data)`
3. API client adds `x-user-id` header
4. Request sent to `POST /api/transactions`
5. Backend validates and saves to database
6. Response returned to app
7. Success message shown to user
8. Data refreshed automatically

### Loading Financial Summary

1. `HomeScreen.tsx` mounts
2. Calls `reportApi.getSummary()`
3. API client adds authentication header
4. Request sent to `GET /api/reports/summary`
5. Backend calculates totals from database
6. Response with real data returned
7. UI updates with actual values

## Error Handling

- Network errors show user-friendly messages
- API errors are caught and displayed via Alert
- Loading states prevent duplicate requests
- Refresh control allows manual data refresh

## State Management

- **User Context**: Global user and settings state
- **Local State**: Screen-specific data (forms, loading states)
- **API Cache**: No caching yet - all data fetched fresh

## Next Steps

1. **Add Offline Support**: Cache data locally for offline access
2. **Add Image Upload**: Implement receipt image upload
3. **Add Push Notifications**: Integrate with backend alerts
4. **Add Export Functionality**: PDF/Excel export from reports
5. **Add Data Sync**: Sync cached data when online

## Troubleshooting

### Network Errors
- Check backend is running
- Verify API URL is correct
- Check firewall settings
- For physical device, ensure same network

### Authentication Issues
- Clear app data and restart
- Check SecureStore permissions
- Verify user creation endpoint

### Type Errors
- Run `npm run type-check` to see all errors
- Ensure all API responses match type definitions
- Update types in `src/types/index.ts` if needed

