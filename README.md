# Syncquerino: Real-Time Collaborative Organizer

---

## 1. Project Overview
Syncquerino is a real-time collaborative mobile application designed to simplify shared coordination for friends, families, roommates, and partners. The application consolidates shared states (such as shopping lists, chore assignments, and whiteboard bulletins) into interactive collaborative circles, preventing forgotten tasks or duplicate purchases.

The app consists of four core modules:
1. **Interactive Circles**: Multi-user shared spaces with 6-character invitation code generation, native share sheet invites, and member management.
2. **Shared Groceries List**: Shopping list with status checks, category color tints, completed item sectioning, and compressed camera photo attachments.
3. **Reminders & Chores**: Task assignment hub featuring assignee initial badges, color-coded deadline urgency indicators, and Wix `react-native-calendars` integration.
4. **Whiteboard Notes**: Shared announcement bulletin board containing creator name tags and date headers.

---

## 2. Tech Stack & Architecture
* **Framework**: React Native (Expo SDK 57)
* **Language**: TypeScript
* **Design System**: Centralized design tokens (`src/theme/tokens.ts`) with Light & Dark mode persistent theme context (`AsyncStorage`)
* **Icons & Styling**: `@expo/vector-icons` (`Ionicons`), React Native Gesture Handler (`FlatList`, `Swipeable`), and Reanimated spring transitions
* **Navigation**: React Navigation v7 (Bottom Tabs + Native Stacks)
* **Backend & Sync**: Google Firebase Auth & Cloud Firestore (real-time `onSnapshot` listeners, offline write queue `useReducer`)
* **Hardware Integrations**: `expo-image-picker` image selection, and native Tactile Haptics feedback (`expo-haptics`)
* **Form Controls**: React Hook Form & Zod schema validation (with input length boundaries)
* **Testing Engine**: Jest unit testing of utility functions

---

## 3. Setup & Run Instructions

### Prerequisites
Ensure you have Node.js (v18+) and the Expo Go app installed on your physical device.

### 1. Clone the Repository
```bash
git clone https://github.com/andylpzm/Syncquerino.git
cd Syncquerino
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and add your Firebase credentials:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Start the Application
```bash
npm start
```
Scan the QR code printed in the terminal with your physical phone camera (iOS) or the Expo Go app (Android) to launch.

### 5. Typecheck & Run Unit Tests
```bash
# Verify TypeScript Compilation
npx tsc --noEmit

# Run Jest Unit Tests
npm test
```
