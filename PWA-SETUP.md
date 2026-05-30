# PWA Setup Guide - Kulu Manager

Your Kulu Manager app has been configured as a Progressive Web App (PWA). This guide explains the setup and how to customize it.

## What's Configured

### ✅ Features Enabled
- **Offline Support**: The app works offline with cached data
- **Install Prompts**: Users can install the app on their home screen
- **Push Notifications Ready**: Framework is set up for future notifications
- **Responsive Icons**: Multiple icon sizes for different devices
- **Manifest File**: Web app manifest for app metadata

### 📁 Key Files

1. **vite.config.ts** - PWA plugin configuration with Workbox setup
2. **public/manifest.json** - Web app manifest with app metadata
3. **public/sw.js** - Service worker for offline support and caching
4. **public/icon-*.png** - App icons (96, 192, 512px)
5. **public/icon-maskable-*.png** - Adaptive icons for some Android devices
6. **generate-icons.mjs** - Script to generate icons from SVG

## 📱 Installation

Users can install the app in several ways:

### iOS (Safari)
1. Open the app in Safari
2. Tap Share → Add to Home Screen
3. Enter a name and tap Add

### Android (Chrome)
1. Open the app in Chrome
2. Tap Menu (⋮) → Install app or Add to Home Screen
3. Confirm installation

### Desktop (Chrome/Edge)
1. Open the app in Chrome or Edge
2. Click Install button in address bar
3. Confirm installation

## 🎨 Customizing Icons

The icons are generated from an SVG template. To customize:

### Edit the Icon
1. Open `generate-icons.mjs`
2. Modify the `svgIcon` template to your design
3. Run: `npm run generate-icons`
4. The PNG icons will be regenerated in `/public`

### Using Custom PNG Icons
If you prefer to use custom PNG icons:
1. Create icons at these sizes: 96x96, 192x192, 512x512
2. Name them: `icon-96.png`, `icon-192.png`, `icon-512.png`
3. For adaptive icons on Android:
   - `icon-maskable-96.png`, `icon-maskable-192.png`, `icon-maskable-512.png`
4. Place them in `/public`
5. Update `vite.config.ts` if you change the icon paths

## 🔄 Offline Behavior

The service worker implements a cache-first strategy:
- Static assets are cached on first visit
- API calls always try to fetch fresh data first
- If offline, cached data is returned
- Static assets fall back to cached version if network fails

## 📝 Manifest Customization

Edit `public/manifest.json` to customize:
- App name and short name
- Description and colors
- Start URL
- Display mode (standalone, fullscreen, etc.)
- App shortcuts

## 🚀 Building for Production

Before deploying:

```bash
# Generate optimized icons
npm run generate-icons

# Build the production app
npm run build
```

The build process will:
1. Generate all icon sizes
2. Bundle the app with Vite
3. Generate optimized service worker code
4. Create the production manifest

## 📊 PWA Lighthouse Score

To check your PWA quality:

1. Build the app: `npm run build`
2. Run preview: `npm run preview`
3. Open in Chrome DevTools
4. Run Lighthouse audit
5. Check PWA category

Target scores:
- ✅ Installable
- ✅ Offline support
- ✅ HTTPS in production (important!)

## 🔐 Important for Production

1. **HTTPS Required**: PWA only works over HTTPS
2. **Valid Manifest**: Ensure manifest.json is valid
3. **Icons**: Provide high-quality icons
4. **Service Worker**: Keep sw.js optimized

## 🛠 Troubleshooting

### App won't install
- Check browser console for errors
- Verify manifest.json is valid
- Ensure HTTPS is enabled
- Check icon paths exist

### Offline not working
- Check if service worker registered (DevTools → Application → Service Workers)
- Verify sw.js is in `/public`
- Check network requests in offline mode

### Icons not showing
- Regenerate icons: `npm run generate-icons`
- Verify PNG files exist in `/public`
- Check manifest.json icon paths

## 📚 Resources

- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

Your PWA is ready to use! Test it on different devices and platforms.
