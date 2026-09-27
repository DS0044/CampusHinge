# 📱 CampusHinge Mobile (Flutter)

CampusHinge Mobile is a Flutter client built for closed campus social discovery and matching. It brings the full feature set of CampusHinge into a mobile experience with native gesture swiping, frosted glass aesthetics, multi-intent modes, and real-time Socket.IO chat.

---

## ✨ Features

- **🎓 Verified Campus Community**:
  - Requires institutional college email domains to signup and login.
  - Safe 6-digit OTP verification with countdown timer and cooldown logic.
  - Transparent Terms of Service & Privacy Policy agreement.

- **🎴 Native Gesture Swipe Deck**:
  - Interactive Tinder/Hinge style card deck with drag physics, dynamic card rotation, and tactile feedback.
  - Visual stamps for `LIKE`, `NOPE`, and `SUPER LIKE`.
  - Tap left/right edges of a card to cycle through all student photos with top progress indicators.
  - Instant match celebration popup with dual overlapping avatars and quick-action chat trigger.

- **⚡ Multi-Intent Campus Discovery**:
  - **Dating** (❤️): Romantic connections on campus.
  - **Friendship** (👋): Casual wave, friend group expansion.
  - **Study** (📚): Course mates, project collaboration, study buddies.
  - **Activity** (⚽): Gym, sports, running, badminton, hobbies.
  - **Networking** (🤝): Cross-department career, tech, and hackathon networking.

- **💬 Real-Time Chat & Socket.IO**:
  - Instant bi-directional messaging with optimistic chat bubbles (sending ➔ sent ➔ failed).
  - Live typing indicators ("Alex is typing…").
  - Persistent message cache and unread message counters.
  - Direct profile preview sheet from chat top bar.

- **🔒 Gated Mystery Profiles & Activity Feed**:
  - Students who like your profile have their identity protected behind a frosted mystery card until mutual interest is established.
  - One-tap "Like Back" to immediately unlock their profile and photos.
  - Real-time notification badge counts across tabs.

- **🎨 Modern Luxury Dark Design System**:
  - Deep obsidian dark background (`#090A10`), frosted glass cards (`#161926` with blur), and white hairline borders.
  - Curated gradients (Pink `#FF4081`, Coral `#FF6B6B`, Orange `#FF8E53`, Purple `#7C4DFF`).
  - Google Fonts typography: **Outfit** for headings and **Inter** for body text.

---

## 📁 Architecture & File Layout

```
mobile/lib/
├── config/
│   ├── api_config.dart          # Base URL resolver & CDN photo path handler
│   └── app_theme.dart           # Dark theme, Outfit/Inter typography, gradients, glass cards
├── constants/
│   └── app_constants.dart       # Predefined interests (33 tags), activities (16 tags), branches, years
├── models/
│   ├── intent_model.dart        # Multi-intent configs & color schemes
│   ├── user_model.dart          # User & Profile models with JSON parsers
│   ├── deck_model.dart          # DiscoverProfile, CompatibilityBreakdown, SwipeResult
│   ├── match_model.dart         # MatchItem with partner details
│   ├── message_model.dart       # ChatMessage with optimistic state & timezone formatting
│   └── notification_model.dart  # AppNotification with shared tags & relative time
├── services/
│   ├── api_service.dart         # Complete HTTP REST client (Auth, Profile, Deck, Swipes, Matches, Chat)
│   ├── socket_service.dart      # Real-time Socket.IO client (messages, typing, notifications)
│   └── storage_service.dart     # SharedPreferences token & session persistence
├── providers/
│   ├── auth_provider.dart       # Auth lifecycle, OTP verification, user profile state
│   ├── discover_provider.dart   # Swiping deck queue, buffer preloading, match celebration
│   ├── matches_provider.dart    # Matches list & real-time message previews
│   ├── chat_provider.dart       # Live chat stream, optimistic message delivery, typing events
│   └── notification_provider.dart # Notifications feed, unread counter, like-back actions
├── widgets/
│   ├── glass_card.dart          # Reusable frosted glass container with backdrop filter
│   ├── gradient_button.dart     # Gradient pill button with loading state
│   ├── intent_selector_sheet.dart # Bottom sheet modal for selecting intent
│   ├── swipeable_card_stack.dart # Gesture card stack with stamps, photo tap, and action dock
│   ├── profile_detail_sheet.dart # Detailed modal for student bio, photos, tags, report & block
│   ├── gated_profile_modal.dart # Frosted mystery avatar modal with like-back CTA
│   └── custom_nav_bar.dart      # Floating bottom navigation bar with notification badges
└── screens/
    ├── splash_screen.dart       # Glowing animated splash with auth routing
    ├── auth/
    │   ├── login_screen.dart    # Campus email login
    │   ├── signup_screen.dart   # Student registration
    │   ├── verify_otp_screen.dart # 6-digit OTP verification & cooldown timer
    │   └── terms_screen.dart    # Terms of Service & Privacy Policy
    ├── profile/
    │   ├── profile_setup_screen.dart # Multi-photo upload (min 2, max 6), branch, year, interests
    │   └── my_profile_screen.dart    # Profile preview, edit button, server config, logout
    ├── discover/
    │   └── discover_screen.dart # Discovery deck with intent pill & match dialog
    ├── matches/
    │   └── matches_screen.dart  # Horizontal new matches + active conversations
    ├── chat/
    │   └── chat_screen.dart     # Real-time chat with message bubbles & typing status
    ├── notifications/
    │   └── notifications_screen.dart # Activity feed with gated likes
    └── main_shell.dart          # Persistent IndexedStack holding the 4 bottom tabs
```

---

## 🚀 Running the Mobile Application

### 1. Prerequisites
- **Flutter SDK**: 3.47+ installed (`flutter --version`)
- **Backend API**: The CampusHinge backend should be running on port 3000 (`npm run dev`)

### 2. Run on Target Platform

From the repository root:
```bash
# Run on default connected device / emulator
npm run dev:mobile

# Run in Chrome (Web)
npm run dev:mobile:chrome

# Run on Windows Desktop
npm run dev:mobile:windows
```

Or from inside `mobile/`:
```bash
cd mobile
flutter run
```

### 3. Connecting to the Backend

The app automatically selects the correct local development host:
- **Physical Phone over USB (Recommended)**: Run `adb reverse tcp:3000 tcp:3000`. The phone will directly connect to your computer's local backend via `localhost:3000`!
- **Android Emulator**: Automatically routes to `http://10.0.2.2:3000/api`.
- **Windows / Web / iOS Simulator**: Automatically routes to `http://localhost:3000/api`.
- **Physical Phone over Wi-Fi**: Enter your machine's LAN IP address (e.g. `http://192.168.1.24:3000/api`) under Profile Tab ➔ Settings.

---

## 🧪 Testing

Run the mobile automated test suite:
```bash
npm run test:mobile
```
or inside `mobile/`:
```bash
flutter test
```
All unit tests and widget smoke tests validate model serialization, multi-intent configurations, photo URL resolution, and widget rendering.
