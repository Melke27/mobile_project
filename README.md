# Findit (Mobile + API)

React Native mobile app with Node.js/Express API and MongoDB.

This project helps students and staff report lost/found items, search reports, and recover items faster.

## Tech Stack

- Mobile: React Native (`0.74.5`)
- Backend: Node.js + Express
- Database: MongoDB
- Auth: JWT

## Core Features

### 👤 Authentication
- Register with name, email, password
- Login with email, password
- Role-based routing (user vs admin)

### 🏠 Home Screen
- List of lost/found posts
- Urgency badges (ID / Exam Permit highlighted)
- Status indicator (Lost / Found / Returned)
- Home search bar + quick filtering

### ➕ Post Item
- Choose Lost or Found
- Add title, description, category
- Upload photo
- Add location text (supports Google Maps pin text/link)
- Add secret questions (for found items)
- Edit post
- Delete post

### 🔍 Search & Filter
- Search by keywords
- Filter by category
- Filter by location
- Filter by status

### ✅ Claim System
- "This is Mine!" button
- Answer secret questions
- Finder/admin confirms or declines claim
- If confirmed: owner contact can be revealed
- Status changes to Returned

### 💬 Messaging
- In-app chat between users
- Anonymous chat (no phone numbers in chat)
- Unread message badge

### 🔔 Notifications
- Match found alerts
- Claim request received alerts
- Claim approved/declined alerts

### 📊 Status Tracking
- Lost → Reported → Match Found → Claimed → Returned

### ⏰ Auto Expire
- Posts auto-archive after 30 days

### 🛡 Admin Panel
- View all posts
- Delete inappropriate/fake posts
- View all users
- Ban/suspend users
- Resolve disputed claims
- Analytics (total posts, recovered items, most lost category)
- Approve/reject pending posts

## Architecture Overview

- Mobile UI layer: React Native screens and reusable components
- State layer: `AuthContext`, `ItemsContext`, and `ThemeContext`
- Service layer: API/device helpers in `src/services`
- Backend API: Express controllers and routes
- Data layer: MongoDB models

Flow: `Screen Action -> Context/Service -> API Client -> Express Controller -> MongoDB -> Response -> UI Update`

## Mobile Computing Project Notes

- This project is designed for mobile-first constraints: unstable networks, runtime permissions, and device-resource limits.
- The app uses local persistence for draft/saved continuity and API synchronization for real-time updates.
- UX flow prioritizes short actions, clear feedback, and safe recovery handoff behavior.

## Prerequisites

- Node.js 18+
- npm
- Android Studio + SDK
- ADB (for physical phone install)
- MongoDB Atlas (or local MongoDB)

## Quick Start

### 1) Install dependencies

```bash
npm install --legacy-peer-deps
npm --prefix server install
```

### 2) Configure backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

- `MONGODB_URI`
- `JWT_SECRET`

Start backend:

```bash
npm run server:dev
```

Health check:

- `http://localhost:5000/api/health`
- Confirm `authConfigured: true`

### 3) Configure mobile API base URL

Edit `src/config/env.js`.

Default repo config already uses hosted mode:

- `DEV_BACKEND_MODE = 'auto'`
- `HOSTED_API_BASE_URL = 'https://mobile-project-xvez.onrender.com/api'`

## Run the Mobile App

### Recommended: standalone release mode (no Metro required)

```bash
npm run phone:auto
# or
npm run remote:install
```

This builds and installs a standalone release app that uses the hosted backend (no local Metro required).
After install, the app continues to work even when USB is disconnected (internet required).

### Debug mode (Metro + hot reload)

```bash
npm start
# in another terminal
npm run android:dev
```

### Physical phone debug via USB

```bash
# terminal 1
npm start
# terminal 2
npm run android:usb
```

If multiple devices are connected:

```bash
ANDROID_SERIAL=<device-id> npm run android:usb:device
```

## Build and Install APK

```bash
npm run apk:debug
npm run apk:release
npm run install:phone
npm run install:phone:release
npm run remote:install
```

APK output paths:

- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`

## Useful Scripts

- `npm run start` - Start Metro
- `npm run start:reset` - Start Metro with cache reset
- `npm run android` - Run Android debug build
- `npm run android:dev` - Alias for debug build
- `npm run android:release` - Run Android release build
- `npm run server:dev` - Start backend in dev mode
- `npm run server:start` - Start backend in normal mode
- `npm run dev:all` - Start backend + Metro together
- `npm run apk:release` - Build release APK
- `npm run install:phone` - Install debug APK to connected device (USB reverse for local API)
- `npm run install:phone:release` - Install release APK to connected device
- `npm run phone:auto` - Build + install release APK and launch app automatically (live backend)
- `npm run remote:install` - Build + install release APK for remote backend usage

## Troubleshooting

### "Unable to load script" (red screen)

You are running a debug build without Metro.

Fix:

```bash
npm start
adb reverse tcp:8081 tcp:8081
```

Or install standalone release build:

```bash
npm run phone:auto
# or
npm run remote:install
```

Debug build note: if USB is disconnected, debug build can stop working because Metro/reverse tunnel is gone.

### `adb: more than one device/emulator`

```bash
ANDROID_SERIAL=<device-id> npm run android:usb:device
```

### App cannot reach backend

- Check `server/.env` values
- Check backend health endpoint
- Check `src/config/env.js` mode and URL

### First account admin role

For demo/setup convenience, the first registered account becomes `admin`.

## Project Structure

```text
.
├── App.js
├── src/
│   ├── components/
│   ├── config/
│   ├── context/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   └── utils/
├── server/
│   ├── src/
│   └── .env.example
└── docs/
```

## Documentation Index

- [Product Documentation](docs/PRODUCT_DOCUMENTATION.md)
- [Screen Gallery](docs/SCREEN_GALLERY.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [API Specification](docs/API_SPEC.md)
- [MongoDB Schema](docs/MONGODB_SCHEMA.md)
- [Feature Matrix](docs/FEATURE_MATRIX.md)
- [Test Plan](docs/TEST_PLAN.md)
- [UML Text](docs/UML_TEXT.md)
- [Submission Checklist](docs/SUBMISSION_CHECKLIST.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [API Specification](docs/API_SPEC.md)
- [MongoDB Schema](docs/MONGODB_SCHEMA.md)
- [Feature Matrix](docs/FEATURE_MATRIX.md)
- [Test Plan](docs/TEST_PLAN.md)
- [UML Text](docs/UML_TEXT.md)
- [Submission Checklist](docs/SUBMISSION_CHECKLIST.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [API Specification](docs/API_SPEC.md)
- [MongoDB Schema](docs/MONGODB_SCHEMA.md)
- [Feature Matrix](docs/FEATURE_MATRIX.md)
- [Test Plan](docs/TEST_PLAN.md)
- [UML Text](docs/UML_TEXT.md)
- [Submission Checklist](docs/SUBMISSION_CHECKLIST.md)

## Screenshot Assets Path

All documentation screenshots are stored in:

- `docs/doc_image/`

## Main Screenshot Preview

### Home

The Home screen is the discovery hub. Users see recent lost/found reports, quick actions, and visual highlights for faster browsing.

Display Note: This primary home display highlights mobile-first feed scanning for quick item-type and urgency recognition. User Action: open a card directly from feed; Outcome: faster transition from discovery to contact/recovery steps.

Display Note: This alternate home variation supports continuous image-led browsing and rapid cross-card comparison. User Action: swipe/scroll through similar items; Outcome: improved visual matching when details are subtle.

### Login

The Login screen provides secure access to reporting and recovery actions for authenticated users.

Display Note: This login display is the secure gateway to protected workflows (report and verify). User Action: sign in once; Outcome: access to identity-linked features and safer moderated interactions.

### Reports

The Report flow helps users submit complete and trusted reports using structured fields, location details, and image attachment.

Display Note: This reporting display uses progressive structure with validation to improve data quality. User Action: complete guided fields in sequence; Outcome: higher-quality reports and stronger downstream matching.

Display Note: This lost-item form emphasizes safety metadata (proof hint, urgency, meetup guidance). User Action: provide ownership/recovery context up front; Outcome: safer handoff planning and reduced false claims.

Display Note: This unified template supports both lost and found flows with status-aware field behavior. User Action: switch status inside one form; Outcome: consistent UX with scenario-specific guidance preserved.

### Search

The Search and found-items view supports quick filtering and matching to reduce recovery time.

Display Note: This search display uses filtering + keywords for fast narrowing in high-volume lists. User Action: apply campus/category/keyword filters; Outcome: quicker identification of likely matches.

### Account

The Account area manages user profile, preferences, and personal activity context, including dark-mode experience.

Display Note: This account display centralizes profile, preferences, and session settings. User Action: manage identity and app behavior in one place; Outcome: lower friction for returning users.

Display Note: This dark-mode account display improves low-light comfort with balanced contrast hierarchy. User Action: switch/use theme in dim conditions; Outcome: better readability and reduced eye strain.

### Alerts

The Alerts screen surfaces important updates such as match events and moderation/recovery-related notifications.

Display Note: This alerts display prioritizes match/moderation/recovery signals in timeline order. User Action: open latest actionable event first; Outcome: faster response to time-sensitive recovery opportunities.

## Detailed Per-Image Notes

For full notes on how each screenshot works, architecture flow, and UI/UX intent, see:

- [Product Documentation](docs/PRODUCT_DOCUMENTATION.md) (`Per-Image Notes` section)
- [Screen Gallery](docs/SCREEN_GALLERY.md)
