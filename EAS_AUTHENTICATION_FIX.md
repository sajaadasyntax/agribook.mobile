# Fixing EAS Authentication Issues

## Problem
You're getting permission errors because:
1. The project is owned by `sajaadammar` account (in `app.json`)
2. You're logged in as a different user
3. The EAS project is not properly configured

## Solutions

### Solution 1: Login as the Correct User (If you have access to `sajaadammar` account)

1. **Check who you're currently logged in as:**
   ```bash
   npx eas whoami
   ```

2. **Login as the correct user:**
   ```bash
   npx eas login
   ```
   Enter credentials for the `sajaadammar` account.

3. **Verify you're logged in:**
   ```bash
   npx eas whoami
   ```
   Should show: `sajaadammar` or similar

4. **Try building again:**
   ```bash
   npx eas build --platform android --profile preview
   ```

---

### Solution 2: Use Your Current Account (Recommended if you don't have access to `sajaadammar`)

If you don't have access to the `sajaadammar` account, update the project to use your current account:

1. **Check your current login:**
   ```bash
   npx eas whoami
   ```

2. **Remove the owner field** from `app.json` (or update it to your username):
   
   Remove or change line 60:
   ```json
   "owner": "sajaadammar"
   ```
   
   To:
   ```json
   // Remove this line entirely OR change to your username
   ```

3. **Reconfigure EAS project:**
   ```bash
   npx eas init
   ```
   
   This will:
   - Create a new EAS project under your account
   - Configure the project ID in `app.json`

4. **Build:**
   ```bash
   npx eas build --platform android --profile preview
   ```

---

### Solution 3: Remove Owner (Use Personal Account)

1. **Edit `app.json`** and remove the owner field:
   ```json
   {
     "expo": {
       // ... other config ...
       "extra": {
         "eas": {
         }
       }
       // Remove the "owner" field entirely
     }
   }
   ```

2. **Login to your Expo account:**
   ```bash
   npx eas login
   ```

3. **Initialize EAS project:**
   ```bash
   npx eas init
   ```

4. **Build:**
   ```bash
   npx eas build --platform android --profile preview
   ```

---

## Quick Fix Commands

### Option A: Login to correct account
```bash
npx eas logout
npx eas login
# Enter sajaadammar credentials
npx eas build --platform android --profile preview
```

### Option B: Use your current account
```bash
# Remove owner from app.json (edit manually)
# Then:
npx eas init
npx eas build --platform android --profile preview
```

---

## After Fixing

Once you've resolved the authentication, you should be able to build:

```bash
npx eas build --platform android --profile preview
```

The build will:
- Create/configure the EAS project automatically
- Upload your code to Expo's servers
- Build the APK
- Provide a download link when complete

---

## Notes

- If you're working in a team, coordinate with team members about which account to use
- The `owner` field determines who owns the EAS project
- Removing the owner field defaults to your personal Expo account
- Each Expo account has its own projects and billing

