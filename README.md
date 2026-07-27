# Syncquerino: Real-Time Collaborative Household Organizer

---

## 1. Project Overview
Syncquerino is a real-time collaborative mobile application designed to simplify household coordination for roommates, families, and partners. The application consolidates household states—such as shopping lists, chore assignments, and bulletin announcements—into a single, unified whiteboard, preventing forgotten chores or duplicate purchases.

The app consists of three core features:
1. **Shared Groceries List**: Shopping list with status checks, item counts, and device-compressed photo attachments.
2. **Reminders & Chores**: Task assignment hub featuring deadline dates selected via the native `react-native-calendars` selector.
3. **Whiteboard Notes**: Roommate announcement board containing display names and timestamp headers.

---

## 2. Tech Stack
* **Framework**: React Native (Expo SDK 57)
* **Language**: TypeScript
* **Navigation**: React Navigation v7 (Bottom Tabs + Native Stacks)
* **Backend Database**: Google Firebase Auth & Cloud Firestore (real-time listeners & persistent disk caching)
* **Hardware Integrations**: Expo Camera viewfinders, photo gallery selection, and native Tactile Haptics feedback (`expo-haptics`)
* **Form Controls**: React Hook Form & Zod schema validation
* **Testing Engine**: Jest & `jest-expo` unit testing

---

## 3. Setup & Run Instructions

### Prerequisites
Ensure you have Node.js and the Expo Go app installed on your physical device.

### 1. Clone the Repository
```bash
git clone https://github.com/andylpzm/Advanced-Mobile-Development-Project.git
cd Advanced-Mobile-Development-Project
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

### 5. Run Automated Tests
```bash
npm test
```


