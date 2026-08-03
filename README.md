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
* **Hardware Integrations**: Camera capture with runtime permissions (`expo-image-picker`), tactile haptics (`expo-haptics`), live network status (`@react-native-community/netinfo`), clipboard (`expo-clipboard`), and native share sheet
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

---

## 4. Requirements Checklist

| # | Requirement | How it's done | Where |
|---|---|---|---|
| **1** | Navigation across multiple screens | React Navigation v7. The root navigator swaps between the auth flow and the main app depending on whether someone is signed in, with bottom tabs nested inside a native stack. 11 screens in total. | `navigation/AppNavigator.tsx:27`<br>`navigation/MainNavigator.tsx:16` |
| **2** | State management | Three React Contexts. The offline queue is the interesting one — `useReducer` holds writes made while disconnected and flushes them when the connection comes back. | `context/StateContext.tsx:34`<br>`context/ActiveGroupContext.tsx` |
| **3** | TypeScript used properly | Strict mode, no compiler errors, around 40 interfaces and types. Navigator routes are typed so a wrong screen name won't compile, and form types are inferred from the Zod schemas. | `tsconfig.json:4`<br>`navigation/types.ts:10` |
| **4** | Backend integration | Firebase Auth and Cloud Firestore. Screens subscribe with `onSnapshot`, so a change on one phone shows up on another without refreshing. Access isn't just hidden in the UI — it's enforced by rules running on Firestore. | `screens/main/GroceryListScreen.tsx:107`<br>`firestore.rules` |
| **5** | Local data persistence | AsyncStorage keeps the active circle and theme preference between launches. The circle is re-checked against Firestore on sign-in, so a new account on the same phone doesn't inherit the previous one. | `context/ActiveGroupContext.tsx:22`<br>`theme/ThemeContext.tsx:24` |
| **6** | Device hardware | Five things: the camera (with runtime permission requests), haptic feedback, network status, clipboard, and the native share sheet for sending invite codes. | `screens/main/GroceryListScreen.tsx:135`<br>`hooks/useIsOnline.ts:10` |
| **7** | Clean, responsive UI | Every screen uses SafeAreaView, forms move out of the way of the keyboard, and layouts are flex and percentage based rather than fixed sizes. Spacing and colours come from one token file, plus a light/dark/system picker in settings. | `theme/tokens.ts`<br>`components/SettingsBottomSheet.tsx:293` |
| **8** | Error handling and loading states | Every network call is wrapped in try/catch with a message the user can act on. There's a loading gate while the session restores, spinners on the list screens, validation on all 10 forms, and empty states for empty lists. | `navigation/AppNavigator.tsx:17`<br>`screens/main/GroceryListScreen.tsx:191` |
