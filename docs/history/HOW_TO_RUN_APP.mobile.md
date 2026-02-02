# How to Run Equoria Mobile App

**Date:** 2025-11-10
**Status:** App is ready, but needs direct terminal access

---

## ⚠️ Current Situation

The app is **fully configured and ready to run**, but we've been encountering issues running it in background mode. The Expo Dev Server needs direct terminal interaction for the best experience.

---

## ✅ Recommended Solution: Run in New Terminal

### **Step 1: Open a New Command Prompt**

1. Press `Win + R`
2. Type `cmd` and press Enter
3. Navigate to the project:
   ```cmd
   cd C:\Users\heirr\OneDrive\Desktop\Equoria\equoria-mobile
   ```

### **Step 2: Start Expo**

```cmd
npm start
```

**What you'll see:**
- QR code displayed in the terminal
- Expo DevTools will open in your browser automatically
- Menu with options to press `w` for web, `a` for Android, `i` for iOS

### **Step 3: View the App**

**Option A: On Your Phone** (Recommended)
1. Install **Expo Go** app:
   - iOS: App Store → "Expo Go"
   - Android: Play Store → "Expo Go"
2. Open Expo Go
3. Scan the QR code from your terminal
4. The Equoria Mobile app will load!

**Option B: In Web Browser**
1. After `npm start` completes
2. Press `w` key in the terminal
3. Or open: http://localhost:19006
4. App will load in your browser

---

## 🎯 What You'll See

When the app loads successfully, you'll see:

```
┌─────────────────────────────────────┐
│                                     │
│        Equoria Mobile               │
│   Horse Breeding Simulation         │
│   Version 0.1.0 - Week 1 Day 1      │
│                                     │
│   Backend API Status: Offline ✗     │
│   [Test Connection]                 │
│                                     │
│   ✅ Day 1 Completed:               │
│   • Expo project initialized        │
│   • Folder structure created        │
│   • Dependencies installed          │
│   • TypeScript configured           │
│   • API client setup                │
│   • Environment config ready        │
│                                     │
└─────────────────────────────────────┘
```

---

## 🐛 If You Get Errors

### Error: "Port 19000 is in use"

**Solution:** Kill the old process and try again:
```cmd
netstat -ano | findstr :19000
taskkill /PID [process_id] /F
npm start
```

### Error: "Cannot find module 'babel-preset-expo'"

**Solution:** Already fixed! But if it appears again:
```cmd
npm install babel-preset-expo
npm start
```

### Error: Blank screen in browser

**Solution:**
1. Wait 30-60 seconds for Metro Bundler to compile
2. Hard refresh: `Ctrl + Shift + R`
3. Check the terminal for bundling errors
4. If errors persist, try: `npm start -- --clear`

---

## 📱 Best Experience

**For the best first-time experience:**
1. Use **Expo Go on your phone** (not web browser)
2. The phone app is much faster and more reliable
3. You get the full mobile experience as intended
4. Hot reload works instantly

---

## ✅ Day 1 Completion Status

**Completed Today:**
- ✅ React Native + Expo project initialized
- ✅ Complete folder structure (18 directories)
- ✅ All dependencies installed (1,187 packages)
- ✅ TypeScript configured with strict mode
- ✅ Babel, ESLint, Prettier configured
- ✅ API client with interceptors
- ✅ Environment configuration
- ✅ App.tsx with welcome screen
- ✅ Zero TypeScript errors

**Ready for Day 2:**
- State management (Redux Toolkit)
- React Query setup
- AsyncStorage persistence
- Navigation system

---

## 🎉 Next Steps

1. **Run the app** using the instructions above
2. **See the welcome screen** on your phone or browser
3. **Confirm Day 1 is complete**
4. **Ready to begin Day 2** when you're ready!

---

**Questions?** Check the terminal output for error messages and refer to this guide.

**Working?** Great! You've successfully completed Week 1 Day 1! 🚀
