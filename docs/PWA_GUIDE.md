# Madhav Finance Manager

# Progressive Web Application (PWA) Development Guide

**Version:** 1.0  
**Platform:** Progressive Web Application  
**Primary Device:** iPhone  
**Hosting:** GitHub Pages  
**Storage:** LocalStorage  
**Offline Support:** Service Worker  
**Future Platform:** Native iOS

---

# 1. OBJECTIVE

Build an installable, mobile-first, offline-capable Progressive Web Application for personal and family finance management.

The PWA must provide an app-like experience on iPhone without requiring a native application during the initial development phase.

All financial records must remain locally stored on the device.

# 2. REQUIRED PWA FILES

The project must contain:

```text
Madhav Finance-Manager/
│
├── index.html
├── manifest.json
├── service-worker.js
│
├── css/
│   └── style.css
│
├── js/
│   └── application modules
│
└── assets/
    ├── icons/
    │   ├── icon-192.png
    │   ├── icon-512.png
    │   └── apple-touch-icon.png
    │
    └── vendor/
        └── chart.umd.min.js
```

# 3. WEB APP MANIFEST

Create a valid `manifest.json`.

Required properties:

- name
- short_name
- description
- start_url
- scope
- display
- background_color
- theme_color
- icons

Application name:

Madhav Finance Manager

Short name:

Madhav Finance

Display mode:

standalone

Use appropriate application icons.

Ensure manifest paths work correctly when hosted under the GitHub Pages repository subpath.

# 4. SERVICE WORKER

Implement a dedicated service worker.

Responsibilities:

- Cache application shell.
- Cache CSS.
- Cache JavaScript modules.
- Cache application icons.
- Cache the local Chart.js library.
- Support offline navigation.
- Manage cache versions.
- Clean up obsolete application caches.

Requirements:

1. Use a versioned cache name.
2. Pre-cache essential application assets.
3. Provide an offline fallback.
4. Handle failed network requests gracefully.
5. Never delete financial LocalStorage records during cache cleanup.
6. Do not cache sensitive financial exports.
7. Handle service worker installation and activation safely.
8. Do not force an application update while a user is entering a transaction.

# 5. OFFLINE FUNCTIONALITY

Core application functionality must work without internet access after the initial successful installation and asset caching.

Offline features must include:

- Dashboard.
- Transaction creation.
- Transaction editing.
- Transaction deletion.
- Budget management.
- Savings goals.
- Financial calculations.
- Charts.
- Transaction search.
- JSON export and import.
- CSV export.
- Theme preferences.

Do not require an external API for any core financial operation.

# 6. CHART.JS OFFLINE SUPPORT

Prefer a locally stored Chart.js distribution.

File location:

`assets/vendor/chart.umd.min.js`

Do not depend on a remote CDN for runtime chart functionality.

Verify that all charts render correctly while offline.

# 7. LOCAL STORAGE AND DATA PERSISTENCE

Use the dedicated storage abstraction (`storage.js`).

Requirements:

- Store all financial records locally in integer paise validated with `Number.isSafeInteger()`.
- Validate records before persistence.
- Handle unavailable storage and private browsing restrictions.
- Handle storage quota errors (`QuotaExceededError`).
- Abort in-memory mutations on persistence failure.
- Ensure failed persistence writes never appear as a successful transaction to the user.
- Handle malformed stored JSON gracefully without data destruction.
- Report failed writes clearly via user-facing alerts.
- Never silently discard financial data.

Important:

LocalStorage is browser-managed storage, not permanent storage. It is subject to OS eviction policies, including Safari WebKit's 7-day cap on unvisited, uninstalled web data.

Downloadable JSON backups are the **primary disaster recovery mechanism**. Encourage regular backup downloads.

Do not claim that application data is encrypted.

# 8. IPHONE INSTALLATION

The PWA must be accessible through HTTPS.

Provide appropriate web app metadata:

- Web App Manifest.
- Apple mobile web app capable metadata.
- Apple touch icon.
- Theme color.
- Viewport configuration.

The user should be able to install the application through Safari:

1. Open the deployed application in Safari.
2. Tap the Share button.
3. Select Add to Home Screen.
4. Confirm the application name.
5. Add the application.

Verify standalone operation on an actual iPhone.

# 9. IPHONE UI COMPATIBILITY

Support:

- iPhone safe areas.
- Dynamic Island.
- Home indicator.
- Portrait orientation.
- Landscape orientation.
- On-screen keyboard.
- Native date picker interaction.
- Touch-friendly controls.
- Bottom navigation.

Avoid hover-dependent functionality.

Use appropriate viewport settings and safe-area CSS.

# 10. GITHUB PAGES DEPLOYMENT

Host the application using GitHub Pages.

The deployed application must:

- Use HTTPS.
- Load all assets correctly.
- Support repository subpaths.
- Register the service worker correctly.
- Resolve application navigation correctly.
- Load the manifest correctly.

Important:

GitHub Pages project sites commonly use a repository subpath.

Do not assume the application is hosted at the domain root.

Use a consistent deployment base path for asset references, manifest URLs and service worker registration.

Verify all paths in the deployed environment.

# 11. APPLICATION UPDATE MANAGEMENT

Implement safe update handling.

When a new application version is available:

- Detect the new service worker.
- Inform the user that an update is available.
- Avoid interrupting active transaction entry.
- Allow the user to refresh when appropriate.
- Preserve all existing financial records.

Updating application files must never reset LocalStorage.

# 12. PERFORMANCE

Prioritize:

- Fast initial loading.
- Small asset sizes.
- Minimal dependencies.
- Efficient DOM updates.
- Responsive chart rendering.
- Smooth scrolling.
- Fast transaction entry.

Avoid unnecessary animation and large libraries.

# 13. OFFLINE TESTING CHECKLIST

Verify:

- First successful online load.
- Service worker registration.
- Asset caching.
- Offline reopening.
- Offline transaction creation.
- Offline transaction editing.
- Offline transaction deletion.
- Offline dashboard calculations.
- Offline charts.
- Offline JSON export.
- Offline CSV export.
- Persistence after closing and reopening.
- Application update without data loss.

Also test storage failure scenarios.

# 14. PRIVACY REQUIREMENTS

The application must not:

- Upload financial transactions.
- Synchronize financial records.
- Require online authentication.
- Send financial information to analytics services.
- Transmit personal records to third-party APIs.

Core application features must remain independent of network availability.

# 15. LIMITATIONS AND BACKUP GUIDANCE

Explain clearly that:

- LocalStorage is not encrypted.
- Browser storage can be cleared.
- iOS may manage website storage.
- Clearing website data can remove financial records.
- Installing a PWA does not provide the same storage guarantees as a native database.

Provide an easy JSON backup and restoration process.

Recommend keeping backup files in a user-controlled, secure location.

# 16. DEFINITION OF DONE

The PWA is ready for iPhone testing when:

- The manifest is valid.
- The service worker works correctly.
- HTTPS deployment succeeds.
- Application assets load correctly.
- Offline reopening works.
- Core financial features work offline.
- LocalStorage persistence is verified.
- JSON backup and restore work.
- CSV export works.
- iPhone layout is responsive.
- No critical application errors remain.

---

# FINAL PRINCIPLE

The PWA must behave like a dependable, installable personal finance application.

Offline functionality, privacy, data integrity and iPhone usability take priority over unnecessary online services and visual complexity.
